// QuantX AI - Dashboard: dati reali dal backend
const API = '';
const TOKEN_KEY = 'quantx_token';
const REF_KEY = 'quantx_ref';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + Math.abs(Number(n || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + Math.abs(Number(n || 0)).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const dt = (s) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

let token = localStorage.getItem(TOKEN_KEY);
const urlParams = new URLSearchParams(location.search);
const urlRef = (urlParams.get('ref') || '').toUpperCase().trim();
if (urlRef) localStorage.setItem(REF_KEY, urlRef);
let registerMode = urlParams.get('mode') === 'register' || !!urlRef;
let currentBalance = 0;

function toast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  setTimeout(() => t.classList.remove('show'), 3400);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); token = null; }
  return data;
}

async function withBtn(btn, label, fn) {
  if (btn) {
    btn.dataset.old = btn.textContent;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = label;
  }
  try { return await fn(); }
  finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = btn.dataset.old || btn.textContent;
    }
  }
}

function animateBalance(el, target) {
  if (!el) return;
  el.textContent = fmt(target);   // valore subito (rAF puo' non girare in tab nascosta)
  if (typeof document !== 'undefined' && document.hidden) return;
  const from = 0;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 700);
    el.textContent = fmt(from + (target - from) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- ACCESSO ----------
function applyAuthMode(reg) {
  registerMode = reg;
  $('reg-name-wrap').style.display = reg ? 'block' : 'none';
  $('reg-ref-wrap').style.display = reg ? 'block' : 'none';
  $('auth-title').textContent = reg ? 'Apri il tuo account' : 'Accedi al pannello';
  $('auth-sub').textContent = reg
    ? 'Trenta secondi e sei dentro. Il codice invito viene letto dal link.'
    : 'Gestisci piano, segnali e prelievi da un unico posto.';
  $('auth-btn').textContent = reg ? 'Crea account' : 'Accedi';
  $('auth-switch').textContent = reg ? 'Hai gia un account?' : 'Non hai un account?';
  $('auth-switch').nextElementSibling.textContent = reg ? 'Accedi' : 'Apri un account';
  if (reg && !$('auth-ref').value) $('auth-ref').value = localStorage.getItem(REF_KEY) || '';
}

function toggleAuth() { applyAuthMode(!registerMode); }

async function doAuth(btn) {
  const refCode = ($('auth-ref').value || localStorage.getItem(REF_KEY) || '').toUpperCase().trim();
  const payload = { email: $('auth-email').value.trim(), password: $('auth-pass').value, name: $('auth-name').value.trim(), ref: refCode };
  const data = await withBtn(btn, 'Verifica in corso...', () =>
    api(registerMode ? '/api/register' : '/api/login', { method: 'POST', body: JSON.stringify(payload) })
  );
  if (data.error) { $('auth-error').textContent = data.error; return; }
  token = data.token;
  localStorage.setItem(TOKEN_KEY, token);
  $('auth-error').textContent = '';
  enterDash();
}

// ---------- DASHBOARD ----------
async function enterDash() {
  const me = await api('/api/me');
  if (me.error) { localStorage.removeItem(TOKEN_KEY); token = null; return; }
  $('auth-view').style.display = 'none';
  $('dash-view').style.display = 'block';
  currentBalance = me.user.balance;

  animateBalance($('balance'), me.user.balance);
  $('balance-sub').textContent = 'Piano ' + (me.user.planName || 'Starter') + ' · rendimento ' + String((me.user.planYieldPct || 0)).replace('.', ',') + '% al giorno';
  $('plan-badge').textContent = me.user.planName || 'Starter';
  $('kpi-deposited').textContent = fmt0(me.user.totalDeposited);

  if (me.user.isAdmin) addAdminLink();
  renderSignals(me.today || []);
  loadPortfolio();
  loadTransactions();
  loadReferrals();
  loadWithdrawals();
  startFeed();
}

function addAdminLink() {
  const box = $('nav-links');
  if (!box || $('nav-admin')) return;
  const a = document.createElement('a');
  a.id = 'nav-admin';
  a.href = 'admin.html';
  a.className = 'btn btn-ghost';
  a.textContent = 'Console';
  box.insertBefore(a, box.firstChild);
}

// ---------- PORTFOLIO (curva reale) ----------
function drawChart(series) {
  const box = $('chart');
  if (!box) return;
  if (!series || series.length < 2) {
    box.innerHTML = '<div class="empty"><strong>Nessun movimento ancora</strong>La curva del saldo appare dopo il primo deposito.</div>';
    return;
  }
  const W = 640, H = 240, pad = { l: 10, r: 10, t: 14, b: 26 };
  const vals = series.map(s => s.v);
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals, 1);
  const toX = (i) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const toY = (v) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);

  const line = series.map((s, i) => (i === 0 ? 'M' : 'L') + toX(i).toFixed(1) + ',' + toY(s.v).toFixed(1)).join(' ');
  const area = line + ' L' + toX(series.length - 1).toFixed(1) + ',' + (H - pad.b) + ' L' + toX(0).toFixed(1) + ',' + (H - pad.b) + ' Z';
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = pad.t + f * (H - pad.t - pad.b);
    const v = max - f * (max - min);
    return '<line x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + y.toFixed(1) + '"/>' +
           '<text class="chart-axis" x="' + pad.l + '" y="' + (y - 5).toFixed(1) + '">' + fmt0(v) + '</text>';
  }).join('');

  box.innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#4C8DFF" stop-opacity="0.3"/>' +
      '<stop offset="100%" stop-color="#4C8DFF" stop-opacity="0"/></linearGradient></defs>' +
    '<g class="chart-grid">' + grid + '</g>' +
    '<path class="chart-area" d="' + area + '"/><path class="chart-line" d="' + line + '"/></svg>';
}

