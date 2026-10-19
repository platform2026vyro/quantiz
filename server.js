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

// Ledger: ogni variazione di saldo con timestamp -> serve per la curva reale e lo storico
db.exec(`CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,          -- deposit | withdraw | signal | referral | adjust
  amount DECIMAL(15,2) NOT NULL,  -- delta (positivo/negativo)
  balance_after DECIMAL(15,2) NOT NULL,
  meta TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_ledger_kind ON ledger(kind)');

// Riempie il ledger con i movimenti storici (una volta sola)
function backfillLedger() {
  const done = db.prepare('SELECT COUNT(*) AS c FROM ledger').get().c;
  const moves = db.prepare('SELECT COUNT(*) AS c FROM deposits WHERE confirmed = 1').get().c
              + db.prepare('SELECT COUNT(*) AS c FROM withdrawals').get().c;
  if (done > 0 || moves === 0) return;

  const add = db.prepare('INSERT INTO ledger (user_id, kind, amount, balance_after, meta, created_at) VALUES (?, ?, ?, 0, ?, ?)');
  for (const d of db.prepare('SELECT user_id, amount, created_at FROM deposits WHERE confirmed = 1 ORDER BY created_at').all()) {
    add.run(d.user_id, 'deposit', d.amount, 'deposito (storico)', d.created_at);
  }
  for (const w of db.prepare('SELECT user_id, amount, fee, status, created_at FROM withdrawals ORDER BY created_at').all()) {
    add.run(w.user_id, 'withdraw', -(w.amount + (w.fee || 0)), 'prelievo ' + w.status + ' (storico)', w.created_at);
  }
  for (const s of db.prepare("SELECT user_id, day, profits FROM signals WHERE claimed <> '[]'").all()) {
    let profits = [];
    try { profits = JSON.parse(s.profits); } catch (e) { /* ignora */ }
    for (const p of profits) add.run(s.user_id, 'signal', p, 'segnale (storico)', s.day + ' 12:00:00');
  }

  // Ricalcola i saldi progressivi per utente
  for (const u of db.prepare('SELECT id FROM users').all()) {
    const rows = db.prepare('SELECT id, amount FROM ledger WHERE user_id = ? ORDER BY created_at ASC, id ASC').all(u.id);
    let bal = 0;
    for (const r of rows) {
      bal = Math.round((bal + r.amount) * 100) / 100;
      db.prepare('UPDATE ledger SET balance_after = ? WHERE id = ?').run(bal, r.id);
    }
  }
}
backfillLedger();

// ---------- CONFIG ----------
const CONFIG = {
  WITHDRAW_MIN: 50,                // prelievo minimo 50€
  WITHDRAW_FEE_PCT: 0.05,          // 5% fee piattaforma su tutti i prelievi
  SIGNALS_PER_DAY: 3,
  SIGNAL_HOURS: [9, 14, 20],       // segnali disponibili solo a queste ore
  PROFIT_MIN: 0.006,               // +0.6% minimo
  PROFIT_MAX: 0.018,               // +1.8% massimo
  LOSS_MIN: -0.012,                // -1.2% perdite realistiche
  LOSS_MAX: -0.004,                // -0.4% perdite realistiche
  REF_BONUS_REQUIRED: true,        // bonus SOLO se inviti E depositi
  REF_BONUS_PCT: { 1: 10, 2: 12, 3: 14, 4: 17 }, // % bonus per piano
  ADMIN_KEY: 'QUANTX-ADMIN-2026',
  ADMIN_EMAIL: 'asgaga90@libero.it',
};

// ---------- MIGRAZIONI: DB sempre coerente ----------
function migrate() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('is_admin')) db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
  if (!cols.includes('last_yield_date')) db.exec('ALTER TABLE users ADD COLUMN last_yield_date TEXT');

  // Il proprietario e' l'admin della piattaforma
  db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(CONFIG.ADMIN_EMAIL);

  // Piani ufficiali (nomi professionali, gli stessi che vede l'utente)
  const plans = [
    [1, 'Starter',     10,  99,   3,   10, '#22d3ee', '⚡'],
    [2, 'Pro',         50,  299,  4.5, 12, '#8b5cf6', '📈'],
    [3, 'Elite',       200, 999,  6,   14, '#f59e0b', '💎'],
    [4, 'Quantum VIP', 500, null, 8,   17, '#22ff88', '👑'],
  ];
  const upsert = db.prepare(`INSERT INTO plans (id, name, min_deposit, max_deposit, daily_yield_pct, ref_bonus_pct, color, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, min_deposit = excluded.min_deposit, max_deposit = excluded.max_deposit,
      daily_yield_pct = excluded.daily_yield_pct, ref_bonus_pct = excluded.ref_bonus_pct, color = excluded.color, icon = excluded.icon`);
  for (const p of plans) upsert.run(...p);

  db.exec('CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_code ON users(referral_code)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)');
}
migrate();

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

// L'admin entra con la chiave OPPURE con il login del suo account (sessione admin)
function adminAuth(req, res, next) {
  const key = (req.headers['x-admin-key'] || '');
  if (key === CONFIG.ADMIN_KEY) return next();

  const tok = key || (req.headers.authorization || '').replace('Bearer ', '');
  const session = tok ? db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP').get(tok) : null;
  if (session) {
    const u = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(session.user_id);
    if (u && u.is_admin) return next();
  }
  return res.status(401).json({ error: 'Accesso admin richiesto' });
}

function hashPw(pw) {
  return crypto.scryptSync(pw, 'quantx-salt', 64).toString('hex');
}

// ---------- LEDGER (storico reale delle variazioni di saldo) ----------
function logLedger(userId, kind, amount, balanceAfter, meta) {
  db.prepare('INSERT INTO ledger (user_id, kind, amount, balance_after, meta, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
    .run(userId, kind, Math.round(amount * 100) / 100, Math.round(balanceAfter * 100) / 100, meta || null);
}

// ---------- SEGNALI: definizioni e generazione deterministica per giornata ----------
const SIGNAL_DEFS = [
  { index: 0, name: 'Alpha', pair: 'BTC/USDT', hour: 9,  base: 64280 },
  { index: 1, name: 'Beta',  pair: 'ETH/USDT', hour: 14, base: 2486 },
  { index: 2, name: 'Gamma', pair: 'SOL/USDT', hour: 20, base: 147.4 },
];

// PRNG deterministico: stesso utente + stesso giorno = stessi segnali (coerenti, non casuali a ogni reload)
function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let t = h >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Descrizione del segnale per un utente in un giorno: coerente fra reload e fra utenti diversi
function buildSignal(userId, day, def) {
  const rnd = seededRandom(userId + '|' + day + '|' + def.index);
  const confidence = Math.round((88 + rnd() * 10) * 10) / 10;      // 88.0 - 98.0
  const winProb = 0.45 + confidence / 320;                          // piu' alta la confidenza, piu' probabile il win
  const isWin = rnd() < winProb;
  const direction = isWin ? 'LONG' : 'SHORT';
  const volatility = 0.6 + rnd() * 1.6;                             // volatilita' in percentuale
  const entry = Math.round(def.base * (1 + (rnd() - 0.5) * 0.016) * 100) / 100;
  const tpMove = isWin ? volatility : -(volatility * 0.6);
  const slMove = isWin ? -(volatility * 0.6) : -(volatility);
  const tp = Math.round(entry * (1 + tpMove / 100) * 100) / 100;
  const sl = Math.round(entry * (1 + slMove / 100) * 100) / 100;
  return {
    index: def.index, name: def.name, pair: def.pair, hour: def.hour,
    confidence, direction, entry, tp, sl, isWin,
  };
}

// Segnali del giorno per un utente, con stato (claimato / disponibile / non ancora aperto)
function daySignals(userId, day) {
  const row = db.prepare('SELECT claimed, profits FROM signals WHERE user_id = ? AND day = ?').get(userId, day);
  const claimed = row ? JSON.parse(row.claimed) : [];
  const profits = row ? JSON.parse(row.profits) : [];
  const currentHour = new Date().getHours();
  return SIGNAL_DEFS.map(def => {
    const s = buildSignal(userId, day, def);
    const idx = claimed.indexOf(def.index);
    const isClaimed = idx >= 0;
    const isOpen = currentHour >= def.hour;
    return Object.assign(s, {
      claimed: isClaimed,
      profit: isClaimed ? (profits[idx] || 0) : null,
      state: isClaimed ? 'closed' : (isOpen ? 'available' : 'scheduled'),
    });
  });
}

// ---------- API: REGISTRAZIONE ----------
app.post('/api/register', (req, res) => {
  const { email, password, name, ref } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });
  
  // Check se email esiste
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email già registrata' });
  
  // Referral code univoco basato sull'id reale dell'utente
  const tmpCode = 'TMP' + crypto.randomBytes(4).toString('hex').toUpperCase();

  // Referred_by: chi ha invitato (se il codice esiste)
  let referredById = null;
  const refCode = (ref || req.body.referralCode || '').toString().trim().toUpperCase();
  if (refCode) {
    const referrer = db.prepare('SELECT id FROM users WHERE UPPER(referral_code) = ?').get(refCode);
    if (referrer) referredById = referrer.id;
  }

  // Inserisci utente (codice definitivo subito dopo, con l'id vero)
  const stmt = db.prepare(`
    INSERT INTO users (email, username, password_hash, referral_code, referred_by, balance, total_ref_deposits, plan_id, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, 1, CURRENT_TIMESTAMP)
  `);
  const inserted = stmt.run(email, name || 'Investitore', hashPw(password), tmpCode, referredById);
  const newId = Number(inserted.lastInsertRowid);

  let referralCode = 'QX' + String(newId).padStart(4, '0');
  if (db.prepare('SELECT id FROM users WHERE referral_code = ? AND id <> ?').get(referralCode, newId)) {
    referralCode = 'QX' + String(newId).padStart(4, '0') + crypto.randomBytes(2).toString('hex').toUpperCase();
  }
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(referralCode, newId);

  // Crea relazione referral se c'è un referrer valido
  if (referredById) {
    db.prepare(`
      INSERT OR IGNORE INTO referrals (referrer_id, referee_id, referrer_bonus, active, created_at)
      VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
    `).run(referredById, newId);
  }

  // Ottengo l'utente appena creato
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);

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
      isAdmin: !!user.is_admin,
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
  
  // Rendita giornaliera: UNA volta al giorno per utente (evita saldi gonfiati a ogni login)
  const today = new Date().toISOString().slice(0, 10);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id) || { daily_yield_pct: 0, name: 'Starter' };
  let yieldAmount = 0;
  let newBalance = user.balance;
  if (user.last_yield_date !== today) {
    yieldAmount = Math.round(user.balance * (plan.daily_yield_pct / 100) * 100) / 100;
    newBalance = Math.round((user.balance + yieldAmount) * 100) / 100;
    db.prepare('UPDATE users SET balance = ?, last_yield_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, today, user.id);
  }

  const networkInfo = getNetworkInfo(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.username,
      balance: newBalance,
      dailyYield: yieldAmount,
      planId: user.plan_id,
      planName: plan.name,
      referralCode: user.referral_code,
      referredBy: user.referred_by,
      totalRefDeposits: user.total_ref_deposits,
      isAdmin: !!user.is_admin,
      networkLevel: networkInfo.level,
      networkSize: networkInfo.totalSize,
    }
  });
});

function getNetworkInfo(userId) {
  // Risale la catena di inviti per contare il livello
  const user = db.prepare('SELECT referred_by, username FROM users WHERE id = ?').get(userId);
  let referrerId = user.referred_by;
  let level = 1;
  let referrerUsername = null;
  
  while (referrerId) {
    level++;
    const referrer = db.prepare('SELECT username, referred_by FROM users WHERE id = ?').get(referrerId);
    if (!referrer) break;
    if (referrerId === user.referred_by) referrerUsername = referrer.username;
    referrerId = referrer.referred_by;
  }
  
  // Quanti invitati diretti ha questo utente
  const totalSize = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').get(userId).count;
  
  return { level, referrerUsername, totalSize };
}

// ---------- API: DASHBOARD UTENTE ----------
app.get('/api/user', auth, (req, res) => {
  const user = req.user;
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id);
  
  // Info rete inviti
  const treeInfo = getNetworkInfo(user.id);
  
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
    isAdmin: !!user.is_admin,
    totalRefDeposits: refDeposits,
    network: {
      level: treeInfo.level,
      size: treeInfo.totalSize,
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
  const plan = db.prepare('SELECT name, daily_yield_pct, ref_bonus_pct FROM plans WHERE id = ?').get(user.plan_id);
  const ownDeposits = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE user_id = ? AND confirmed = 1').get(user.id).s;
  const rows = db.prepare('SELECT claimed FROM signals WHERE user_id = ?').all(user.id);
  let streak = 0;
  for (const r of rows) { try { if (JSON.parse(r.claimed).length >= CONFIG.SIGNALS_PER_DAY) streak++; } catch (e) { /* ignora */ } }
  return {
    id: user.id, email: user.email, name: user.username,
    balance: user.balance,
    totalDeposited: ownDeposits,
    totalRefDeposits: user.total_ref_deposits,
    streak, createdAt: user.created_at,
    referralCode: user.referral_code, referredBy: user.referred_by,
    plan: user.plan_id, planName: plan ? plan.name : 'Starter',
    planYieldPct: plan ? plan.daily_yield_pct : 0,
    planRefBonusPct: plan ? plan.ref_bonus_pct : 0,
    isAdmin: !!user.is_admin,
  };
}

app.get('/api/me', auth, (req, res) => {
  const row = ensureSignals(req.uid);
  const day = new Date().toISOString().slice(0, 10);
  res.json({
    user: publicUser(req.user),
    signals: { claimed: JSON.parse(row.claimed), profits: JSON.parse(row.profits) },
    today: daySignals(req.uid, day),
  });
});

// ---------- API: GIOCATE GIORNALIERE (3 segnali ad orari precisi) ----------
// Il risultato e' deterministico e coerente con entry/TP/SL mostrati in dashboard
function generateSignalProfit(userId, signalIndex) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return 0;

  const day = new Date().toISOString().slice(0, 10);
  const existing = db.prepare('SELECT claimed, profits FROM signals WHERE user_id = ? AND day = ?').get(userId, day);
  if (existing) {
    const claimed = JSON.parse(existing.claimed);
    if (claimed.includes(signalIndex)) return 0;
  }

  const def = SIGNAL_DEFS[signalIndex];
  const sig = buildSignal(userId, day, def);

  // Solo chi ha referral attivo + deposito ottiene il rendimento pieno
  const hasReferrer = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referee_id = ? AND active = 1').get(userId).count > 0;
  const hasDeposit = db.prepare('SELECT COUNT(*) as count FROM deposits WHERE user_id = ? AND confirmed = 1').get(userId).count > 0;
  const scale = (hasReferrer && hasDeposit) ? 1 : 0.35;

  const pct = sig.isWin
    ? (CONFIG.PROFIT_MIN + ((sig.confidence - 88) / 100) * (CONFIG.PROFIT_MAX - CONFIG.PROFIT_MIN)) / 100
    : (CONFIG.LOSS_MAX + ((sig.confidence - 88) / 100) * (CONFIG.LOSS_MIN - CONFIG.LOSS_MAX)) / 100;

  return Math.round(user.balance * pct * scale * 100) / 100;
}

app.post('/api/claim-signal', auth, (req, res) => {
  const i = parseInt(req.body && req.body.index);
  if (isNaN(i) || i < 0 || i >= CONFIG.SIGNALS_PER_DAY) return res.status(400).json({ error: 'Segnale non valido' });
  
  // Controlla se il segnale è disponibile a quest'ora
  const currentHour = new Date().getHours();
  const signalHour = CONFIG.SIGNAL_HOURS[i];
  if (currentHour !== signalHour) {
    return res.status(403).json({ 
      error: 'Segnale non disponibile a quest\'ora', 
      message: `Il segnale ${i + 1} è disponibile alle ore ${signalHour}:00`,
      availableAt: signalHour 
    });
  }
  
  const row = ensureSignals(req.uid);
  const claimed = JSON.parse(row.claimed);
  const profits = JSON.parse(row.profits);
  
  if (claimed.includes(i)) return res.status(409).json({ error: 'Segnale già attivato' });
  
  // Genera profitto (o perdita) coerente con il segnale mostrato in dashboard
  const profit = generateSignalProfit(req.uid, i);
  
  // Aggiunge il profitto/perdita al saldo (se negativo, lo sottrae)
  const newBalance = Math.round((req.user.balance + profit) * 100) / 100;
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, req.uid);
  logLedger(req.uid, 'signal', profit, newBalance, SIGNAL_DEFS[i].pair + ' ' + (profit >= 0 ? 'TP' : 'SL'));

  // Traccia il segnale
  claimed.push(i);
  profits.push(profit);
  db.prepare('UPDATE signals SET claimed = ?, profits = ? WHERE user_id = ? AND day = ?')
    .run(JSON.stringify(claimed), JSON.stringify(profits), req.uid, row.day);
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid);
  const day = new Date().toISOString().slice(0, 10);
  res.json({ 
    profit, 
    user: publicUser(user), 
    signals: { claimed, profits },
    signal: daySignals(req.uid, day).find(s => s.index === i),
    message: profit >= 0 ? 'Segnale attivato: profitto accreditato' : 'Segnale attivato: perdita registrata'
  });
});

// ---------- API: REFERRALS (pagina Amici) ----------
app.get('/api/referrals', auth, (req, res) => {
  const invites = db.prepare('SELECT id, username, balance, created_at FROM users WHERE referred_by = ? ORDER BY id').all(req.uid);
  const list = invites.map(inv => {
    const deposited = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE user_id = ? AND confirmed = 1').get(inv.id).s;
    const bonus = db.prepare('SELECT COALESCE(referrer_bonus,0) AS b FROM referrals WHERE referrer_id = ? AND referee_id = ?').get(req.uid, inv.id);
    return {
      name: inv.username,
      balance: inv.balance,
      deposited: deposited,
      active: deposited > 0,      // il bonus si sblocca SOLO se l'amico deposita
      bonus: bonus ? bonus.b : 0,
      since: inv.created_at,
    };
  });
  const earned = db.prepare('SELECT COALESCE(SUM(referrer_bonus),0) AS s FROM referrals WHERE referrer_id = ?').get(req.uid).s;
  const activeCount = list.filter(x => x.active).length;
  res.json({
    code: req.user.referral_code,
    link: '/app.html?ref=' + req.user.referral_code,
    count: invites.length,
    activeCount,
    earned,
    list,
  });
});

// ---------- API: STORICO PRELIEVI ----------
app.get('/api/withdrawals', auth, (req, res) => {
  const rows = db.prepare('SELECT amount, fee, status, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(req.uid);
  res.json({ withdrawals: rows.map(w => ({ amount: w.amount, fee: w.fee, status: w.status, date: w.created_at })) });
});

// ---------- API: ATTIVA PIANO ----------
const PLAN_SLUGS = { starter: 1, semi: 1, base: 1, pro: 2, pianta: 2, elite: 3, gold: 3, 'albero giovane': 3, vip: 4, titan: 4, 'quantum vip': 4, 'albero maturo': 4 };

function findPlan(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const val = String(raw).trim();
  const asId = parseInt(val, 10);
  if (!isNaN(asId) && String(asId) === val.replace(/^0+(?=\d)/, '')) {
    const p = db.prepare('SELECT * FROM plans WHERE id = ?').get(asId);
    if (p) return p;
  }
  const byName = db.prepare('SELECT * FROM plans WHERE LOWER(name) = LOWER(?)').get(val);
  if (byName) return byName;
  const slug = PLAN_SLUGS[val.toLowerCase()];
  return slug ? db.prepare('SELECT * FROM plans WHERE id = ?').get(slug) : null;
}

// Sceglie il piano piu' alto attivabile con quell'importo
function bestPlanForAmount(amt) {
  return db.prepare('SELECT * FROM plans WHERE min_deposit <= ? ORDER BY min_deposit DESC LIMIT 1').get(amt)
    || db.prepare('SELECT * FROM plans ORDER BY min_deposit ASC LIMIT 1').get();
}

app.post('/api/activate-plan', auth, (req, res) => {
  const plan = findPlan(req.body && req.body.plan);
  if (!plan) return res.status(400).json({ error: 'Piano non valido' });
  db.prepare('UPDATE users SET plan_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(plan.id, req.uid);
  res.json({
    plan: { id: plan.id, name: plan.name, minDeposit: plan.min_deposit, maxDeposit: plan.max_deposit, dailyYieldPct: plan.daily_yield_pct, refBonusPct: plan.ref_bonus_pct },
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid)),
  });
});

// ---------- API: STATISTICHE (dati reali dal database) ----------
app.get('/api/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  // Utenti attivi = sessioni DISTINTE valide (non il numero di sessioni)
  const activeUsers = db.prepare("SELECT COUNT(DISTINCT user_id) AS c FROM sessions WHERE expires_at > CURRENT_TIMESTAMP").get().c;
  const totalDeposited = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE confirmed = 1').get().s;
  const totalWithdrawn = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'completed'").get().s;
  const totalBalance = db.prepare('SELECT COALESCE(SUM(balance),0) AS s FROM users').get().s;
  const signalsRun = db.prepare("SELECT COUNT(*) AS c FROM signals WHERE claimed <> '[]'").get().c;

  // Win rate reale sui segnali chiusi
  const closed = db.prepare("SELECT profits FROM signals WHERE claimed <> '[]'").all();
  let wins = 0, total = 0;
  for (const row of closed) {
    for (const p of JSON.parse(row.profits)) { total++; if (p > 0) wins++; }
  }
  const winRate = total ? Math.round((wins / total) * 1000) / 10 : null;

  // Depositi ultimi 7 giorni (per lo sparkline)
  const daily = db.prepare(`
    SELECT date(created_at) AS d, SUM(amount) AS s FROM deposits
    WHERE confirmed = 1 AND date(created_at) >= date('now', '-6 days')
    GROUP BY d ORDER BY d
  `).all();

  res.json({
    totalUsers, activeUsers, totalDeposited, totalWithdrawn, totalBalance,
    signalsRun, winRate, dailyDeposits: daily,
  });
});

// ---------- API: PORTFOLIO (curva reale del saldo) ----------
app.get('/api/portfolio', auth, (req, res) => {
  const rows = db.prepare('SELECT created_at, balance_after, amount, kind FROM ledger WHERE user_id = ? ORDER BY created_at ASC, id ASC').all(req.uid);
  const deposits = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE user_id = ? AND confirmed = 1').get(req.uid).s;
  const withdrawn = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE user_id = ? AND status = 'completed'").get(req.uid).s;
  const pending = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE user_id = ? AND status = 'pending'").get(req.uid).s;

  // Curva: parte da 0 al primo movimento
  const series = [];
  if (rows.length) {
    series.push({ t: rows[0].created_at, v: 0 });
    for (const r of rows) series.push({ t: r.created_at, v: r.balance_after });
  }

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.user.plan_id) || { daily_yield_pct: 0, name: 'Starter' };

  res.json({
    balance: req.user.balance,
    deposited: deposits,
    withdrawn,
    pending,
    netProfit: Math.round((req.user.balance + withdrawn - deposits) * 100) / 100,
    series,
    plan: { id: plan.id, name: plan.name, dailyYieldPct: plan.daily_yield_pct, refBonusPct: plan.ref_bonus_pct },
    signals: daySignals(req.uid, new Date().toISOString().slice(0, 10)),
  });
});

// ---------- API: MOVIMENTI (transazioni reali) ----------
app.get('/api/transactions', auth, (req, res) => {
  const rows = db.prepare('SELECT id, kind, amount, balance_after, meta, created_at FROM ledger WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50').all(req.uid);
  const labels = { deposit: 'Deposito', withdraw: 'Prelievo', signal: 'Segnale', referral: 'Bonus invito', adjust: 'Correzione admin' };
  res.json({
    transactions: rows.map(r => ({
      id: r.id,
      kind: r.kind,
      label: labels[r.kind] || r.kind,
      meta: r.meta,
      amount: r.amount,
      balanceAfter: r.balance_after,
      date: r.created_at,
    })),
  });
});

// ---------- API: DEPOSITO ----------
app.post('/api/deposit', auth, (req, res) => {
  const { amount } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Importo invalido' });

  // Piano scelto esplicitamente, altrimenti il piu' alto attivabile con questo importo
  const chosen = findPlan(req.body && req.body.planId);
  const plan = chosen || bestPlanForAmount(amt);
  if (amt < plan.min_deposit) {
    return res.status(400).json({ error: 'Importo minimo per ' + plan.name + ': €' + plan.min_deposit });
  }

  // Inserisci deposito
  db.prepare(`
    INSERT INTO deposits (user_id, amount, plan_id, confirmed, created_at)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).run(req.uid, amt, plan.id);

  // Aggiorna saldo utente + piano attivo
  const newBalance = Math.round((req.user.balance + amt) * 100) / 100;
  db.prepare('UPDATE users SET balance = ?, plan_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, plan.id, req.uid);
  logLedger(req.uid, 'deposit', amt, newBalance, plan.name);

  // Bonus al referrer: SOLO se l'invitato deposita davvero
  let referrerBonus = 0;
  if (req.user.referred_by) {
    const referrer = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.referred_by);
    const bonus = Math.round(amt * (plan.ref_bonus_pct / 100) * 100) / 100;
    referrerBonus = bonus;
    db.prepare('UPDATE users SET balance = balance + ?, total_ref_deposits = total_ref_deposits + ? WHERE id = ?').run(bonus, amt, req.user.referred_by);
    db.prepare('UPDATE referrals SET active = 1, referrer_bonus = referrer_bonus + ? WHERE referrer_id = ? AND referee_id = ?').run(bonus, req.user.referred_by, req.uid);
    const refBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.referred_by).balance;
    logLedger(req.user.referred_by, 'referral', bonus, refBalance, 'bonus invito ' + req.user.email);
    if (referrer && referrer.referred_by) {
      const grandparentBonus = Math.round(bonus * 0.10 * 100) / 100;
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(grandparentBonus, referrer.referred_by);
    }
  }

  res.status(201).json({
    message: 'Deposito confermato. Fondi in elaborazione.',
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid)),
    deposit: { amount: amt, plan: plan.name, referrerBonus: referrerBonus },
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
  
  // Prelievo minimo 50€, fee 5% su tutti
  if (amount < CONFIG.WITHDRAW_MIN) {
    return res.status(400).json({ error: 'Prelievo minimo ' + CONFIG.WITHDRAW_MIN + '€' });
  }
  
  const fee = Math.round(amount * CONFIG.WITHDRAW_FEE_PCT * 100) / 100;
  const balance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.uid).balance;
  if (amount + fee > balance) return res.status(400).json({ error: 'Saldo insufficiente (fee inclusa)' });

  db.prepare(`
    INSERT INTO withdrawals (user_id, amount, fee, status, is_fast, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(req.uid, amount, fee, 'pending', 0);

  const left = Math.round((balance - amount - fee) * 100) / 100;
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(left, req.uid);
  logLedger(req.uid, 'withdraw', -(amount + fee), left, 'prelievo in verifica');
  
  res.status(201).json({
    message: 'Prelievo in elaborazione (verifica documenti richiesta)',
    withdrawal: {
      amount,
      fee,
      status: 'in_verifica',
      msg: 'Prelievo in verifica. L\'importo verrà rilasciato dopo la verifica del documento (30-45 giorni lavorativi).',
      isFast: false
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

// ---------- API: ATTIVITA' IN TEMPO REALE (movimenti reali, anonimi) ----------
app.get('/api/activity', (req, res) => {
  const rows = db.prepare(`
    SELECT l.kind, l.amount, l.created_at, u.username
    FROM ledger l JOIN users u ON u.id = l.user_id
    WHERE l.kind IN ('deposit', 'withdraw', 'signal')
    ORDER BY l.created_at DESC, l.id DESC LIMIT 12
  `).all();

  const items = rows.map(r => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(String(r.created_at).replace(' ', 'T') + 'Z').getTime()) / 60000));
    const who = String(r.username || '').replace(/[0-9]/g, '').slice(0, 8) || 'cliente';
    if (r.kind === 'deposit') return { type: 'deposit', text: who + ' ha depositato ' + Math.abs(r.amount).toFixed(0) + ' €', amount: r.amount, ago: mins };
    if (r.kind === 'withdraw') return { type: 'withdraw', text: who + ' ha avviato un prelievo di ' + Math.abs(r.amount).toFixed(0) + ' €', amount: r.amount, ago: mins };
    return { type: 'signal', text: who + ' ha chiuso un segnale su ' + (r.meta || 'mercato') + ' con ' + (r.amount >= 0 ? '+' : '') + r.amount.toFixed(2) + ' €', amount: r.amount, ago: mins };
  });

  res.json({ items });
});

// Contatori "live" della piattaforma (da dati reali)
app.get('/api/live', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const activeUsers = db.prepare("SELECT COUNT(DISTINCT user_id) c FROM sessions WHERE expires_at > CURRENT_TIMESTAMP").get().c;
  const paidToday = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM withdrawals WHERE date(created_at) = date('now')").get().s;
  const depToday = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM deposits WHERE confirmed = 1 AND date(created_at) = date('now')").get().s;
  const lastDeposit = db.prepare("SELECT created_at FROM deposits WHERE confirmed = 1 ORDER BY created_at DESC LIMIT 1").get();
  const lastAgo = lastDeposit
    ? Math.max(0, Math.round((Date.now() - new Date(String(lastDeposit.created_at).replace(' ', 'T') + 'Z').getTime()) / 60000))
    : null;
  res.json({
    online: activeUsers,
    watching: activeUsers,
    paidToday: paidToday,
    depositsToday: depToday,
    lastDepositAgo: lastAgo,
    members: totalUsers,
  });
});

// Le mie ultime operazioni (dashboard)
app.get('/api/my-activity', auth, (req, res) => {
  const rows = [];
  for (const d of db.prepare('SELECT amount, plan_id, created_at FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 6').all(req.uid)) {
    const p = db.prepare('SELECT name FROM plans WHERE id = ?').get(d.plan_id);
    rows.push({ type: 'deposit', text: 'Deposito su piano ' + (p ? p.name : 'Starter'), amount: d.amount, date: d.created_at });
  }
  for (const w of db.prepare('SELECT amount, status, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 6').all(req.uid)) {
    rows.push({
      type: 'withdraw',
      text: w.status === 'completed' ? 'Prelievo pagato' : w.status === 'rejected' ? 'Prelievo respinto' : 'Prelievo in verifica',
      amount: -w.amount, date: w.created_at,
    });
  }
  for (const s of db.prepare('SELECT profits, day FROM signals WHERE user_id = ? ORDER BY day DESC LIMIT 5').all(req.uid)) {
    let profit = 0; try { profit = JSON.parse(s.profits).reduce((a, b) => a + b, 0); } catch (e) { /* ignora */ }
    if (profit > 0) rows.push({ type: 'yield', text: 'Segnali chiusi in profitto', amount: profit, date: s.day + ' 12:00:00' });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ items: rows.slice(0, 8) });
});

// ---------- API: ADMIN (pannello di controllo) ----------
// Accesso admin: account admin (email+password) OPPURE chiave admin
app.post('/api/admin/login', (req, res) => {
  const { email, password, key } = req.body || {};
  if (key && key === CONFIG.ADMIN_KEY) return res.json({ ok: true, key: CONFIG.ADMIN_KEY, name: 'Admin', email: CONFIG.ADMIN_EMAIL });
  if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim());
  if (!user || hashPw(password) !== user.password_hash) return res.status(401).json({ error: 'Credenziali non valide' });
  if (!user.is_admin) return res.status(403).json({ error: 'Questo account non e amministratore' });

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires);
  res.json({ ok: true, token, name: user.username, email: user.email });
});

app.get('/api/admin/overview', adminAuth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const totalDeposited = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE confirmed = 1").get().s;
  const totalBalance = db.prepare('SELECT COALESCE(SUM(balance),0) AS s FROM users').get().s;
  const inactiveUsers = db.prepare('SELECT COUNT(*) AS c FROM users u WHERE NOT EXISTS (SELECT 1 FROM deposits d WHERE d.user_id = u.id AND d.confirmed = 1)').get().c;
  const pendingWithdrawals = db.prepare(`
    SELECT w.id, u.email, w.amount, w.fee, w.created_at AS date
    FROM withdrawals w JOIN users u ON u.id = w.user_id
    WHERE w.status = 'pending' ORDER BY w.created_at DESC
  `).all();
  const recentWithdrawals = db.prepare(`
    SELECT w.id, u.email, w.amount, w.fee, w.status, w.created_at AS date
    FROM withdrawals w JOIN users u ON u.id = w.user_id
    ORDER BY w.created_at DESC LIMIT 20
  `).all();
  res.json({ totalUsers, totalDeposited, totalBalance, inactiveUsers, pendingWithdrawals, recentWithdrawals });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.username AS name, u.balance, u.plan_id, u.is_admin, u.referral_code, u.referred_by, u.created_at,
      p.name AS plan,
      (SELECT COALESCE(SUM(amount),0) FROM deposits d WHERE d.user_id = u.id AND d.confirmed = 1) AS deposited,
      (SELECT COUNT(*) FROM users x WHERE x.referred_by = u.id) AS invites,
      (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id) AS refCount,
      (SELECT COALESCE(SUM(referrer_bonus),0) FROM referrals r WHERE r.referrer_id = u.id) AS refEarned
    FROM users u LEFT JOIN plans p ON p.id = u.plan_id
    ORDER BY u.id
  `).all();
  res.json({ users });
});

