// QuantX - Creazione database SQLite per la piattaforma
// Tabele: users, plans, deposits, withdrawals, referrals, signals, activations

const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'quantx.db');

// Assicura che la cartata data esista
const fs = require('fs');
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// Elimina database esistente se presente
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log('🗑️  Database esistente eliminato\n');
}

console.log('🚀 Creazione database QuantX...\n');

const db = new Database(DB_FILE);
console.log('✅ Database aperto:', DB_FILE);

// TABELLE
const schema = `
-- Utenti registrati
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  password_hash TEXT NOT NULL,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  wallet_address TEXT,
  balance DECIMAL(15,2) DEFAULT 0,
  active_plan_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Piani di investimento (4 tier: Starter, Silver, Gold, Titan)
CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  min_deposit DECIMAL(10,2) NOT NULL,
  max_deposit DECIMAL(10,2),
  base_yield DECIMAL(5,2) NOT NULL,
  referral_bonus_pct DECIMAL(5,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Depositi degli utenti
CREATE TABLE deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  plan_id INTEGER,
  wallet_tx_hash TEXT,
  status TEXT DEFAULT 'pending', -- pending, confirmed, failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- Prelievi degli utenti
CREATE TABLE withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, verified, completed, failed
  kyc_verified BOOLEAN DEFAULT 0,
  fee DECIMAL(10,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sistema di referral
CREATE TABLE referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referee_id INTEGER NOT NULL,
  bonus_amount DECIMAL(10,2) DEFAULT 0,
  bonus_pct DECIMAL(5,2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referee_id) REFERENCES users(id),
  UNIQUE(referrer_id, referee_id)
);

-- Attivazione piani (quando un utente attiva un piano dopo il segnale)
CREATE TABLE plan_activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  signal_id INTEGER,
  activation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME,
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);

-- Segnali quantistici generati dal bot
CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_number INTEGER NOT NULL, -- 1, 2, 3 (ore 9, 17, 21)
  yield_pct DECIMAL(5,2) NOT NULL,
  message TEXT,
  posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Token di sessione per login
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Log delle attività (audit trail)
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Settings della piattaforma
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

db.exec(schema);
console.log('✅ Tabele create con successo\n');

// INSERIMENTO DATI INIZIALI
// Insert plans (4 tier: Starter €10, Silver €50, Gold €200, Titan €500)
const plans = [
  { name: 'Starter', min: 10, max: 49, yield: 0.8, bonus: 5, desc: 'Piano entry-level per testare la piattaforma' },
  { name: 'Silver', min: 50, max: 199, yield: 1.2, bonus: 7, desc: 'Piano intermedio con miglior rendimento' },
  { name: 'Gold', min: 200, max: 499, yield: 1.8, bonus: 10, desc: 'Piano avanzato per investitori seri' },
  { name: 'Titan', min: 500, max: null, yield: 2.5, bonus: 15, desc: 'Piano premium con massimi benefici' }
];

const insertPlan = db.prepare('INSERT INTO plans (name, min_deposit, max_deposit, base_yield, referral_bonus_pct, description) VALUES (?, ?, ?, ?, ?, ?)');

plans.forEach(plan => {
  insertPlan.run(plan.name, plan.min, plan.max, plan.yield, plan.bonus, plan.desc);
  console.log(`   ➕ Piano: ${plan.name} (€${plan.min}-€${plan.max || '∞'}, yield ${plan.yield}%, bonus ${plan.bonus}%)`);
});

console.log('✅ Piani inseriti\n');

  // Insert demo user
  const demoPasswordHash = 'demo123_hashed'; // In produzione, usare bcrypt
  const insertDemoUser = db.prepare('INSERT INTO users (email, username, password_hash, referral_code, wallet_address, balance) VALUES (?, ?, ?, ?, ?, ?)');
  insertDemoUser.run('demo@quantx.ai', 'demo_user', demoPasswordHash, 'DEMO2026', 'TQxQuantum7X9F2kLmP4vR8sWzN1c', 0);
  console.log('   ➕ Utente demo: demo@quantx.ai');

  // Insert admin user
  const insertAdminUser = db.prepare('INSERT INTO users (email, username, password_hash, referral_code, balance) VALUES (?, ?, ?, ?, ?)');
  insertAdminUser.run('admin@quantx.ai', 'admin', 'admin123_hashed', 'ADMIN2026', 0);
  console.log('   ➕ Utente admin: admin@quantx.ai');
  
  console.log('✅ Utenti demo inseriti\n');

  // Insert settings
  const settings = [
    { key: 'platform_name', value: 'QuantX AI', desc: 'Nome della piattaforma' },
    { key: 'withdraw_fast_limit', value: '20', desc: 'Limite prelievo istantaneo (€)' },
    { key: 'withdraw_fee_pct', value: '2.5', desc: 'Fee prelievo sopra soglia (%)' },
    { key: 'kyc_required_above', value: '100', desc: 'KYC richiesto sopra questo importo (€)' },
    { key: 'referral_enabled', value: 'true', desc: 'Sistema referral attivo' },
    { key: 'max_referral_bonus', value: '15', desc: 'Bonus referral massimo (%)' }
  ];

  const insertSetting = db.prepare('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)');
  settings.forEach(s => {
    insertSetting.run(s.key, s.value, s.desc);
    console.log(`   ➕ Setting: ${s.key} = ${s.value}`);
  });

  console.log('✅ Settings inseriti\n');

// CHIUSURA E VERIFICA
db.close();

console.log('📊 Riepilogo database:');
console.log('   • Tabele create: users, plans, deposits, withdrawals, referrals, plan_activations, signals, sessions, activity_log, settings');
console.log('   • Piani inseriti: 4 (Starter, Silver, Gold, Titan)');
console.log('   • Utenti demo: 2 (demo@quantx.ai, admin@quantx.ai)');
console.log('   • Settings: 6 configurazioni base');
console.log('\n✅ Database QuantX creato con successo!');
console.log('   File:', DB_FILE);