async function loadPortfolio() {
  const p = await api('/api/portfolio');
  if (p.error) return;
  drawChart(p.series);
  $('kpi-net').textContent = (p.netProfit >= 0 ? '+' : '') + fmt0(p.netProfit);
  $('kpi-net-sub').textContent = fmt0(p.deposited) + ' depositati · ' + fmt0(p.withdrawn) + ' prelievati';
  $('balance-sub').textContent = 'Piano ' + p.plan.name + ' · rendimento ' + String(p.plan.dailyYieldPct).replace('.', ',') + '% al giorno';
  $('plan-badge').textContent = p.plan.name;
  $('wd-hint').textContent = 'Il saldo disponibile: ' + fmt(currentBalance);
}

// ---------- SEGNALI ----------
function renderSignals(list) {
  if (!list || !list.length) {
    $('signals').innerHTML = '<div class="empty">Nessun segnale disponibile.</div>';
    return;
  }
  $('signal-count').textContent = list.filter(s => s.claimed).length + '/3 attivati';
  $('signals').innerHTML = list.map(s => {
    const cls = s.state === 'closed' ? 'closed' : '';
    let action, meta, badge;
    if (s.claimed) {
      const up = s.profit >= 0;
      action = '<span class="badge ' + (up ? 'success' : 'danger') + '">' + (up ? '+' : '') + fmt(s.profit) + '</span>';
      meta = (up ? 'Take profit raggiunto' : 'Stop loss colpito') + ' · chiuso';
      badge = 'Chiuso';
    } else if (s.state === 'available') {
      action = '<button class="btn btn-primary btn-sm" onclick="claimSignal(' + s.index + ', this)">Attiva</button>';
      meta = 'Disponibile ora';
      badge = 'Aperto';
    } else {
      action = '<span class="badge">Programmato</span>';
      meta = 'Apre alle ' + String(s.hour).padStart(2, '0') + ':00';
      badge = 'In attesa';
    }
    return '<div class="signal ' + cls + '">' +
      '<div class="info">' +
        '<h4>' + s.name + ' · ' + s.pair + ' <span class="badge ' + (s.direction === 'LONG' ? 'success' : 'danger') + '">' + s.direction + '</span></h4>' +
        '<div class="meta">Confidenza ' + s.confidence.toFixed(1) + '% · ' + meta + '</div>' +
      '</div>' +
      '<div class="values">' +
        '<div>Ingresso<b>' + s.entry.toFixed(4) + '</b></div>' +
        '<div>Take profit<b>' + s.tp.toFixed(4) + '</b></div>' +
        '<div>Stop loss<b>' + s.sl.toFixed(4) + '</b></div>' +
      '</div>' +
      '<div style="text-align:right">' + badge + '<div style="margin-top:6px">' + action + '</div></div>' +
    '</div>';
  }).join('');
}

async function claimSignal(i, btn) {
  const data = await withBtn(btn, 'Esecuzione...', () =>
    api('/api/claim-signal', { method: 'POST', body: JSON.stringify({ index: i }) })
  );
  if (data.error) { toast(data.error + (data.message ? ' — ' + data.message : ''), 'err'); return; }
  toast((data.profit >= 0 ? 'Trade chiuso in profitto: +' : 'Trade chiuso in perdita: ') + fmt(data.profit), data.profit >= 0 ? 'ok' : 'err');
  currentBalance = data.user.balance;
  animateBalance($('balance'), data.user.balance);
  const me = await api('/api/me');
  renderSignals(me.today || []);
  loadPortfolio();
  loadTransactions();
}

// ---------- MOVIMENTI ----------
async function loadTransactions() {
  const d = await api('/api/transactions');
  const body = $('tx-body');
  if (!body) return;
  const list = d.transactions || [];
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="4"><div class="empty"><strong>Nessun movimento</strong>Qui vedrai depositi, segnali e prelievi.</div></td></tr>';
    return;
  }
  body.innerHTML = list.map(t => {
    const up = t.amount >= 0;
    return '<tr>' +
      '<td>' + t.label + (t.meta ? '<div class="muted" style="font-size:12px">' + t.meta + '</div>' : '') + '</td>' +
      '<td class="muted nowrap">' + dt(t.date) + '</td>' +
      '<td class="right ' + (up ? 'pos' : 'neg') + '">' + (up ? '+' : '') + fmt(t.amount) + '</td>' +
      '<td class="right num muted">' + fmt(t.balanceAfter) + '</td>' +
    '</tr>';
  }).join('');
}

