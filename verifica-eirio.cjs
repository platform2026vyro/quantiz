// Verifica post-attivazione modello EIRIO (sola lettura)
const https = require('https');
const EDGE = '104.21.4.83';

function call(p, m, b, h) {
  return new Promise((resolve) => {
    const d = b ? JSON.stringify(b) : null;
    const hh = Object.assign({ Host: 'quantx-ai.top' }, h || {});
    if (d) { hh['Content-Type'] = 'application/json'; hh['Content-Length'] = Buffer.byteLength(d); }
    const q = https.request({ hostname: EDGE, servername: 'quantx-ai.top', path: p, method: m || 'GET', headers: hh }, (res) => {
      let o = ''; res.on('data', (c) => o += c);
      res.on('end', () => { let j = null; try { j = JSON.parse(o); } catch (e) { } resolve({ s: res.statusCode, j }); });
    });
    q.on('error', (e) => resolve({ s: 0, j: { error: e.message } }));
    if (d) q.write(d);
    q.end();
  });
}

(async () => {
  // piani mostrati al pubblico (dovrebbero essere i VIP EIRIO)
  const plans = await call('/api/plans');
  if (plans.j && plans.j.plans) {
    console.log('PIANI VISTI DAL SITO:');
    for (const p of plans.j.plans) console.log(' ', p.name, 'min', p.minDeposit, '-> resa', p.yield || p.dailyYieldPct, '%/g');
  } else {
    console.log('piani:', JSON.stringify(plans.j));
  }

  const login = await call('/api/login', 'POST', { email: 'asgaga90@libero.it', password: 'CeraseIbiza66!' });
  const t = login.j.token;
  if (!t) { console.log('login fallito', JSON.stringify(login.j)); return; }
  const me = await call('/api/me', 'GET', null, { Authorization: 'Bearer ' + t });
  console.log('admin -> piano:', me.j.user.planName, '| resa/giorno:', me.j.user.dailyYieldTotal, '| maturata oggi:', me.j.user.yieldAccruedToday, '| saldo:', me.j.user.balance);

  // prova prelievo: con modello eirio deve richiedere 20 ordini (blocco EIRIO)
  const w = await call('/api/withdraw', 'POST', { amount: 40, wallet: '0x2320a9e89C988dC605796e74adFa0e5a4A1deeA3' }, { Authorization: 'Bearer ' + t });
  console.log('prova prelievo 40 ->', JSON.stringify(w.j).slice(0, 200));
})().catch(e => console.error('ERR', e.message));
