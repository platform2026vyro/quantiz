// QuantX - Aggiorna yield e settings per schema Ponzi più aggressivo
// Truffatore thinking: yield alti per attrarre, prelievi bloccati sopra soglia

const Database = require('better-sqlite3');
const db = new Database('./data/quantx.db');

console.log('🎭 Aggiornamento impostazioni Ponzi QuantX...\n');

// Aggiorna i piani con yield più alti (tipico di uno schema Ponzi)
// Yield reali: 2-6% invece di 0.8-2.5%
const updatePlans = db.prepare(`
  UPDATE plans 
  SET base_yield = CASE name
    WHEN 'Starter' THEN 2.5
    WHEN 'Silver' THEN 3.5
    WHEN 'Gold' THEN 5.0
    WHEN 'Titan' THEN 6.5
  END,
  referral_bonus_pct = CASE name
    WHEN 'Starter' THEN 8
    WHEN 'Silver' THEN 10
    WHEN 'Gold' THEN 12
    WHEN 'Titan' THEN 15
  END,
  description = CASE name
    WHEN 'Starter' THEN 'Entry-level: 2.5%/giorno, perfetto per testare la piattaforma'
    WHEN 'Silver' THEN 'Intermedio: 3.5%/giorno, rendimento interessante'
    WHEN 'Gold' THEN 'Avanzato: 5%/giorno, per investitori seri'
    WHEN 'Titan' THEN 'Premium: 6.5%/giorno, massimi guadagni'
  END
`);

updatePlans.run();
console.log('✅ Piani aggiornati con yield Ponzi (2.5-6.5%/giorno)');

// Mostra i piani aggiornati
console.log('\n📈 Piani aggiornati:');
const plans = db.prepare('SELECT * FROM plans').all();
plans.forEach(p => {
  console.log(`   ${p.name}: €${p.min_deposit}-${p.max_deposit || '∞'}, yield ${p.base_yield}%, bonus ${p.referral_bonus_pct}%`);
});

// Aggiorna settings per essere più truffaldino
const updateSettings = db.prepare(`
  UPDATE settings 
  SET value = CASE key
    WHEN 'withdraw_fast_limit' THEN '25'
    WHEN 'withdraw_fee_pct' THEN '3.0'
    WHEN 'kyc_required_above' THEN '150'
    WHEN 'max_referral_bonus' THEN '15'
  END
`);

updateSettings.run();
console.log('\n✅ Settings aggiornati:');
console.log('   • Prelievo istantaneo fino: €25 (più alto per fiducia)');
console.log('   • Fee prelievo sopra soglia: 3.0% (blocca ritiri di massa)');
console.log('   • KYC richiesto sopra: €150 (più alto per non spaventare)');

// Mostra settings finali
console.log('\n📊 Settings finali:');
const settings = db.prepare('SELECT * FROM settings').all();
settings.forEach(s => {
  console.log(`   ✓ ${s.key} = ${s.value}`);
});

db.close();
console.log('\n🎭 Schema Ponzi QuantX ottimizzato per massimizzare ingressi e ritardare crollo!');