// ---------- REFERRAL ----------
async function loadReferrals() {
  const d = await api('/api/referrals');
  if (d.error) return;
  $('ref-link').textContent = location.origin + '/app.html?ref=' + d.code;
  $('ref-stats').textContent = d.count + ' inviti · ' + d.activeCount + ' attivi';
  $('kpi-ref').textContent = fmt0(d.earned);
  $('kpi-ref-sub').textContent = d.count + ' inviti, ' + d.activeCount + ' con piano attivo';
}

function copyRef() {
  const txt = $('ref-link').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
  else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Link copiato', 'ok');
}

function shareRef(channel) {
  const link = $('ref-link').textContent;
  const msg = 'Provo QuantX AI, piattaforma di trading quantitativo con segnali automatici. Entra pure: ' + link;
  if (channel === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  else if (channel === 'tg') window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(msg), '_blank');
  else copyRef();
}

// ---------- PRELIEVI ----------
async function loadWithdrawals() {
  const d = await api('/api/withdrawals');
  const box = $('withdrawals-list');
  if (!box) return;
  const list = d.withdrawals || [];
  if (!list.length) {
    box.innerHTML = '<div class="empty">Nessun prelievo richiesto.</div>';
    return;
  }
  box.innerHTML = list.map(w => {
    const label = w.status === 'completed' ? 'Pagato' : w.status === 'rejected' ? 'Respinto' : 'In verifica';
    const cls = w.status === 'completed' ? 'success' : w.status === 'rejected' ? 'danger' : 'warning';
    return '<div class="activity-item">' +
      '<div class="tx">' + label + '<div class="when">' + dt(w.date) + (w.fee ? ' · fee ' + fmt(w.fee) : '') + '</div></div>' +
      '<span class="neg">' + fmt(w.amount) + '</span>' +
      '<span class="badge ' + cls + '">' + label + '</span>' +
    '</div>';
  }).join('');
}

// ---------- MERCATO (feed) ----------
const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT'];
function startFeed() {
  const feed = $('feed');
  if (!feed) return;
  const push = () => {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const up = Math.random() > 0.42;
    const pct = (Math.random() * 1.8 + 0.15).toFixed(2);
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = '<span><span class="pair">' + pair + '</span> <span class="dir ' + (up ? 'up' : 'down') + '">' + (up ? 'LONG' : 'SHORT') + '</span></span>' +
                     '<span class="' + (up ? 'up' : 'down') + '">' + (up ? '+' : '-') + pct + '%</span>';
    feed.prepend(item);
    while (feed.children.length > 9) feed.lastChild.remove();
  };
  for (let i = 0; i < 5; i++) push();
  setInterval(push, 5000);
}

// ---------- DEPOSITO / PRELIEVO ----------
function openModal(id) { $('modal-' + id).classList.add('show'); }
function closeModal(id) { $('modal-' + id).classList.remove('show'); }

async function doDeposit(btn) {
  const amount = $('dep-amount').value;
  if (!amount || Number(amount) < 10) return toast('Importo minimo 10 euro', 'err');
  const data = await withBtn(btn, 'Verifica pagamento...', async () => {
    await new Promise(r => setTimeout(r, 900));
    return api('/api/deposit', { method: 'POST', body: JSON.stringify({ amount }) });
  });
  if (data.error) return toast(data.error, 'err');
  closeModal('deposit');
  $('dep-amount').value = '';
  toast('Deposito di ' + fmt0(amount) + ' registrato sul piano ' + (data.deposit ? data.deposit.plan : ''), 'ok');
  currentBalance = data.user.balance;
  animateBalance($('balance'), data.user.balance);
  loadPortfolio();
  loadTransactions();
}

async function doWithdraw(btn) {
  const amount = $('wd-amount').value;
  if (!amount || Number(amount) < 50) return toast('Prelievo minimo 50 euro', 'err');
  const data = await withBtn(btn, 'Invio richiesta...', async () => {
    await new Promise(r => setTimeout(r, 900));
    return api('/api/withdraw', { method: 'POST', body: JSON.stringify({ amount }) });
  });
  if (data.error) return toast(data.error, 'err');
  closeModal('withdraw');
  $('wd-amount').value = '';
  toast(data.withdrawal.msg, 'ok');
  currentBalance = data.user.balance;
  animateBalance($('balance'), data.user.balance);
  loadPortfolio();
  loadTransactions();
  loadWithdrawals();
}

function logout() { localStorage.removeItem(TOKEN_KEY); location.href = 'index.html'; }

// ---------- BOOT ----------
window.addEventListener('DOMContentLoaded', () => {
  const savedRef = localStorage.getItem(REF_KEY);
  if (savedRef) $('auth-ref').value = savedRef;
  if (!token) {
    $('auth-view').style.display = 'flex';
    applyAuthMode(registerMode);
  } else {
    enterDash();
  }
});
