// QuantX AI - Landing: numeri animati + attività in tempo reale (la piattaforma deve sembrare VIVA)
const $ = (id) => document.getElementById(id);

const eur = (v) => '€' + Math.round(v).toLocaleString('it-IT');
const num = (v) => Math.round(v).toLocaleString('it-IT');

function animate(el, target, fmtFn, dur) {
  if (!el) return;
  const from = parseFloat(String(el.textContent).replace(/[^0-9.]/g, '')) || 0;
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
  animate($('stat-profit'), s.profitToday, eur);
  animate($('stat-users'), s.activeUsers, num);
  animate($('stat-winrate'), s.winRate, (v) => v.toFixed(1) + '%');
  animate($('stat-capital'), s.totalManaged, (v) => '€' + (v / 1000000).toFixed(1) + 'M');
}

// Contatori live: cambiano ogni pochi secondi, come una piattaforma attiva
async function loadLive() {
  try {
    const res = await fetch('/api/live');
    const d = await res.json();
    animate($('live-online'), d.online, num, 700);
    animate($('live-watching'), d.watching, num, 700);
    animate($('live-paid'), d.paidToday, eur, 700);
    const last = $('live-last');
    if (last) last.textContent = d.lastDepositAgo;
  } catch (e) { /* rete instabile: riprovo al prossimo giro */ }
}

const ICONS = { deposit: '💰', withdraw: '🏦', signal: '📈' };

async function loadActivity() {
  try {
    const res = await fetch('/api/activity');
    const d = await res.json();
    const box = $('ticker');
    if (!box) return;
    box.innerHTML = d.items.map((it, i) => `
      <div class="ticker-item" style="animation-delay:${i * 60}ms">
        <span class="ic">${ICONS[it.type] || '⚡'}</span>
        <span class="tx">${it.text}</span>
        <span class="ago">${it.ago} min</span>
      </div>`).join('');
  } catch (e) { /* ignora */ }
}

window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLive();
  loadActivity();
  setInterval(loadLive, 6000);
  setInterval(loadActivity, 9000);
  setInterval(loadStats, 45000);
});
