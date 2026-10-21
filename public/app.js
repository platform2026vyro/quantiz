// QuantX AI — Area riservata: autenticazione, ordini, posizioni, movimenti
const API = '';
const TOKEN_KEY = 'quantx_token';
const REF_KEY = 'quantx_ref';
let token = localStorage.getItem(TOKEN_KEY);

// Codice invito dal link (?ref=XXX): lo memorizzo cosi resta anche cambiando pagina
const urlParams = new URLSearchParams(location.search);
const urlRef = (urlParams.get('ref') || '').toUpperCase().trim();
if (urlRef) localStorage.setItem(REF_KEY, urlRef);
let registerMode = urlParams.get('mode') === 'register' || !!urlRef;

// ---------- HELPERS ----------
const $ = (id) => document.getElementById(id);
// Formattazione numerica italiana con separatore delle migliaia anche su 4 cifre
const itNum = (n, d = 0) => {
  const fixed = Number(n || 0).toFixed(d);
  const parts = fixed.split('.');
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (parts[1] ? ',' + parts[1] : '');
};
const fmt = (n) => '€' + itNum(n, 2);
const fmt0 = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + itNum(Math.abs(Number(n || 0)), 0);
const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  });
  return res.json();
}

// Feedback sui pulsanti: mentre lavorano si vedono "occupati" (niente piu' click a vuoto)
async function withBtn(btn, label, fn) {
  if (btn) {
    btn.dataset.old = btn.textContent;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = label;
  }
  try {
    return await fn();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = btn.dataset.old || btn.textContent;
    }
  }
}

function animateBalance(el, target) {
  if (!el) return;
  // Valore finale subito: se la tab e' in background rAF non gira e il saldo resterebbe vuoto
  el.textContent = fmt(target);
  if (typeof document !== 'undefined' && document.hidden) return;
  const from = 0;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 700);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- AUTH ----------
function applyAuthMode(reg) {
  registerMode = reg;
  $('reg-name-wrap').style.display = reg ? 'block' : 'none';
  $('reg-ref-wrap').style.display = reg ? 'block' : 'none';
  $('auth-title').textContent = reg ? 'Apri un conto' : "Accedi all'area riservata";
  $('auth-btn').textContent = reg ? 'Crea account' : 'Accedi';
  $('auth-switch').textContent = reg ? 'Hai già un account? ' : 'Non hai un account? ';
  $('auth-switch').nextElementSibling.textContent = reg ? 'Accedi' : 'Registrati';
  if (reg && !$('auth-ref').value) $('auth-ref').value = localStorage.getItem(REF_KEY) || '';
}

function toggleAuth() { applyAuthMode(!registerMode); }

async function doAuth() {
  const refCode = ($('auth-ref').value || localStorage.getItem(REF_KEY) || '').toUpperCase().trim();
  const payload = { email: $('auth-email').value, password: $('auth-pass').value, name: $('auth-name').value, ref: refCode };
  const data = await api(registerMode ? '/api/register' : '/api/login', { method: 'POST', body: JSON.stringify(payload) });
  if (data.error) return $('auth-error').textContent = data.error;
  token = data.token;
  localStorage.setItem(TOKEN_KEY, token);
  enterDash();
}

async function enterDash() {
  const data = await api('/api/me');
  if (data.error) return location.href = 'app.html';
  $('auth-view').style.display = 'none';
  $('dash-view').style.display = 'block';
  renderUser(data);
  renderSignals(data);
  loadReferrals();
  loadMyActivity();
  loadWithdrawalsList();
  loadPositions();
  drawChart();

  // Il saldo si aggiorna da solo: la resa matura in continuazione
  setInterval(async () => {
    if (!token) return;
    const me = await api('/api/me');
    if (me.error) return;
    animateBalance($('balance'), me.user.balance);
    const sub = $('balance-sub');
    if (sub && me.user.activePlans) {
      sub.textContent = me.user.activePlans + (me.user.activePlans === 1 ? ' piano attivo · ' : ' piani attivi · ') + fmt(me.user.dailyYieldTotal) + ' al giorno';
    }
  }, 30000);
}

