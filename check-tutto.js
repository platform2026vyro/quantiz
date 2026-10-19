// Verifica completa: pagine, API, flussi, controlli admin
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
const ok = (b) => b ? 'OK' : 'NO';

(async () => {
  const out = [];

  // 1) Pagine pubbliche e strumenti
  for (const p of ['/', '/plans.html', '/app.html', '/amici.html', '/admin.html']) {
    const r = await call(p);
    out.push('pagina ' + p + ' -> ' + r.status);
  }

  // 2) Nessuna traccia "albero" e nessun link admin nelle pagine pubbliche
  let dirty = [];
  for (const p of ['/', '/plans.html', '/app.html', '/amici.html', '/landing.js', '/app.js', '/amici.js']) {
    const r = await call(p);
    if (/albero|natal|panettone/i.test(r.text)) dirty.push(p + ':ALBERO');
    if (p !== '/admin.html' && /admin\.html/.test(r.text)) dirty.push(p + ':LINK-ADMIN');
  }
  out.push('pagine pulite (niente albero, niente link admin) -> ' + (dirty.length ? 'SPORCHE: ' + dirty.join(', ') : 'OK'));

  // 3) API "vive"
  const live = await call('/api/live');
  const act = await call('/api/activity');
  out.push('api live -> ' + live.status + ' (online ' + (live.j && live.j.online) + ', pagato oggi ' + (live.j && live.j.paidToday) + ')');
  out.push('api attivita -> ' + act.status + ' (' + ((act.j && act.j.items) || []).length + ' eventi)');

  // 4) Piani e registro con invito
  const plans = await call('/api/plans');
  out.push('piani -> ' + plans.status + ' (' + (plans.j || []).map(p => p.name + ' ' + p.dailyYieldPct + '%/g, bonus ' + p.refBonusPct + '%').join(' · ') + ')');

  const email = 'ver' + Date.now().toString().slice(-7) + '@quantx.ai';
  const reg = await call('/api/register', 'POST', { email, password: 'Verifica123!', name: 'Verifica Test', ref: 'QX0004' });
  const t = reg.j && reg.j.token;
  out.push('registro con invito -> ' + reg.status + ' (agganciato al referrer: ' + (reg.j && reg.j.user && reg.j.user.referredBy ? 'SI id ' + reg.j.user.referredBy : 'NO') + ')');

  if (t) {
    const sig = await call('/api/claim-signal', 'POST', { index: 0 }, auth(t));
    out.push('segnale giornaliero -> ' + sig.status + ' (profitto ' + (sig.j && sig.j.profit) + ')');
    const dup = await call('/api/claim-signal', 'POST', { index: 0 }, auth(t));
    out.push('segnale doppio -> ' + dup.status + ' (' + (dup.j && dup.j.error) + ')');

    const dep = await call('/api/deposit', 'POST', { amount: 60 }, auth(t));
    out.push('deposito 60 -> ' + dep.status + ' piano ' + (dep.j.deposit && dep.j.deposit.plan) + ' bonus referrer ' + (dep.j.deposit && dep.j.deposit.referrerBonus));

    const w1 = await call('/api/withdraw', 'POST', { amount: 20 }, auth(t));
    const w2 = await call('/api/withdraw', 'POST', { amount: 45 }, auth(t));
    out.push('prelievo 20 -> ' + (w1.j.withdrawal && w1.j.withdrawal.status) + ' | prelievo 45 -> ' + (w2.j.withdrawal && w2.j.withdrawal.status) + ' (fee ' + (w2.j.withdrawal && w2.j.withdrawal.fee) + ')');
    out.push('saldo utente dopo -> ' + (w2.j.user && w2.j.user.balance));
  }

  // 5) Il bonus referral e' andato al proprietario del codice (prova dello schema)
  const owner = await call('/api/login', 'POST', { email: 'test239017@quantx.ai', password: 'Test2026!' });
  const refs = await call('/api/referrals', 'GET', null, auth(owner.j && owner.j.token));
  out.push('referral del proprietario del codice -> ' + refs.status + ' amici ' + (refs.j && refs.j.count) + ' attivi ' + (refs.j && refs.j.activeCount) + ' bonus ' + (refs.j && refs.j.earned));

  // 6) Controlli admin
  const adm = await call('/api/admin/login', 'POST', { email: 'asgaga90@libero.it', password: 'CeraseIbiza66!' });
  const k = adm.j && adm.j.token;
  out.push('login admin -> ' + adm.status + ' (token ' + ok(k) + ')');
  if (k) {
    const ov = await call('/api/admin/overview', 'GET', null, { 'X-Admin-Key': k });
    const dep = await call('/api/admin/deposits', 'GET', null, { 'X-Admin-Key': k });
    const daily = await call('/api/admin/daily', 'GET', null, { 'X-Admin-Key': k });
    const users = await call('/api/admin/users', 'GET', null, { 'X-Admin-Key': k });
    out.push('admin -> overview ' + ov.status + ' (utenti ' + (ov.j && ov.j.totalUsers) + ', depositi incassati ' + (ov.j && ov.j.totalDeposited) + ', saldi virtuali ' + (ov.j && ov.j.totalBalance) + ', da decidere ' + ((ov.j && ov.j.pendingWithdrawals) || []).length + ')');
    out.push('admin -> depositi ' + dep.status + ' (' + ((dep.j && dep.j.deposits) || []).length + ' righe) · daily ' + daily.status + ' · utenti ' + users.status + ' (' + ((users.j && users.j.users) || []).length + ')');

    // il prelievo grande resta in attesa finche' non decide l'admin
    const pend = (ov.j && ov.j.pendingWithdrawals) || [];
    if (pend.length) {
      const r = await call('/api/admin/resolve-withdrawal', 'POST', { id: pend[0].id, status: 'respinto' }, { 'X-Admin-Key': k });
      out.push('admin respinge prelievo ' + pend[0].amount + ' -> ' + r.status + ' ' + (r.j && r.j.status));
    }
  }

  // 7) Login normale NON e' admin
  const noAdm = await call('/api/admin/overview', 'GET', null, auth(t));
  out.push('utente normale che prova l\'admin -> ' + noAdm.status + ' (' + (noAdm.j && noAdm.j.error) + ')');

  console.log(out.join('\n'));
})().catch(e => console.error('ERR', e.message));