app.post('/api/admin/set-balance', adminAuth, (req, res) => {
  const { id, balance } = req.body;
  const uid = parseInt(id, 10);
  const b = parseFloat(balance);
  if (!uid || isNaN(b) || b < 0) return res.status(400).json({ error: 'id o saldo non validi' });
  const u = db.prepare('SELECT id, balance FROM users WHERE id = ?').get(uid);
  if (!u) return res.status(404).json({ error: 'Utente non trovato' });
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(b, uid);
  logLedger(uid, 'adjust', b - u.balance, b, 'correzione admin');
  res.json({ ok: true, user: { id: uid, balance: b } });
});

// Ledger completo (tutte le variazioni di saldo)
app.get('/api/admin/ledger', adminAuth, (req, res) => {
  const entries = db.prepare(`
    SELECT l.id, l.user_id, u.email, l.kind, l.amount, l.balance_after, l.meta, l.created_at
    FROM ledger l JOIN users u ON u.id = l.user_id
    ORDER BY l.created_at DESC, l.id DESC LIMIT 200
  `).all();
  res.json({
    entries: entries.map(e => ({
      id: e.id, userId: e.user_id, email: e.email, kind: e.kind,
      amount: e.amount, balanceAfter: e.balance_after, meta: e.meta, createdAt: e.created_at,
    })),
  });
});

