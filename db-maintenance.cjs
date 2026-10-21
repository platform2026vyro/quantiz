// Manutenzione database QuantX: backup consistente + igiene + compattazione.
// Uso: fermare il server, poi `node db-maintenance.cjs`.
const fs = require('fs');
const path = require('path');
const D = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'quantx.db');
const backupDir = path.join(__dirname, 'data', 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
let backupPath = path.join(backupDir, `quantx-${stamp}.db`);
let n = 1;
while (fs.existsSync(backupPath)) backupPath = path.join(backupDir, `quantx-${stamp}-${n++}.db`);

const db = new D(dbPath);
const q = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const size = (f) => (fs.existsSync(f) ? (fs.statSync(f).size / 1024 / 1024).toFixed(2) + ' MB' : '-');

console.log('=== PRIMA ===');
console.log('db:', size(dbPath), '| wal:', size(dbPath + '-wal'), '| shm:', size(dbPath + '-shm'));
console.log('integrity:', one('PRAGMA integrity_check').integrity_check);

db.pragma('wal_checkpoint(TRUNCATE)');
db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
console.log('backup creato:', backupPath, size(backupPath));

// Verifica il backup prima di toccare il DB vivo.
const check = new D(backupPath, { readonly: true });
const backupOk = check.pragma('integrity_check', { simple: true });
const backupUsers = check.prepare('SELECT COUNT(*) c FROM users').get().c;
check.close();
if (backupOk !== 'ok' || backupUsers === 0) {
  console.error('Backup non valido, manutenzione annullata.');
  db.close();
  process.exit(1);
}
console.log('backup verificato: integrity ok, utenti =', backupUsers);

const before = {
  sessions: one('SELECT COUNT(*) c FROM sessions').c,
  refDep: q("SELECT id, email, total_ref_deposits FROM users WHERE ROUND(COALESCE(total_ref_deposits,0),2) <> 0"),
};

db.transaction(() => {
  // 1) Bonifici referral: ricalcolo del totale versato dagli invitati confermati.
  const refFix = db.prepare(`
    UPDATE users SET total_ref_deposits = ROUND(COALESCE((
      SELECT SUM(d.amount) FROM deposits d JOIN users r ON r.id = d.user_id
      WHERE r.referred_by = users.id AND d.confirmed = 1
    ), 0), 2)
    WHERE ROUND(COALESCE(total_ref_deposits,0),2) <> ROUND(COALESCE((
      SELECT SUM(d.amount) FROM deposits d JOIN users r ON r.id = d.user_id
      WHERE r.referred_by = users.id AND d.confirmed = 1
    ), 0), 2)
  `).run();

  // 2) Sessioni: scadute via, poi massimo 3 token recenti per utente.
  const expired = db.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
  const dedup = db.prepare(`
    DELETE FROM sessions WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) rn
        FROM sessions
      ) WHERE rn <= 3
    )
  `).run();

  // 3) Righe orfane (difensivo: le FK non le prevedono, ma i vecchi import si).
  const orphanSignals = db.prepare('DELETE FROM signals WHERE user_id NOT IN (SELECT id FROM users)').run();
  const orphanLedger = db.prepare('DELETE FROM ledger WHERE user_id NOT IN (SELECT id FROM users)').run();
  const orphanRefs = db.prepare('DELETE FROM referrals WHERE referrer_id NOT IN (SELECT id FROM users) OR referee_id NOT IN (SELECT id FROM users)').run();

  return {
    refFix: refFix.changes,
    expired: expired.changes,
    dedup: dedup.changes,
    orphanSignals: orphanSignals.changes,
    orphanLedger: orphanLedger.changes,
    orphanRefs: orphanRefs.changes,
  };
})();

const result = {
  refFix: 0, expired: 0, dedup: 0, orphanSignals: 0, orphanLedger: 0, orphanRefs: 0,
};
// Il transaction sopra ha gia' applicato le modifiche; i changes vengono riletti qui sotto.
console.log('=== DOPO ===');
const after = {
  sessions: one('SELECT COUNT(*) c FROM sessions').c,
  refDep: q("SELECT id, email, total_ref_deposits FROM users WHERE ROUND(COALESCE(total_ref_deposits,0),2) <> 0"),
};
console.log('sessioni:', before.sessions, '->', after.sessions);
console.log('total_ref_deposits prima:', before.refDep);
console.log('total_ref_deposits dopo:', after.refDep);

db.pragma('wal_checkpoint(TRUNCATE)');
db.exec('VACUUM');
db.pragma('optimize');
db.pragma('wal_checkpoint(TRUNCATE)');
console.log('integrity finale:', one('PRAGMA integrity_check').integrity_check);
console.log('fk violazioni:', q('PRAGMA foreign_key_check').length);
console.log('db:', size(dbPath), '| wal:', size(dbPath + '-wal'));
db.close();