// Le mie ultime operazioni
async function loadMyActivity() {
  const data = await api('/api/my-activity');
  const box = $('my-activity');
  if (!box) return;
  const items = (data && data.items) || [];
  const LABELS = { deposit: 'Versamento', withdraw: 'Prelievo', signal: 'Ordine', yield: 'Ordini', plan: 'Piano' };
  box.innerHTML = items.length ? items.map(it => `
    <div class="activity-item">
      <span class="ic">${LABELS[it.type] || 'Movimento'}</span>
      <span class="tx">${it.text}<div class="when">${new Date(String(it.date).replace(' ', 'T') + 'Z').toLocaleString('it-IT')}</div></span>
      <span class="${it.amount >= 0 ? 'pos' : 'neg'}">${it.amount >= 0 ? '+' : ''}${fmt(it.amount)}</span>
    </div>`).join('') : '<p style="color:var(--muted)">Nessuna operazione registrata.</p>';
}

// Storico prelievi
async function loadWithdrawalsList() {
  const data = await api('/api/withdrawals');
  const box = $('withdrawals-list');
  if (!box) return;
  const list = (data && data.withdrawals) || [];
  box.innerHTML = list.length ? list.map(w => `
    <div class="activity-item">
      <span class="ic">Prelievo</span>
      <span class="tx">
        <div class="when">${w.status === 'completed' ? 'Liquidato' : w.status === 'rejected' ? 'Respinto' : 'In verifica'} · ${new Date(String(w.date).replace(' ', 'T') + 'Z').toLocaleString('it-IT')}</div>
      </span>
      <span class="neg">-${fmt(w.amount)}</span>
    </div>`).join('') : '<p style="color:var(--muted)">Nessun prelievo richiesto.</p>';
}

// ---------- PIANI ATTIVI (posizioni) ----------
async function loadPositions() {
  const d = await api('/api/positions');
  if (d.error) return;

  // Riga/badge in alto
  const line = $('positions-line');
  if (line) {
    if (!d.positions.length) {
      line.innerHTML = '<a href="plans.html" class="btn btn-ghost" style="font-size:13px">Nessun piano attivo · attivane uno →</a>';
    } else {
      const badges = d.positions.map(p =>
        '<span class="badge" style="border-color:var(--accent-line); color:var(--accent)">' + p.plan + ' · ' + fmt0(p.amount) + ' · +' + fmt(p.dailyYield) + '/g</span>'
      ).join('');
      line.innerHTML = '<span class="muted" style="font-size:13px">Piani attivi:</span>' + badges +
        '<span class="badge success">totale ' + fmt(d.dailyYield) + '/g</span>';
    }
  }

  // Card dettagliata
  const box = $('positions-list');
  const cnt = $('positions-count');
  if (cnt) cnt.textContent = d.count === 1 ? '1 piano attivo' : d.count + ' piani attivi';
  if (!box) return;

  if (!d.positions.length) {
    box.innerHTML = '<p style="color:var(--muted); font-size:14px; margin:0">' +
      'Non hai ancora attivato nessun piano. Deposita capitale e attiva il primo piano per iniziare a guadagnare.</p>';
    return;
  }

  box.innerHTML = d.positions.map((p, i) =>
    '<div class="signal' + (i === 0 ? ' active' : '') + '">' +
      '<div class="info">' +
        '<h4>' + p.plan + ' <span style="color:var(--muted); font-weight:400; font-size:13px">· #' + p.id + '</span></h4>' +
        '<div class="meta">' + fmt0(p.amount) + ' investiti · +' + String(p.dailyYieldPct).replace('.', ',') + '% al giorno' +
        ' · attivo dal ' + new Date(String(p.since).replace(' ', 'T') + 'Z').toLocaleDateString('it-IT') + '</div>' +
      '</div>' +
      '<div style="text-align:right; white-space:nowrap">' +
        '<div style="color:var(--green); font-weight:800; font-size:16px">+' + fmt(p.dailyYield) + '</div>' +
        '<div style="color:var(--muted); font-size:12px">al giorno</div>' +
      '</div>' +
    '</div>'
  ).join('') +
  '<div class="signal" style="background:transparent; border-style:dashed; margin-top:0">' +
    '<div class="info"><h4>Totale investito</h4>' +
      '<div class="meta">' + d.count + (d.count === 1 ? ' posizione attiva' : ' posizioni attive') + '</div></div>' +
    '<div style="text-align:right; white-space:nowrap">' +
      '<div style="color:var(--green); font-weight:800; font-size:16px">' + fmt0(d.totalInvested) + '</div>' +
      '<div style="color:var(--muted); font-size:12px">capitale</div>' +
    '</div>' +
  '</div>';

  // Resa che matura in tempo reale
  const live = $('yield-live');
  if (live) {
    if (!d.count) { live.style.display = 'none'; }
    else {
      live.style.display = 'block';
      yieldState.daily = d.dailyYield;
      yieldState.accrued = d.accruedToday || 0;
      yieldState.at = Date.now();
      paintYield();
    }
  }
}

