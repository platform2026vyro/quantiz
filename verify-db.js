const Database = require('better-sqlite3');
const db = new Database('./data/quantx.db');

console.log('📊 Verifica database QuantX\n');

console.log('TABELLA PLANS:');
const plans = db.prepare('SELECT * FROM plans').all();
plans.forEach(p => {
  console.log(`  ✓ ${p.name}: €${p.min_deposit}-€${p.max_deposit || '∞'}, yield ${p.base_yield}%, bonus ${p.referral_bonus_pct}%`);
});

console.log('\nTABELLA USERS:');
const users = db.prepare('SELECT * FROM users').all();
users.forEach(u => {
  console.log(`  ✓ ${u.email} (${u.username}), referral: ${u.referral_code}`);
});

console.log('\nTABELLA SETTINGS:');
const settings = db.prepare('SELECT * FROM settings').all();
settings.forEach(s => {
  console.log(`  ✓ ${s.key} = ${s.value}`);
});

db.close();
console.log('\n✅ Database verificato con successo!');