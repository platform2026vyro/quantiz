// Test finale: pagine nuove, dati reali, flussi
const https = require('https');
const EDGE = '104.21.4.83';

function call(path, method, bodyObj, headers) {
  return new Promise((resolve) => {
    const data = bodyObj ? JSON.stringify(bodyObj) : null;
    const h = Object.assign({ Host: 'quantx-ai.top' }, headers || {});
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const r = https.request({ hostname: EDGE, servername: 'quantx-ai.top', path, method: method || 'GET', headers: h }, (res) => {
      let out = '';
      res.on('data', (c) => out += c);
      res.on('end', () => { let j = null; try { j = JSON.parse(out); } catch (e) { } resolve({ status: res.statusCode, j, text: out }); });
    });
    r.on('error', (e) => resolve({ status: 0, j: null, text: e.message }));
    if (data) r.write(data);
    r.end();
  });
}
const auth = (t) => ({ Authorization: 'Bearer ' + t });

(async () => {
  console.log('=== PAGINE (design nuovo) ===');
  for (const p of ['/', '/plans.html', '/app.html', '/amici.html', '/admin.html', '/style.css']) {
    const r = await call(p);
    console.log(p, '->', r.status);
  }

  console.log('\n=== NESSUN EMOJI / GLOW NELLE PAGINE ===');
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u;
  for (const p of ['/', '/plans.html', '/app.html', '/amici.html', '/admin.html']) {
    const r = await call(p);
    const found = r.text.match(emoji);
    console.log(p, found ? 'EMOJI: ' + found.slice(0, 6).join(' ') : 'pulito');
  }

  console.log('\n=== API DATI REALI ===');
  const stats = await call('/api/stats');
  console.log('/api/stats ->', stats.status, JSON.stringify(stats.j));
  const live = await call('/api/live');
  console.log('/api/live ->', live.status, JSON.stringify(live.j));
  const act = await call('/api/activity');
  console.log('/api/activity ->', act.status, (act.j.items || []).length, 'eventi reali');

  console.log('\n=== PORTFOLIO UTENTE (curva reale) ===');
  const login = await call('/api/login', 'POST', { email: 'test239017@quantx.ai', password: 'Test2026!' });
  const t = login.j.token;
  const pf = await call('/api/portfolio', 'GET', null, auth(t));
  console.log('portfolio ->', pf.status, 'saldo', pf.j.balance, '· punti curva', (pf.j.series || []).length, '· segnali oggi', (pf.j.signals || []).length);
  if (pf.j.signals && pf.j.signals[0]) console.log('  segnale 0:', JSON.stringify(pf.j.signals[0]));
  const tx = await call('/api/transactions', 'GET', null, auth(t));
  console.log('transazioni ->', tx.status, (tx.j.transactions || []).length, 'movimenti');
  const me = await call('/api/me', 'GET', null, auth(t));
  console.log('/api/me ->', me.status, 'segnali oggi:', (me.j.today || []).length, '· isAdmin:', me.j.user.isAdmin);

  console.log('\n=== ADMIN ===');
  const adm = await call('/api/admin/login', 'POST', { email: 'asgaga90@libero.it', password: 'CeraseIbiza66!' });
  const k = adm.j.token;
  console.log('login admin ->', adm.status, k ? 'OK' : 'NO');
  const ov = await call('/api/admin/overview', 'GET', null, { 'X-Admin-Key': k });
  console.log('overview ->', ov.status, JSON.stringify(ov.j).slice(0, 200));
  const led = await call('/api/admin/ledger', 'GET', null, { 'X-Admin-Key': k });
  console.log('ledger ->', led.status, (led.j.entries || []).length, 'voci');
  const dep = await call('/api/admin/deposits', 'GET', null, { 'X-Admin-Key': k });
  console.log('depositi ->', dep.status, (dep.j.deposits || []).length, 'righe');

  console.log('\n=== SEGNALI FUORI ORARIO ===');
  const sig = await call('/api/claim-signal', 'POST', { index: 0 }, auth(t));
  console.log('claim segnale ->', sig.status, sig.j.error || 'OK');
})().catch(e => console.error('ERR', e.message));