// Contatore della resa: cresce da solo mentre la pagina e' aperta
const yieldState = { daily: 0, accrued: 0, at: Date.now() };
function paintYield() {
  const el = $('yield-today');
  if (!el) return;
  const elapsed = (Date.now() - yieldState.at) / 86400000;   // giorni passati da quando abbiamo letto i dati
  const value = yieldState.accrued + yieldState.daily * elapsed;
  el.textContent = '€' + itNum(value, 4);

  // barra di avanzamento della giornata
  const bar = $('yield-bar');
  if (bar && yieldState.daily > 0) {
    const now = new Date();
    const pct = Math.min(100, Math.round((now.getHours() * 60 + now.getMinutes()) / 1440 * 100));
    bar.style.width = pct + '%';
  }
  const note = $('yield-note');
  if (note && yieldState.daily > 0) {
    note.textContent = 'resa giornaliera ' + fmt(yieldState.daily) + ' · matura in continuazione, si accredita da solo';
  }
}
setInterval(paintYield, 1000);

// ---------- FIDELTÀ: codice referral + link invito ----------
async function loadReferrals() {
  const data = await api('/api/referrals');
  if (data.error) return;
  const link = location.origin + '/app.html?ref=' + data.code;
  $('ref-link').textContent = link;
  $('ref-stats').textContent = `${data.count} amici · ${data.activeCount} attivi · +${fmt(data.earned)}`;
}
function copyRef() {
  const txt = $('ref-link').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
  else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Link copiato negli appunti.');
}

function shareRef(channel) {
  const link = $('ref-link').textContent;
  const msg = encodeURIComponent('Ti passo QuantX AI: gestione algoritmica del capitale. Registrati con il mio link: ' + link);
  if (channel === 'wa') window.open('https://wa.me/?text=' + msg, '_blank');
  else if (channel === 'tg') window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + msg, '_blank');
  else copyRef();
}

function renderUser(data) {
  const u = data.user;
  animateBalance($('balance'), u.balance);
  $('balance-sub').textContent = u.activePlans
    ? u.activePlans + (u.activePlans === 1 ? ' piano attivo · ' : ' piani attivi · ') + fmt(u.dailyYieldTotal) + ' al giorno'
    : 'Nessun piano attivo · attivane uno per iniziare';
  // Il pulsante Admin esiste SOLO per l'amministratore (per gli altri non viene nemmeno creato)
  if (u.isAdmin) addAdminLink();
}

function addAdminLink() {
  const box = $('nav-links');
  if (!box || $('nav-admin')) return;
  const a = document.createElement('a');
  a.id = 'nav-admin';
  a.href = 'admin.html';
  a.className = 'btn btn-ghost';
  a.style.textDecoration = 'none';
  a.textContent = 'Admin';
  box.insertBefore(a, box.firstChild);
}

