// QuantX AI - Landing: numeri animati + attività in tempo reale (la piattaforma deve sembrare VIVA)
const $ = (id) => document.getElementById(id);

const eur = (v) => '€' + itNum(v, 0);
const num = (v) => itNum(v, 0);
const itNum = (n, d = 0) => {
  const fixed = Number(n || 0).toFixed(d);
  const parts = fixed.split('.');
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (parts[1] ? ',' + parts[1] : '');
};

function animate(el, target, fmtFn, dur) {
  if (!el) return;
  // Valore subito (se la tab e' in background rAF non gira e il numero resterebbe a 0)
  el.textContent = fmtFn(target);
  if (typeof document !== 'undefined' && document.hidden) return;
  const from = 0;
  const start = performance.now();
  const time = dur || 1400;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / time);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmtFn(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function loadStats() {
  const res = await fetch('/api/stats');
  const s = await res.json();
  animate($('stat-profit'), s.totalAllocated, eur);
  animate($('stat-users'), s.totalUsers, num);
  if (s.winRate !== null && s.winRate !== undefined) animate($('stat-winrate'), s.winRate, (v) => v.toFixed(1).replace('.', ',') + '%');
  else $('stat-winrate').textContent = 'n/d';
  animate($('stat-capital'), s.totalBalance, eur);
}

// Contatori live: cambiano ogni pochi secondi, come una piattaforma attiva
async function loadLive() {
  try {
    const res = await fetch('/api/live');
    const d = await res.json();
    animate($('live-online'), d.online, num, 700);
    const onlineLabel = $('live-online-label');
    if (onlineLabel) onlineLabel.textContent = d.online === 1 ? 'utente attivo' : 'utenti attivi';
    animate($('live-paid'), d.paidToday, eur, 700);
    const last = $('live-last');
    if (last) {
      const m = d.lastDepositAgo;
      last.textContent = (m === null || m === undefined) ? '—'
        : m < 60 ? m + ' min'
        : m < 1440 ? Math.floor(m / 60) + ' h'
        : Math.floor(m / 1440) + ' g';
    }
  } catch (e) { /* rete instabile: riprovo al prossimo giro */ }
}

const ICONS = { deposit: 'Versamenti', withdraw: 'Prelievi', signal: 'Ordini', plan: 'Piani' };

async function loadActivity() {
  try {
    const res = await fetch('/api/activity');
    const d = await res.json();
    const box = $('ticker');
    if (!box) return;
    const items = (d && d.items) || [];
    if (!items.length) {
      box.innerHTML = '<div class="ticker-item"><span class="ic">Stato</span><span class="tx">Nessun movimento recente</span><span class="ago">—</span></div>';
      return;
    }
    box.innerHTML = items.map((it) => `
      <div class="ticker-item">
        <span class="ic">${ICONS[it.type] || 'Movimento'}</span>
        <span class="tx">${it.text}</span>
        <span class="ago">${it.agoText || (it.ago + ' min')}</span>
      </div>`).join('');
  } catch (e) { /* rete instabile: riprovo al prossimo giro */ }
}

window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLive();
  loadActivity();
  setInterval(loadLive, 6000);
  setInterval(loadActivity, 9000);
  setInterval(loadStats, 45000);
});
