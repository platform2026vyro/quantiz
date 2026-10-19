// QuantX AI - Landing: dati reali dal backend, animazioni sobrie
const $ = (id) => document.getElementById(id);
const eur = (v) => '€' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const eur2 = (v) => '€' + Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function animate(el, target, fmtFn, dur) {
  if (!el) return;
  // Valore finale subito: se la tab non e' visibile rAF non gira e il numero resterebbe vuoto
  el.textContent = fmtFn(target);
  if (typeof document !== 'undefined' && document.hidden) return;
  const from = 0;
  const start = performance.now();
  const time = dur || 900;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / time);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmtFn(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function loadStats() {
  try {
    const s = await (await fetch('/api/stats')).json();
    animate($('stat-profit'), s.totalDeposited, eur);
    $('stat-profit-sub').textContent = s.totalDeposited ? 'confermati sulla piattaforma' : 'nessun deposito registrato';
    animate($('stat-users'), s.totalUsers, v => Math.round(v).toLocaleString('it-IT'));
    $('stat-users-sub').textContent = s.activeUsers + ' con sessione attiva';
    if (s.winRate !== null && s.winRate !== undefined) {
      animate($('stat-winrate'), s.winRate, v => v.toFixed(1).replace('.', ',') + '%');
      $('stat-winrate-sub').textContent = s.signalsRun + ' segnali registrati';
    } else {
      $('stat-winrate').textContent = 'n/d';
      $('stat-winrate-sub').textContent = 'nessun segnale chiuso';
    }
    animate($('stat-capital'), s.totalBalance, eur);
    $('stat-capital-sub').textContent = eur2(s.totalWithdrawn) + ' già pagati';
    $('live-signals').textContent = s.signalsRun;
  } catch (e) { /* rete instabile */ }
}

async function loadLive() {
  try {
    const d = await (await fetch('/api/live')).json();
    $('live-online').textContent = d.online;
    $('live-deposits').textContent = eur(d.depositsToday);
    $('live-last').textContent = d.lastDepositAgo === null ? '—' : (d.lastDepositAgo === 0 ? 'adesso' : d.lastDepositAgo + ' min fa');
  } catch (e) { /* ignora */ }
}

async function loadActivity() {
  try {
    const d = await (await fetch('/api/activity')).json();
    const box = $('ticker');
    if (!box) return;
    const items = d.items || [];
    if (!items.length) {
      box.innerHTML = '<div class="empty"><strong>Nessun movimento registrato</strong>I movimenti compariranno qui appena ci saranno operazioni.</div>';
      return;
    }
    box.innerHTML = items.map((it, i) => {
      const sign = it.amount > 0 ? '+' : it.amount < 0 ? '' : '';
      const cls = it.amount > 0 ? 'up' : it.amount < 0 ? 'down' : '';
      return '<div class="ticker-item" style="animation-delay:' + (i * 45) + 'ms">' +
        '<span class="tx">' + it.text + '</span>' +
        '<span class="' + cls + ' num">' + (it.type === 'signal' ? sign : '') + (it.type === 'signal' ? '' : eur(Math.abs(it.amount))) + '</span>' +
        '<span class="ago">' + (it.ago === 0 ? 'ora' : it.ago + ' min') + '</span>' +
      '</div>';
    }).join('');
  } catch (e) { /* ignora */ }
}

async function loadPlans() {
  try {
    const plans = await (await fetch('/api/plans')).json();
    const box = $('landing-plans');
    if (!box) return;
    box.innerHTML = plans.map((p, i) => {
      const featured = i === 1;
      return '<div class="card plan-card' + (featured ? ' featured' : '') + '">' +
        (featured ? '<div class="plan-badge">Popolare</div>' : '') +
        '<div class="plan-name" style="color:' + p.color + '">' + p.name + '</div>' +
        '<div class="plan-price">' + eur(p.minDeposit) + '<span>da</span></div>' +
        '<div class="plan-yield">+' + String(p.dailyYieldPct).replace('.', ',') + '% <small>al giorno</small></div>' +
        '<ul class="plan-features">' +
          '<li><span class="yes"></span>' + p.refBonusPct + '% di bonus sugli inviti</li>' +
          '<li><span class="yes"></span>3 segnali al giorno</li>' +
          '<li><span class="yes"></span>Prelevi da ' + eur(p.minDeposit) + '</li>' +
        '</ul>' +
        '<a href="app.html?mode=register&plan=' + p.id + '" class="btn ' + (featured ? 'btn-primary' : 'btn-secondary') + ' btn-block">Scegli ' + p.name + '</a>' +
        '<a href="plans.html" class="btn btn-ghost btn-block" style="margin-top:8px">Confronta i piani</a>' +
      '</div>';
    }).join('');
  } catch (e) { /* ignora */ }
}

window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLive();
  loadActivity();
  loadPlans();
  setInterval(loadLive, 15000);
  setInterval(loadActivity, 20000);
  setInterval(loadStats, 30000);
});