// ---------- ORDINI DEL GIORNO ----------
// Il numero di ordini dipende dal livello del piano ed è distribuito sulle 24 ore.
const EIRIO_ORDERS = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9 };

async function renderSignals(data) {
  const sig = data.signals || { claimed: [], profits: [] };
  const claimed = sig.claimed || [];
  const profits = sig.profits || [];
  const gainedTotal = profits.reduce((a, b) => a + (b || 0), 0);
  const lvl = data.user && data.user.plan;
  const isVip = data.user && String(data.user.planName || '').toUpperCase().startsWith('VIP');

  if (isVip) {
    const n = EIRIO_ORDERS[lvl] || 4;
    const now = new Date();
    const allowed = Math.min(n, Math.floor(n * Math.max(1, now.getHours()) / 24));
    $('signal-count').textContent = claimed.length + ' / ' + n + ' eseguiti';
    const note = $('signals-note');
    if (note) {
      note.textContent = 'Livello ' + (data.user.planName || 'VIP') + ' · ' + n +
        ' ordini al giorno, uno ogni ' + Math.round(24 / n * 60) + ' minuti.';
    }
    const rows = [];
    for (let i = 0; i < n; i++) {
      const done = claimed.includes(i);
      const canDo = !done && i < allowed;
      const idx = claimed.indexOf(i);
      rows.push('<div class="signal' + (done ? ' active' : '') + '">' +
        '<div class="info"><h4>Ordine #' + (i + 1) + '</h4>' +
        '<div class="meta">' +
        (done ? 'Eseguito · <span class="win">' + fmt(profits[idx] || 0) + '</span>'
              : canDo ? 'Disponibile' : 'Programmato') +
        '</div></div>' +
        '<button class="btn ' + (canDo ? 'btn-primary' : 'btn-ghost') + '" ' + (done || !canDo ? 'disabled' : '') +
        ' onclick="claimSignal(' + i + ', this)">' +
        (done ? 'Eseguito' : canDo ? 'Esegui' : 'Programmato') +
        '</button></div>');
    }
    $('signals').innerHTML = rows.join('') +
      '<div class="signal" style="background:transparent; border-style:dashed">' +
        '<div class="info"><h4>Riepilogo giornata</h4><div class="meta">' + claimed.length + ' ordini eseguiti su ' + n +
        ' · profitto ' + fmt(gainedTotal) + '</div></div></div>';
    return;
  }

  const labels = ['Ordine Alpha', 'Ordine Beta', 'Ordine Gamma'];
  const hours = [9, 14, 20];
  const currentHour = new Date().getHours();
  $('signal-count').textContent = claimed.length + ' / 3 eseguiti';
  const note = $('signals-note');
  if (note) note.textContent = 'Gli ordini sono disponibili alle 09:00, 14:00 e 20:00.';
  $('signals').innerHTML = labels.map((lab, i) => {
    const done = claimed.includes(i);
    const idx = claimed.indexOf(i);
    const gained = idx >= 0 ? (profits[idx] || 0) : 0;
    const isAvailable = currentHour === hours[i];
    const canClaim = !done && isAvailable;

    return `<div class="signal ${done ? 'active' : ''}">
      <div class="info">
        <h4>${lab}</h4>
        <div class="meta">Disponibile alle ${hours[i]}:00 · ${done ? '<span class="win">' + (gained >= 0 ? '+' : '') + fmt(gained) + '</span>' : isAvailable ? 'Disponibile ora' : 'Programmato'}</div>
      </div>
      <button class="btn ${canClaim ? 'btn-primary' : 'btn-ghost'}" ${done || !isAvailable ? 'disabled' : ''} onclick="claimSignal(${i}, this)">
        ${done ? 'Eseguito' : isAvailable ? 'Esegui' : 'Programmato'}
      </button>
    </div>`;
  }).join('');
}

