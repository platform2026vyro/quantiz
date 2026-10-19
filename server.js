// QuantX AI - Backend: Albero di Natale FORZATO
// Regola: ogni utente DEVE invitare altri per crescere. Se gli invitati non depositano, il referrer non prende nulla.

const express = require('express');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- DATABASE ----------
const DB_FILE = path.join(__dirname, 'data', 'quantx.db');
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS signals (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  claimed TEXT NOT NULL DEFAULT '',
  profits TEXT NOT NULL DEFAULT '',
  UNIQUE(user_id, day)
)`);

// ---------- CONFIG ----------
const CONFIG = {
  WITHDRAW_FAST_LIMIT: 30,         // sotto questa soglia → prelievo immediato
  WITHDRAW_FEE_PCT: 0.035,         // 3.5% fee sopra soglia
  SIGNALS_PER_DAY: 3,
  PROFIT_MIN: 0.006,
  PROFIT_MAX: 0.018,
  ADMIN_KEY: 'QUANTX-ADMIN-2026',
  ALBERO_VISUAL: true,             // Mostra l'albero di Natale agli utenti
};

// ---------- AUTH ----------
function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP').get(tok);
  if (!session) return res.status(401).json({ error: 'Non autenticato' });
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user) return res.status(401).json({ error: 'Utente non trovato' });
  
  req.uid = user.id;
  req.user = user;
  next();
}

function adminAuth(req, res, next) {
  const key = (req.headers['x-admin-key'] || '');
  if (key !== CONFIG.ADMIN_KEY) return res.status(401).json({ error: 'Chiave admin errata' });
  next();
}

function hashPw(pw) {
  return crypto.scryptSync(pw, 'quantx-salt', 64).toString('hex');
}

// ---------- API: REGISTRAZIONE ----------
app.post('/api/register', (req, res) => {
  const { email, password, name, ref } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });
  
  // Check se email esiste
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email già registrata' });
  
  // Genera referral code unico
  const id = db.prepare('SELECT MAX(id) as max FROM users').get().max + 1;
  const referralCode = 'QX' + id.toString().padStart(4, '0');
  
  // Referred_by: chi ha invitato (se esiste)
  let referredById = null;
  if (ref) {
    const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(ref);
    if (referrer) referredById = referrer.id;
  }
  
  // Inserisci utente
  const stmt = db.prepare(`
    INSERT INTO users (email, username, password_hash, referral_code, referred_by, balance, total_ref_deposits, plan_id, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, 1, CURRENT_TIMESTAMP)
  `);
  stmt.run(email, name || 'Investitore', hashPw(password), referralCode, referredById);
  
  // Crea relazione referral se c'è un referrer
  if (referredById) {
    db.prepare(`
      INSERT INTO referrals (referrer_id, referee_id, referrer_bonus, active, created_at)
      VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
    `).run(referredById, id);
  }
  
  // Ottengo l'utente appena creato
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  // Crea sessione anche alla registrazione (il frontend la usa per il pannello)
  const regToken = crypto.randomUUID();
  const regExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, regToken, regExpires);

  res.status(201).json({
    token: regToken,
    message: 'Registrazione completata. Benvenuto su QuantX AI.',
    user: {
      id: user.id,
      email: user.email,
      name: user.username,
      referralCode: user.referral_code,
      balance: user.balance,
      planId: user.plan_id,
      referredBy: user.referred_by,
      alberoMessage: referredById
        ? 'Account creato tramite referral. Condividi il tuo codice per sbloccare i bonus referral.'
        : 'Condividi il tuo codice referral per iniziare a guadagnare bonus.'
    }
  });
});

// ---------- API: LOGIN ----------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  
  if (hashPw(password) !== user.password_hash) {
    return res.status(401).json({ error: 'Password errata' });
  }
  
  // Crea sessione
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);
  
  // Calcola yield giornaliero
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id);
  const dailyYield = plan.daily_yield_pct / 100;
  const yieldAmount = Math.round(user.balance * dailyYield * 100) / 100;
  const newBalance = Math.round((user.balance + yieldAmount) * 100) / 100;
  
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, user.id);
  
  // Ottengo info sull'albero
  const treeInfo = getAlberoInfo(user.id);
  
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.username,
      balance: newBalance,
      planId: user.plan_id,
      referralCode: user.referral_code,
      referredBy: user.referred_by,
      totalRefDeposits: user.total_ref_deposits,
      alberoMessage: user.referred_by
        ? 'Fai parte della rete QuantX. Condividi il tuo codice referral per sbloccare i bonus.'
        : 'Condividi il tuo codice referral per iniziare a guadagnare bonus.',
      alberoLevel: treeInfo.level,
      alberoSize: treeInfo.totalSize
    }
  });
});

function getAlberoInfo(userId) {
  // Trova il referrer
  const user = db.prepare('SELECT referred_by, username FROM users WHERE id = ?').get(userId);
  let referrerId = user.referred_by;
  let level = 1;
  let referrerUsername = null;
  
  // Sale fino alla radice per contare i livelli
  while (referrerId) {
    level++;
    const referrer = db.prepare('SELECT username, referred_by FROM users WHERE id = ?').get(referrerId);
    if (referrerId === user.referred_by) referrerUsername = referrer.username;
    referrerId = referrer.referred_by;
  }
  
  // Conta quanti invitati ha questo utente (dimensione albero)
  const totalSize = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').get(userId).count;
  
  return { level, referrerUsername, totalSize };
}

// ---------- API: DASHBOARD UTENTE ----------
app.get('/api/user', auth, (req, res) => {
  const user = req.user;
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id);
  
  // Ottengo info albero
  const treeInfo = getAlberoInfo(user.id);
  
  // Invitati
  const invites = db.prepare(`
    SELECT u.id, u.username, u.email, u.balance, r.active, r.referrer_bonus
    FROM users u
    LEFT JOIN referrals r ON u.id = r.referee_id AND r.referrer_id = ?
    WHERE u.referred_by = ?
  `).all(user.id, user.id) || [];
  
  // Depositi totali degli invitati
  const refDeposits = db.prepare(`
    SELECT SUM(d.amount) as total
    FROM deposits d
    JOIN users u ON d.user_id = u.id
    WHERE u.referred_by = ? AND d.confirmed = 1
  `).get(user.id).total || 0;
  
  res.json({
    id: user.id,
    email: user.email,
    name: user.username,
    balance: user.balance,
    plan: plan,
    referralCode: user.referral_code,
    referredBy: user.referred_by,
    totalRefDeposits: refDeposits,
    albero: {
      level: treeInfo.level,
      size: treeInfo.totalSize,
      message: user.referred_by
        ? "Fai parte della rete referral QuantX. Invita altri per aumentare i tuoi bonus."
        : "Condividi il tuo codice referral per far crescere la tua rete e guadagnare bonus.",
      invites: invites.map(i => ({
        username: i.username,
        balance: i.balance,
        active: i.active,  // true se ha depositato
        bonusForYou: i.referrer_bonus
      }))
    }
  });
});

// ---------- API: DASHBOARD UTENTE (quantum app) ----------
function ensureSignals(userId) {
  const day = new Date().toISOString().slice(0, 10);
  let row = db.prepare('SELECT * FROM signals WHERE user_id = ? AND day = ?').get(userId, day);
  if (!row) {
    db.prepare('INSERT INTO signals (user_id, day, claimed, profits) VALUES (?, ?, ?, ?)').run(userId, day, '[]', '[]');
    row = db.prepare('SELECT * FROM signals WHERE user_id = ? AND day = ?').get(userId, day);
  }
  return row;
}

function publicUser(user) {
  const streak = db.prepare("SELECT COUNT(*) AS c FROM signals WHERE user_id = ? AND claimed LIKE '%0%' AND claimed LIKE '%1%' AND claimed LIKE '%2%'").get(user.id).c;
  return {
    id: user.id, email: user.email, name: user.username,
    balance: user.balance, totalDeposited: user.total_ref_deposits,
    streak, createdAt: user.created_at,
    referralCode: user.referral_code, referredBy: user.referred_by,
    plan: user.plan_id,
  };
}

app.get('/api/me', auth, (req, res) => {
  const row = ensureSignals(req.uid);
  res.json({ user: publicUser(req.user), signals: { claimed: JSON.parse(row.claimed), profits: JSON.parse(row.profits) } });
});

// ---------- API: GIOCATE GIORNALIERE (3 segnali) ----------
app.post('/api/claim-signal', auth, (req, res) => {
  const i = parseInt(req.body && req.body.index);
  if (isNaN(i) || i < 0 || i >= CONFIG.SIGNALS_PER_DAY) return res.status(400).json({ error: 'Segnale non valido' });
  const row = ensureSignals(req.uid);
  const claimed = JSON.parse(row.claimed);
  const profits = JSON.parse(row.profits);
  if (claimed.includes(i)) return res.status(409).json({ error: 'Segnale già attivato' });
  const profit = Math.round(req.user.balance * (CONFIG.PROFIT_MIN + Math.random() * (CONFIG.PROFIT_MAX - CONFIG.PROFIT_MIN)) * 100) / 100;
  db.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(profit, req.uid);
  claimed.push(i); profits.push(profit);
  db.prepare('UPDATE signals SET claimed = ?, profits = ? WHERE user_id = ? AND day = ?')
    .run(JSON.stringify(claimed), JSON.stringify(profits), req.uid, row.day);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid);
  res.json({ profit, user: publicUser(user), signals: { claimed, profits } });
});

// ---------- API: REFERRALS ----------
app.get('/api/referrals', auth, (req, res) => {
  const invites = db.prepare('SELECT id FROM users WHERE referred_by = ?').all(req.uid);
  const list = invites.map(inv => {
    const u = db.prepare('SELECT username, balance FROM users WHERE id = ?').get(inv.id);
    const deposited = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE user_id = ? AND confirmed = 1').get(inv.id).s;
    return { name: u.username, balance: u.balance, deposited: deposited };
  });
  const earned = db.prepare('SELECT COALESCE(SUM(referrer_bonus),0) AS s FROM referrals WHERE referrer_id = ?').get(req.uid).s;
  res.json({ code: req.user.referral_code, count: invites.length, earned, list });
});

// ---------- API: STORICO PRELIEVI ----------
app.get('/api/withdrawals', auth, (req, res) => {
  const rows = db.prepare('SELECT amount, fee, status, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(req.uid);
  res.json({ withdrawals: rows.map(w => ({ amount: w.amount, fee: w.fee, status: w.status, date: w.created_at })) });
});

// ---------- API: ATTIVA PIANO ----------
app.post('/api/activate-plan', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.body && req.body.plan);
  if (!plan) return res.status(400).json({ error: 'Piano non valido' });
  db.prepare('UPDATE users SET plan_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(plan.id, req.uid);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid)), plan: { id: plan.id, name: plan.name } });
});

// ---------- API: STATISTICHE FAKE (landing) ----------
app.get('/api/stats', (req, res) => {
  res.json({
    profitToday: Math.round(180000 + Math.random() * 200000),
    activeUsers: 4821 + Math.floor(Math.random() * 300),
    winRate: 87.4,
    totalManaged: 12400000,
  });
});

// ---------- API: DEPOSITO ----------
app.post('/api/deposit', auth, (req, res) => {
  const { amount } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Importo invalido' });

  // Piano dell'utente (usato per bonus referral, se presente un referrer)
  let plan = db.prepare('SELECT * FROM plans WHERE id = ?').get((req.body && req.body.planId) || req.user.plan_id || 1);

  // Inserisci deposito
  db.prepare(`
    INSERT INTO deposits (user_id, amount, plan_id, confirmed, created_at)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).run(req.uid, amt, plan.id);

  // Aggiorna saldo utente
  const newBalance = Math.round((req.user.balance + amt) * 100) / 100;
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, req.uid);

  // Se c'è un referrer, aggiorna il bonus
  if (req.user.referred_by) {
    const referrer = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.referred_by);
    const bonus = Math.round(amt * (plan.ref_bonus_pct / 100) * 100) / 100;
    db.prepare('UPDATE users SET balance = balance + ?, total_ref_deposits = total_ref_deposits + ? WHERE id = ?').run(bonus, amt, req.user.referred_by);
    db.prepare('UPDATE referrals SET active = 1, referrer_bonus = referrer_bonus + ? WHERE referrer_id = ? AND referee_id = ?').run(bonus, req.user.referred_by, req.uid);
    if (referrer.referred_by) {
      const grandparentBonus = Math.round(bonus * 0.10 * 100) / 100;
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(grandparentBonus, referrer.referred_by);
    }
  }

  res.status(201).json({
    message: 'Deposito confermato. Fondi in elaborazione.',
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid)),
    deposit: { amount: amt, plan: plan.name, referrerBonus: req.user.referred_by ? Math.round(amt * (plan.ref_bonus_pct / 100) * 100) / 100 : 0 },
  });
});