app.post('/api/admin/resolve-withdrawal', adminAuth, (req, res) => {
  const { id, email, date, status } = req.body;
  if (!['pagato', 'respinto'].includes(status)) return res.status(400).json({ error: 'Parametri non validi' });

  let w = null;
  if (id) w = db.prepare("SELECT id FROM withdrawals WHERE id = ? AND status = 'pending'").get(parseInt(id, 10));
  if (!w && email && date) {
    const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!u) return res.status(404).json({ error: 'Utente non trovato' });
    w = db.prepare("SELECT id FROM withdrawals WHERE user_id = ? AND created_at = ? AND status = 'pending'").get(u.id, date);
  }
  if (!w) return res.status(404).json({ error: 'Prelievo non trovato o gia risolto' });

  db.prepare('UPDATE withdrawals SET status = ? WHERE id = ?').run(status === 'pagato' ? 'completed' : 'rejected', w.id);
  res.json({ ok: true, status: status === 'pagato' ? 'Pagato' : 'Respinto (KYC)' });
});

// ---------- API: ADMIN - GESTIONE DEPOSITI ----------
app.get('/api/admin/deposits', adminAuth, (req, res) => {
  const deposits = db.prepare(`
    SELECT d.id, u.id AS userId, u.email, u.username AS name, d.amount, d.confirmed, d.created_at AS date, p.name AS plan
    FROM deposits d JOIN users u ON u.id = d.user_id LEFT JOIN plans p ON p.id = d.plan_id
    ORDER BY d.created_at DESC LIMIT 100
  `).all();
  res.json({ deposits });
});

