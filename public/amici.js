// QuantX AI - Pagina Amici: link invito, elenco amici, bonus
const TOKEN_KEY = 'quantx_token';
const token = localStorage.getItem(TOKEN_KEY);

const $ = (id) => document.getElementById(id);
const fmt = (n) => '€' + itNum(n, 2);
const itNum = (n, d = 0) => {
  const fixed = Number(n || 0).toFixed(d);
  const parts = fixed.split('.');
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (parts[1] ? ',' + parts[1] : '');
};
const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  });
  return res.json();
}

let myLink = '';

async function load() {
  const me = await api('/api/me');
  if (me.error) { location.href = 'app.html'; return; }
  if (me.user && me.user.isAdmin) {
    const box = $('nav-links');
    const a = document.createElement('a');
    a.id = 'nav-admin';
    a.href = 'admin.html';
    a.className = 'btn btn-ghost';
    a.style.textDecoration = 'none';
    a.textContent = 'Admin';
    box.insertBefore(a, box.firstChild);
  }

  const refs = await api('/api/referrals');
  if (refs.error) { toast('Errore nel caricamento dei dati'); return; }

  $('st-total').textContent = refs.count;
  $('st-active').textContent = refs.activeCount;
  $('st-earned').textContent = fmt(refs.earned);
  $('st-code').textContent = refs.code;

  myLink = location.origin + '/app.html?ref=' + refs.code;
  $('ref-link').textContent = myLink;
  $('invite-text').textContent =
    'Messaggio pronto: "Ti passo QuantX AI, gestione algoritmica del capitale. Registrati con il mio link: ' + myLink + '"';

  const list = refs.list || [];
  if (!list.length) {
    $('friends-list').innerHTML = `
      <p style="color:var(--muted); line-height:1.7">
        Nessun contatto collegato. Condividi il link: quando un contatto effettua un versamento confermato,
        la commissione del 17% viene accreditata sul saldo.
      </p>`;
    return;
  }

  $('friends-list').innerHTML = list.map(f => `
    <div class="signal ${f.active ? 'active' : ''}" style="margin-bottom:10px">
      <div class="info">
        <h4>${f.name}</h4>
        <div class="meta">
          ${f.active
            ? '<span class="win">Attivo</span> · versamento ' + fmt(f.deposited) + ' · commissione ' + fmt(f.bonus)
            : 'Registrato, senza versamenti — la commissione matura al primo versamento confermato'}
        </div>
      </div>
      <div style="text-align:right">
        <div style="color:var(--pos); font-weight:600">${fmt(f.bonus)}</div>
        <div style="color:var(--muted); font-size:12px">commissione</div>
      </div>
    </div>`).join('');
}

function copyRef() {
  if (navigator.clipboard) navigator.clipboard.writeText(myLink);
  else { const ta = document.createElement('textarea'); ta.value = myLink; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Link copiato negli appunti.');
}

function share(channel) {
  const msg = 'Ti passo QuantX AI: gestione algoritmica del capitale. Registrati con il mio link: ' + myLink;
  if (channel === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  else if (channel === 'tg') window.open('https://t.me/share/url?url=' + encodeURIComponent(myLink) + '&text=' + encodeURIComponent(msg), '_blank');
  else if (channel === 'sms') window.location.href = 'sms:?&body=' + encodeURIComponent(msg);
  else copyRef();
}

function logout() { localStorage.removeItem(TOKEN_KEY); location.href = 'index.html'; }

window.addEventListener('DOMContentLoaded', () => {
  if (!token) { location.href = 'app.html'; return; }
  load();
});
