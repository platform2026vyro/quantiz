// QuantX AI - Landing: statistiche fake animate (social proof)
async function loadStats() {
  const res = await fetch('/api/stats');
  const s = await res.json();
  animate($('stat-profit'), s.profitToday, (v) => '€' + Math.round(v).toLocaleString('it-IT'));
  animate($('stat-users'), s.activeUsers, (v) => Math.round(v).toLocaleString('it-IT'));
}

function animate(el, target, fmtFn) {
  if (!el) return;
  const start = performance.now();
  const dur = 1600;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmtFn(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

window.addEventListener('DOMContentLoaded', loadStats);