app.post('/api/admin/deposit-status', adminAuth, (req, res) => {
  const { id, status } = req.body;
  const dep = db.prepare('SELECT * FROM deposits WHERE id = ?').get(parseInt(id, 10));
  if (!dep) return res.status(404).json({ error: 'Deposito non trovato' });

  if (status === 'confermato') {
    db.prepare('UPDATE deposits SET confirmed = 1 WHERE id = ?').run(dep.id);
    return res.json({ ok: true, status: 'Confermato' });
  }

  if (status === 'annullato') {
    if (dep.confirmed) {
      // Tolgo dal saldo dell'utente l'importo che non e' stato realmente pagato
      db.prepare('UPDATE users SET balance = MAX(balance - ?, 0) WHERE id = ?').run(dep.amount, dep.user_id);
      // E tolgo il bonus dato al referrer
      const plan = db.prepare('SELECT ref_bonus_pct FROM plans WHERE id = ?').get(dep.plan_id);
      const bonus = Math.round(dep.amount * ((plan ? plan.ref_bonus_pct : 0) / 100) * 100) / 100;
      const owner = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(dep.user_id);
      if (owner && owner.referred_by && bonus > 0) {
        db.prepare('UPDATE users SET balance = MAX(balance - ?, 0) WHERE id = ?').run(bonus, owner.referred_by);
        db.prepare('UPDATE referrals SET referrer_bonus = MAX(referrer_bonus - ?, 0) WHERE referrer_id = ? AND referee_id = ?').run(bonus, owner.referred_by, dep.user_id);
      }
    }
    db.prepare('DELETE FROM deposits WHERE id = ?').run(dep.id);
    return res.json({ ok: true, status: 'Annullato' });
  }

  res.status(400).json({ error: 'Stato non valido' });
});

