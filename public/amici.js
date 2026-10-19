// QuantX AI - Pagina Amici: link invito, elenco amici, bonus
const TOKEN_KEY = 'quantx_token';
const token = localStorage.getItem(TOKEN_KEY);

const $ = (id) => document.getElementById(id);
const fmt = (n) => '€' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    'Messaggio pronto: "Ti passo QuantX AI, rendita automatica ogni giorno sul capitale. Registrati con il mio link: ' + myLink + '"';

  const list = refs.list || [];
  if (!list.length) {
    $('friends-list').innerHTML = `
      <p style="color:var(--muted); line-height:1.7">
        Non hai ancora invitato nessuno. Copia il tuo link e condividilo: appena un amico deposita,
        il tuo bonus del 10-17% arriva direttamente sul saldo.
      </p>`;
    return;
  }

  $('friends-list').innerHTML = list.map(f => `
    <div class="signal ${f.active ? 'active' : ''}" style="margin-bottom:10px">
      <div class="info">
        <h4>${f.name}</h4>
        <div class="meta">
          ${f.active
            ? '<span class="win">Attivo</span> · ha depositato ' + fmt(f.deposited) + ' · bonus tuo ' + fmt(f.bonus)
            : 'Registrato, non ha ancora depositato — il bonus si sblocca al primo deposito'}
        </div>
      </div>
      <div style="text-align:right">
        <div style="color:var(--green); font-weight:800">${fmt(f.bonus)}</div>
        <div style="color:var(--muted); font-size:12px">bonus</div>
      </div>
    </div>`).join('');
}

function copyRef() {
  if (navigator.clipboard) navigator.clipboard.writeText(myLink);
  else { const ta = document.createElement('textarea'); ta.value = myLink; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('🔗 Link copiato. Condividilo e guadagna!');
}

function share(channel) {
  const msg = 'Ti passo QuantX AI: rendita automatica ogni giorno sul capitale. Registrati con il mio link: ' + myLink;
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
