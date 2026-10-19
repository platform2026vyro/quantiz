// QuantX AI - Frontend dashboard: autenticazione, giocate, grafico finto
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
const fmt = (n) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  });
  return res.json();
}

// ---------- AUTH ----------
function applyAuthMode(reg) {
  registerMode = reg;
  $('reg-name-wrap').style.display = reg ? 'block' : 'none';
  $('reg-ref-wrap').style.display = reg ? 'block' : 'none';
  $('auth-title').textContent = reg ? 'Crea il tuo account' : 'Accedi al pannello';
  $('auth-btn').textContent = reg ? 'Registrati ⚡' : 'Entra ⚡';
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
  startFeed();
  drawChart();
}

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
  toast('🔗 Link copiato. Condividilo e guadagna!');
}

function shareRef(channel) {
  const link = $('ref-link').textContent;
  const msg = encodeURIComponent('Ti passo QuantX AI: rendita automatica ogni giorno. Registrati con il mio link: ' + link);
  if (channel === 'wa') window.open('https://wa.me/?text=' + msg, '_blank');
  else if (channel === 'tg') window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + msg, '_blank');
  else copyRef();
}

function renderUser(data) {
  const u = data.user;
  $('balance').textContent = fmt(u.balance);
  $('streak').textContent = u.streak;
  $('balance-sub').textContent = 'Piano ' + (u.planName || 'Starter') + ' · rendita automatica attiva';
  // Link al pannello admin solo per l'amministratore
  const adm = $('nav-admin');
  if (adm) adm.style.display = u.isAdmin ? 'inline-flex' : 'none';
}

// ---------- GIOCATE (3 segnali/giorno) ----------
async function renderSignals(data) {
  const sig = data.signals;
  const labels = ['Segnale Alpha', 'Segnale Beta', 'Segnale Gamma'];
  const conf = ['96.2%', '94.8%', '92.1%'];
  $('signal-count').textContent = `${sig.claimed.length}/3 attivati`;
  $('signals').innerHTML = labels.map((lab, i) => {
    const claimed = sig.claimed.includes(i);
    const profit = sig.profits[sig.profits.indexOf ? sig.profits.filter((_, idx) => sig.claimed[idx] === i)[0] : -1];
    return `<div class="signal ${claimed ? 'active' : ''}">
      <div class="info">
        <h4>${lab}</h4>
        <div class="meta">Confidenza ${conf[i]} · ${claimed ? '<span class="win">+€' + (sig.profits[i] || 0).toFixed(2) + ' guadagnato</span>' : 'Disponibile — scade a mezzanotte'}</div>
      </div>
      <button class="btn ${claimed ? 'btn-ghost' : 'btn-green'}" ${claimed ? 'disabled' : ''} onclick="claimSignal(${i})">
        ${claimed ? '✓ Attivato' : 'Attiva trade'}
      </button>
    </div>`;
  }).join('');
}

async function claimSignal(i) {
  const data = await api('/api/claim-signal', { method: 'POST', body: JSON.stringify({ index: i }) });
  if (data.error) return toast(data.error);
  toast('⚡ Trade chiuso: +' + fmt(data.profit));
  const me = await api('/api/me');
  renderUser(me);
  renderSignals(me);
}

// ---------- FEED FAKE (segnali in tempo reale) ----------
const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT'];
function startFeed() {
  const push = () => {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const win = Math.random() > 0.2; // 80% vincite
    const pct = (Math.random() * 2.5 + 0.3).toFixed(2);
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `<span><span class="pair">${pair}</span> ${win ? 'LONG' : 'SHORT'}</span>
      <span class="${win ? 'up' : 'down'}">${win ? '+' : '-'}${pct}% ${win ? 'WIN' : 'LOSS'}</span>`;
    const feed = $('feed');
    feed.prepend(item);
    if (feed.children.length > 8) feed.lastChild.remove();
  };
  push(); push(); push();
  setInterval(push, 3500);
}

// ---------- GRAPICO FINTO (random walk verso l'alto) ----------
function drawChart() {
  let v = 40;
  const pts = [];
  for (let i = 0; i < 40; i++) { v += Math.random() * 4 - 1.2; pts.push(v); }
  const min = Math.min(...pts), max = Math.max(...pts);
  const toY = (p) => 210 - ((p - min) / (max - min)) * 200;
  const toX = (i) => (i / (pts.length - 1)) * 600;
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ');
  $('chart-line').setAttribute('d', line);
  $('chart-area').setAttribute('d', line + ` L600,220 L0,220 Z`);
}

// ---------- DEPOSIT / WITHDRAW ----------
function openModal(id) { $( 'modal-' + id).classList.add('show'); }
function closeModal(id) { $('modal-' + id).classList.remove('show'); }

async function doDeposit() {
  const amount = $('dep-amount').value;
  const data = await api('/api/deposit', { method: 'POST', body: JSON.stringify({ amount }) });
  if (data.error) return toast(data.error);
  closeModal('deposit');
  toast('✅ Deposito confermato. Rendita attivata!');
  renderUser({ user: data.user });
}

async function doWithdraw() {
  const amount = $('wd-amount').value;
  const data = await api('/api/withdraw', { method: 'POST', body: JSON.stringify({ amount }) });
  if (data.error) return toast(data.error);
  closeModal('withdraw');
  toast(data.withdrawal.status === 'approvato' ? '✅ ' + data.withdrawal.msg : '⏳ ' + data.withdrawal.msg);
  if (data.user) renderUser({ user: data.user });
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
