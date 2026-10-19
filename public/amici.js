// QuantX AI - Pagina referral: dati reali
const TOKEN_KEY = 'quantx_token';
const token = localStorage.getItem(TOKEN_KEY);

const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + Math.abs(Number(n || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + Math.abs(Number(n || 0)).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const dt = (s) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

function toast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  setTimeout(() => t.classList.remove('show'), 3200);
}

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
    if (box && !$('nav-admin')) {
      const a = document.createElement('a');
      a.id = 'nav-admin';
      a.href = 'admin.html';
      a.className = 'btn btn-ghost';
      a.textContent = 'Console';
      box.insertBefore(a, box.firstChild);
    }
  }

  const refs = await api('/api/referrals');
  if (refs.error) { toast('Errore nel caricamento dei dati', 'err'); return; }

  $('st-total').textContent = refs.count;
  $('st-total-sub').textContent = 'registrati con il tuo codice';
  $('st-active').textContent = refs.activeCount;
  $('st-active-sub').textContent = 'hanno attivato un piano';
  $('st-earned').textContent = fmt0(refs.earned);
  $('st-earned-sub').textContent = 'accreditati sul saldo';
  $('st-code').textContent = refs.code;

  myLink = location.origin + '/app.html?ref=' + refs.code;
  $('ref-link').textContent = myLink;
  $('invite-text').textContent = 'Messaggio pronto: "Sto usando QuantX AI, piattaforma di trading quantitativo con segnali automatici. Prova anche tu: ' + myLink + '"';

  const list = refs.list || [];
  $('friends-count').textContent = list.length + (list.length === 1 ? ' invito' : ' inviti');
  const body = $('friends-body');
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="5"><div class="empty"><strong>Nessun invito ancora</strong>Condividi il link: quando un amico attiva un piano, il bonus appare in questa tabella.</div></td></tr>';
    return;
  }
  body.innerHTML = list.map(f => {
    const badge = f.active
      ? '<span class="badge success">Attivo</span>'
      : '<span class="badge">In attesa</span>';
    const dep = f.active ? fmt(f.deposited) : '<span class="muted">—</span>';
    const bonus = f.bonus > 0 ? '<span class="pos">' + fmt(f.bonus) + '</span>' : '<span class="muted">—</span>';
    return '<tr>' +
      '<td>' + f.name + '</td>' +
      '<td>' + badge + '</td>' +
      '<td class="right num">' + dep + '</td>' +
      '<td class="right num">' + bonus + '</td>' +
      '<td class="muted nowrap">' + dt(f.since) + '</td>' +
    '</tr>';
  }).join('');
}

function copyRef() {
  if (navigator.clipboard) navigator.clipboard.writeText(myLink);
  else { const ta = document.createElement('textarea'); ta.value = myLink; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Link copiato', 'ok');
}

function share(channel) {
  const msg = 'Sto usando QuantX AI, piattaforma di trading quantitativo con segnali automatici. Prova anche tu: ' + myLink;
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