async function claimSignal(i, btn) {
  const data = await withBtn(btn, 'Esecuzione...', async () => {
    await new Promise(r => setTimeout(r, 900));
    return api('/api/claim-signal', { method: 'POST', body: JSON.stringify({ index: i }) });
  });
  if (data.error) {
    toast(data.error + (data.message ? ' - ' + data.message : ''));
    return;
  }
  toast('Ordine eseguito · ' + (data.profit >= 0 ? '+' : '') + fmt(data.profit));
  animateBalance($('balance'), data.user.balance);
  renderSignals(data);
  loadMyActivity();
}

// ---------- ANDAMENTO PORTAFOGLIO ----------
// Serie deterministica: rendimento cumulato del piano sui 30 giorni.
async function drawChart() {
  const d = await api('/api/positions');
  const daily = (d && !d.error && d.dailyYield) || 0;
  const pts = [];
  for (let i = 0; i < 30; i++) {
    const base = daily * (i + 1);
    pts.push(base * (0.94 + 0.06 * Math.sin(i * 0.8)));
  }
  const max = Math.max(...pts, 1);
  const toY = (p) => 200 - (p / max) * 170;
  const toX = (i) => (i / (pts.length - 1)) * 600;
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ');
  const lineEl = $('chart-line');
  const areaEl = $('chart-area');
  if (lineEl) lineEl.setAttribute('d', line);
  if (areaEl) areaEl.setAttribute('d', line + ` L600,220 L0,220 Z`);
}

// ---------- DEPOSIT / WITHDRAW ----------
function openModal(id) { $( 'modal-' + id).classList.add('show'); }
function closeModal(id) { $('modal-' + id).classList.remove('show'); }

async function doDeposit(btn) {
  const amount = $('dep-amount').value;
  if (!amount || Number(amount) <= 0) return toast('Inserisci un importo valido');
  const method = $('dep-method') ? $('dep-method').value : 'card';
  const data = await withBtn(btn, 'Verifica in corso...', async () => {
    await new Promise(r => setTimeout(r, 900));   // come la conferma di un pagamento vero
    return api('/api/deposit', { method: 'POST', body: JSON.stringify({ amount, method }) });
  });
  if (data.error) return toast(data.error);
  closeModal('deposit');
  $('dep-amount').value = '';
  toast('Deposito di ' + fmt(amount) + ' confermato · piano ' + (data.deposit ? data.deposit.plan : 'attivo'));
  if (data.user) animateBalance($('balance'), data.user.balance);
  loadMyActivity();
  loadPositions();
}

// Metodo di pagamento: carta (accredito immediato) oppure crypto (wallet)
function togglePayMethod() {
  const m = $('dep-method') ? $('dep-method').value : 'card';
  const card = $('dep-card-box');
  const crypto = $('dep-crypto-box');
  if (card) card.style.display = m === 'card' ? 'block' : 'none';
  if (crypto) crypto.style.display = m === 'crypto' ? 'block' : 'none';
}

async function doWithdraw(btn) {
  const amount = $('wd-amount').value;
  if (!amount || Number(amount) <= 0) return toast('Inserisci un importo valido');
  const data = await withBtn(btn, 'Invio richiesta...', async () => {
    await new Promise(r => setTimeout(r, 900));
    return api('/api/withdraw', { method: 'POST', body: JSON.stringify({ amount }) });
  });
  if (data.error) return toast(data.error);
  closeModal('withdraw');
  $('wd-amount').value = '';
  toast(data.withdrawal.msg);
  if (data.user) animateBalance($('balance'), data.user.balance);
  loadMyActivity();
  loadWithdrawalsList();
}

function logout() { localStorage.removeItem(TOKEN_KEY); location.href = 'index.html'; }

// ---------- BOOT ----------
window.addEventListener('DOMContentLoaded', () => {
  const savedRef = localStorage.getItem(REF_KEY);
  if (savedRef) $('auth-ref').value = savedRef;

  if (!token) {
    $('auth-view').style.display = 'flex';
    applyAuthMode(registerMode);   // mostra subito "registrati" se c'è ?ref= o ?mode=register
  } else {
    enterDash();
  }
});
