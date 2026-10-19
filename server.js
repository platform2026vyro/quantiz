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

  // Posizioni: ogni acquisto di piano e' una posizione (si possono comprare piu' piani)
  db.exec(`CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_plans_user ON user_plans(user_id)');

  // Riempie le posizioni con i depositi storici (una volta sola)
  const nPos = db.prepare('SELECT COUNT(*) AS c FROM user_plans').get().c;
  if (nPos === 0) {
    const add = db.prepare("INSERT INTO user_plans (user_id, plan_id, amount, status, created_at) VALUES (?, ?, ?, 'active', ?)");
    for (const d of db.prepare('SELECT user_id, amount, plan_id, created_at FROM deposits WHERE confirmed = 1 ORDER BY created_at').all()) {
      add.run(d.user_id, d.plan_id, d.amount, d.created_at);
    }
  }
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
  
  // Rendita giornaliera: calcolata su ogni posizione attiva, una volta al giorno
  const today = new Date().toISOString().slice(0, 10);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id) || { daily_yield_pct: 0, name: 'Starter' };
  let yieldAmount = 0;
  let newBalance = user.balance;
  if (user.last_yield_date !== today) {
    const positions = userPositions(user.id);
    if (positions.length) {
      for (const pos of positions) {
        yieldAmount += Math.round(pos.amount * (pos.daily_yield_pct / 100) * 100) / 100;
      }
    } else {
      yieldAmount = Math.round(user.balance * (plan.daily_yield_pct / 100) * 100) / 100;
    }
    yieldAmount = Math.round(yieldAmount * 100) / 100;
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
  const plan = db.prepare('SELECT name FROM plans WHERE id = ?').get(user.plan_id);
  const ownDeposits = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM deposits WHERE user_id = ? AND confirmed = 1').get(user.id).s;
  const pos = db.prepare(`
    SELECT COUNT(*) AS c, COALESCE(SUM(up.amount),0) AS s,
           COALESCE(SUM(up.amount * p.daily_yield_pct / 100.0),0) AS y
    FROM user_plans up JOIN plans p ON p.id = up.plan_id
    WHERE up.user_id = ? AND up.status = 'active'
  `).get(user.id);
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
    activePlans: pos.c,
    investedInPlans: Math.round(pos.s * 100) / 100,
    dailyYieldTotal: Math.round(pos.y * 100) / 100,
    isAdmin: !!user.is_admin,
  };
}

app.get('/api/me', auth, (req, res) => {
  const row = ensureSignals(req.uid);
  res.json({ user: publicUser(req.user), signals: { claimed: JSON.parse(row.claimed), profits: JSON.parse(row.profits) } });
});

// ---------- API: GIOCATE GIORNALIERE (3 segnali ad orari precisi) ----------
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
  
  // Genera profitto (o perdita) realistico
  const profit = generateSignalProfit(req.uid, i);
  
  // Aggiunge il profitto/perdita al saldo (se negativo, lo sottrae)
  const newBalance = Math.round((req.user.balance + profit) * 100) / 100;
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, req.uid);
  
  // Traccia il segnale
  claimed.push(i);
  profits.push(profit);
  db.prepare('UPDATE signals SET claimed = ?, profits = ? WHERE user_id = ? AND day = ?')
    .run(JSON.stringify(claimed), JSON.stringify(profits), req.uid, row.day);
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid);
  res.json({ 
    profit, 
    user: publicUser(user), 
    signals: { claimed, profits },
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

// ---------- API: ATTIVA PIANO (crea una posizione: piu' piani per utente) ----------
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

// Posizioni attive dell'utente
function userPositions(userId) {
  return db.prepare(`
    SELECT up.id, up.plan_id, up.amount, up.status, up.created_at, p.name, p.daily_yield_pct
    FROM user_plans up JOIN plans p ON p.id = up.plan_id
    WHERE up.user_id = ? AND up.status = 'active' ORDER BY up.created_at DESC
  `).all(userId);
}

app.post('/api/activate-plan', auth, (req, res) => {
  const plan = findPlan(req.body && req.body.plan);
  if (!plan) return res.status(400).json({ error: 'Piano non valido' });

  const cost = plan.min_deposit;
  const balance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.uid).balance;
  if (balance < cost) {
    return res.status(400).json({
      error: 'Capitale insufficiente per attivare ' + plan.name,
      need: cost, balance: balance,
      message: 'Deposita ' + cost + ' euro o piu nel pannello, poi attiva il piano.',
    });
  }

  // Crea la posizione (il piano non e' unico: si possono attivare piu' piani)
  const pos = db.prepare("INSERT INTO user_plans (user_id, plan_id, amount, status, created_at) VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)")
    .run(req.uid, plan.id, cost);

  const left = Math.round((balance - cost) * 100) / 100;
  db.prepare('UPDATE users SET balance = ?, plan_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(left, plan.id, req.uid);

  res.status(201).json({
    plan: { id: plan.id, name: plan.name, minDeposit: plan.min_deposit, maxDeposit: plan.max_deposit, dailyYieldPct: plan.daily_yield_pct, refBonusPct: plan.ref_bonus_pct },
    position: { id: pos.lastInsertRowid, amount: cost },
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid)),
  });
});

// ---------- API: POSIZIONI (i piani attivi) ----------
app.get('/api/positions', auth, (req, res) => {
  const positions = userPositions(req.uid).map(r => ({
    id: r.id, planId: r.plan_id, plan: r.name, amount: r.amount,
    dailyYield: Math.round(r.amount * (r.daily_yield_pct / 100) * 100) / 100,
    dailyYieldPct: r.daily_yield_pct, status: r.status, since: r.created_at,
  }));
  res.json({
    positions,
    count: positions.length,
    totalInvested: Math.round(positions.reduce((a, p) => a + p.amount, 0) * 100) / 100,
    dailyYield: Math.round(positions.reduce((a, p) => a + p.dailyYield, 0) * 100) / 100,
  });
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

  // Aggiorna il saldo (il piano si attiva a parte, cosi' se ne possono comprare piu')
  const newBalance = Math.round((req.user.balance + amt) * 100) / 100;
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, req.uid);

  // Bonus al referrer: SOLO se l'invitato deposita davvero
  let referrerBonus = 0;
  if (req.user.referred_by) {
    const referrer = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.referred_by);
    const bonus = Math.round(amt * (plan.ref_bonus_pct / 100) * 100) / 100;
    referrerBonus = bonus;
    db.prepare('UPDATE users SET balance = balance + ?, total_ref_deposits = total_ref_deposits + ? WHERE id = ?').run(bonus, amt, req.user.referred_by);
    db.prepare('UPDATE referrals SET active = 1, referrer_bonus = referrer_bonus + ? WHERE referrer_id = ? AND referee_id = ?').run(bonus, req.user.referred_by, req.uid);
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

// ---------- API: ATTIVITA' IN TEMPO REALE (ticker pubblico) ----------
const FAKE = [
  ['Marco R.', 'Milano'], ['Giulia B.', 'Roma'], ['Andrea P.', 'Torino'], ['Luca M.', 'Napoli'],
  ['Sara T.', 'Bologna'], ['Davide C.', 'Firenze'], ['Elena F.', 'Verona'], ['Matteo G.', 'Bari'],
  ['Chiara L.', 'Palermo'], ['Federica N.', 'Genova'], ['Alessandro V.', 'Padova'], ['Martina S.', 'Cagliari'],
  ['Simone D.', 'Parma'], ['Valentina R.', 'Catania'], ['Riccardo B.', 'Bergamo'], ['Ilaria M.', 'Modena'],
];
const AMOUNTS = [10, 25, 50, 80, 100, 150, 200, 300, 500, 750, 1000, 1500];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

app.get('/api/activity', (req, res) => {
  const items = [];
  for (let i = 0; i < 8; i++) {
    const [name, city] = randomFrom(FAKE);
    const roll = Math.random();
    if (roll < 0.55) {
      const amt = randomFrom(AMOUNTS);
      items.push({ type: 'deposit', text: name + ' (' + city + ') ha depositato ' + amt + ' €', amount: amt, ago: 1 + Math.floor(Math.random() * 40) });
    } else if (roll < 0.85) {
      const amt = randomFrom([20, 30, 45, 60, 90, 120, 250, 400]);
      items.push({ type: 'withdraw', text: name + ' (' + city + ') ha prelevato ' + amt + ' €', amount: amt, ago: 1 + Math.floor(Math.random() * 40) });
    } else {
      const pct = (Math.random() * 2 + 0.5).toFixed(2);
      items.push({ type: 'signal', text: name + ' ha chiuso un trade ' + (Math.random() > 0.5 ? 'BTC/USDT' : 'ETH/USDT') + ' +' + pct + '%', amount: 0, ago: 1 + Math.floor(Math.random() * 40) });
    }
  }
  items.sort((a, b) => a.ago - b.ago);
  res.json({ items });
});

// Contatori "live" della piattaforma
app.get('/api/live', (req, res) => {
  const realUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const paidToday = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM withdrawals WHERE date(created_at) = date('now')").get().s;
  const depToday = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM deposits WHERE confirmed = 1 AND date(created_at) = date('now')").get().s;
  res.json({
    online: 3180 + realUsers * 41 + Math.floor(Math.random() * 280),
    watching: 38 + Math.floor(Math.random() * 95),
    paidToday: Math.round(142000 + paidToday * 12 + Math.random() * 90000),
    depositsToday: Math.round(38900 + depToday * 9 + Math.random() * 25000),
    lastDepositAgo: 1 + Math.floor(Math.random() * 8),
    members: 11840 + realUsers,
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
      (SELECT COALESCE(SUM(referrer_bonus),0) FROM referrals r WHERE r.referrer_id = u.id) AS refEarned,
      (SELECT COUNT(*) FROM user_plans up WHERE up.user_id = u.id AND up.status = 'active') AS activePlans,
      (SELECT COALESCE(SUM(up.amount),0) FROM user_plans up WHERE up.user_id = u.id AND up.status = 'active') AS investedInPlans
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
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(uid);
  if (!u) return res.status(404).json({ error: 'Utente non trovato' });
  db.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(b, uid);
  res.json({ ok: true, user: { id: uid, balance: b } });
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
  console.log('   - Prelievi: istantanei fino a EUR 30, sopra serve verifica');
  console.log('   - Admin key: ' + CONFIG.ADMIN_KEY);
});

module.exports = app;