// ---------- API: PRELIEVO ----------
app.post('/api/withdraw', auth, (req, res) => {
  const { amount, wallet } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Importo invalido' });
  
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.uid);
  if (amount > user.balance) {
    return res.status(400).json({ error: 'Saldo insufficiente' });
  }
  
  const isFast = amount <= CONFIG.WITHDRAW_FAST_LIMIT;
  const status = isFast ? 'completed' : 'pending';
  const fee = isFast ? 0 : Math.round(amount * CONFIG.WITHDRAW_FEE_PCT * 100) / 100;
  
  db.prepare(`
    INSERT INTO withdrawals (user_id, amount, fee, status, is_fast, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(req.uid, amount, fee, status, isFast ? 1 : 0);
  
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount + fee, req.uid);
  
  res.status(201).json({
    message: isFast ? 'Prelievo istantaneo completato.' : 'Prelievo in elaborazione (KYC richiesto)',
    withdrawal: {
      amount,
      fee,
      status: isFast ? 'approvato' : 'in_verifica',
      msg: isFast ? 'Pagamento elaborato con successo.' : 'Prelievo in verifica KYC. L\'importo verrà rilasciato dopo la verifica del documento.',
      isFast
    },
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid))
  });
});

// ---------- API: PIANI ----------
app.get('/api/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans ORDER BY id').all();
  res.json(plans.map(p => ({
    id: p.id,
    name: p.name,
    minDeposit: p.min_deposit,
    maxDeposit: p.max_deposit,
    dailyYieldPct: p.daily_yield_pct,
    refBonusPct: p.ref_bonus_pct,
    color: p.color,
    icon: p.icon
  })));
});

// ---------- API: ADMIN ----------
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalDeposits = db.prepare('SELECT SUM(amount) as total FROM deposits WHERE confirmed = 1').get().total || 0;
  const totalReferrals = db.prepare('SELECT COUNT(*) as count FROM referrals').get().count;
  
  // Albero di Natale: quanti livelli massimi
  const maxLevel = db.prepare(`
    WITH RECURSIVE tree(user_id, level) AS (
      SELECT id, 1 FROM users WHERE referred_by IS NULL
      UNION ALL
      SELECT u.id, t.level + 1 FROM users u JOIN tree t ON u.referred_by = t.user_id
    )
    SELECT MAX(level) as max FROM tree
  `).get().max || 1;
  
  res.json({
    totalUsers,
    totalDeposits,
    totalReferrals,
    maxAlberoLevel: maxLevel,
    liquidityRatio: '100%'  // Semplificato
  });
});

app.get('/api/admin/tree', adminAuth, (req, res) => {
  // Mostra struttura dell'albero di Natale
  const rootUsers = db.prepare('SELECT * FROM users WHERE referred_by IS NULL').all();
  const tree = rootUsers.map(root => ({
    username: root.username,
    level: 1,
    invites: getInvitesRecursive(root.id, 2, db)
  }));
  
  res.json({ tree });
});

function getInvitesRecursive(userId, level, db) {
  const invites = db.prepare('SELECT * FROM users WHERE referred_by = ?').all(userId);
  return invites.map(invite => ({
    username: invite.username,
    level,
    balance: invite.balance,
    invites: getInvitesRecursive(invite.id, level + 1, db)
  }));
}

// ---------- API: ADMIN (pannello di controllo) ----------
app.get('/api/admin/overview', adminAuth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const totalDeposited = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE confirmed = 1").get().s;
  const totalBalance = db.prepare('SELECT COALESCE(SUM(balance),0) AS s FROM users').get().s;
  const pendingWithdrawals = db.prepare(`
    SELECT u.email, w.amount, w.fee, w.created_at AS date
    FROM withdrawals w JOIN users u ON u.id = w.user_id
    WHERE w.status = 'pending' ORDER BY w.created_at DESC
  `).all();
  res.json({ totalUsers, totalDeposited, totalBalance, pendingWithdrawals });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = db.prepare('SELECT id, email, username AS name, balance, total_ref_deposits AS totalDeposited, plan_id, referral_code, referred_by FROM users ORDER BY id').all();
  res.json({ users });
});

app.post('/api/admin/set-balance', adminAuth, (req, res) => {
  const { id, balance } = req.body;
  const b = parseFloat(balance);
  if (!id || isNaN(b) || b < 0) return res.status(400).json({ error: 'id o balance non validi' });
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'Utente non trovato' });
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(b, id);
  res.json({ ok: true, user: { id, balance: b } });
});

app.post('/api/admin/resolve-withdrawal', adminAuth, (req, res) => {
  const { email, date, status } = req.body;
  if (!email || !date || !['pagato', 'respinto'].includes(status)) return res.status(400).json({ error: 'Parametri non validi' });
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!u) return res.status(404).json({ error: 'Utente non trovato' });
  const w = db.prepare("SELECT id FROM withdrawals WHERE user_id = ? AND created_at = ? AND status = 'pending'").get(u.id, date);
  if (!w) return res.status(404).json({ error: 'Prelievo non trovato o già risolto' });
  db.prepare('UPDATE withdrawals SET status = ? WHERE id = ?').run(status === 'pagato' ? 'completed' : 'rejected', w.id);
  res.json({ ok: true, status: status === 'pagato' ? 'Pagato' : 'Respinto (KYC)' });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 QuantX AI server attivo su http://localhost:' + PORT);
  console.log('🎄 ALBERO DI NATALE FORZATO!');
  console.log('   - Ogni utente DEVE invitare altri per crescere');
  console.log('   - Se gli invitati non depositano, il referrer prende 0');
  console.log('   - Bonus referral: 10-17% (solo se gli invitati depositano)');
  console.log('   - Yield giornaliero: 3-8%');
  console.log('   - Admin key: ' + CONFIG.ADMIN_KEY);
});

module.exports = app;