// Numeri di oggi per il pannello
app.get('/api/admin/daily', adminAuth, (req, res) => {
  const newUsers = db.prepare("SELECT COUNT(*) c FROM users WHERE date(created_at) = date('now')").get().c;
  const deposits = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM deposits WHERE confirmed = 1 AND date(created_at) = date('now')").get();
  const withdrawals = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM withdrawals WHERE date(created_at) = date('now')").get();
  const paid = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM withdrawals WHERE status = 'completed' AND date(created_at) = date('now')").get().s;
  const pending = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM withdrawals WHERE status = 'pending'").get();
  res.json({
    newUsers,
    depositsCount: deposits.c, depositsSum: deposits.s,
    withdrawalsCount: withdrawals.c, withdrawalsSum: withdrawals.s,
    paidToday: paid,
    pendingCount: pending.c, pendingSum: pending.s,
  });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('QuantX AI server attivo su http://localhost:' + PORT);
  console.log('   - Piani: 3% / 4.5% / 6% / 8% al giorno');
  console.log('   - Bonus referral: 10-17% (solo se gli invitati depositano)');
  console.log('   - Segnali: 3 al giorno alle ore ' + CONFIG.SIGNAL_HOURS.join(', '));
  console.log('   - Prelievi: minimo EUR ' + CONFIG.WITHDRAW_MIN + ', fee ' + (CONFIG.WITHDRAW_FEE_PCT * 100) + '%, verifica documenti');
  console.log('   - Admin key: ' + CONFIG.ADMIN_KEY);
});

module.exports = app;