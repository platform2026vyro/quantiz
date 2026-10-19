// QuantX AI - Pannello admin: controllo totale su saldi e prelievi
const KEY = 'quantx_admin_key';   // qui salvo la chiave oppure il token di sessione admin
const $ = (id) => document.getElementById(id);
const fmt = (n) => '€' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function currentAuth() { return localStorage.getItem(KEY) || ''; }

async function api(path, opts = {}) {
  const auth = currentAuth();
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { 'X-Admin-Key': auth, Authorization: 'Bearer ' + auth } : {}),
      ...((opts && opts.headers) || {}),
    },
  });
  return res.json();
}

function toggleKeyMode() {
  const w = $('key-wrap');
  const visible = w.style.display !== 'none';
  w.style.display = visible ? 'none' : 'block';
  $('key-toggle').textContent = visible ? 'Usa la chiave admin' : 'Usa email e password';
}

async function adminLogin() {
  const email = ($('adm-email') && $('adm-email').value.trim()) || '';
  const password = ($('adm-pass') && $('adm-pass').value) || '';
  const key = ($('adm-key') && $('adm-key').value) || '';

  if (!email && !key) {
    $('adm-error').textContent = 'Inserisci email e password (oppure la chiave admin).';
    return;
  }

  const data = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email, password } : { key }),
  }).then(r => r.json());

  if (data.error) { $('adm-error').textContent = data.error; return; }

  localStorage.setItem(KEY, data.token || data.key);
  const ov = await api('/api/admin/overview');
  if (ov.error) { $('adm-error').textContent = ov.error; return; }
  enterPanel(ov);
}

function adminLogout() { localStorage.removeItem(KEY); location.href = 'admin.html'; }

function enterPanel(ov) {
  $('admin-login').style.display = 'none';
  $('admin-view').style.display = 'block';
  renderOverview(ov);
  loadUsers();
}

function renderOverview(ov) {
  $('ov-users').textContent = ov.totalUsers;
  $('ov-deposits').textContent = fmt(ov.totalDeposited);
  $('ov-balance').textContent = fmt(ov.totalBalance);
  $('ov-pending').textContent = ov.pendingWithdrawals.length;
  $('pend-list').innerHTML = ov.pendingWithdrawals.length
    ? ov.pendingWithdrawals.map(w => `
      <div class="signal">
        <div class="info">
          <h4>${w.email} — ${fmt(w.amount)} (fee ${fmt(w.fee)})</h4>
          <div class="meta">${new Date(String(w.date).replace(' ', 'T') + 'Z').toLocaleString('it-IT')}</div>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn-green" onclick="resolve(${w.id})">Paga</button>
          <button class="btn btn-ghost" onclick="reject(${w.id})">Rifiuta</button>
        </div>
      </div>`).join('')
    : '<p style="color:var(--muted)">Nessun prelievo in attesa.</p>';

  $('wd-body').innerHTML = (ov.recentWithdrawals || []).map(w => `
    <tr>
      <td>${w.email}</td>
      <td>${fmt(w.amount)}</td>
      <td>${fmt(w.fee)}</td>
      <td>${w.status === 'completed' ? 'Pagato' : w.status === 'rejected' ? 'Respinto' : 'In verifica'}</td>
      <td>${new Date(String(w.date).replace(' ', 'T') + 'Z').toLocaleString('it-IT')}</td>
    </tr>`).join('');
}

async function loadUsers() {
  const data = await api('/api/admin/users');
  if (data.error) return;
  $('users-body').innerHTML = data.users.map(u => `
    <tr>
      <td>${u.email}${u.is_admin ? ' <span style="color:var(--green)">(admin)</span>' : ''}</td>
      <td>${u.name}</td>
      <td style="color:var(--green); font-weight:700">${fmt(u.balance)}</td>
      <td>${fmt(u.deposited)}</td>
      <td>${u.plan || '—'}</td>
      <td>${u.invites} <span style="color:var(--muted)">(${u.refCount} attivi)</span></td>
      <td>${fmt(u.refEarned)}</td>
      <td><input class="input" id="nb-${u.id}" type="number" value="${u.balance}" style="padding:8px 10px; width:110px" /></td>
      <td><button class="btn btn-primary" style="padding:8px 14px" onclick="setBalance(${u.id})">Aggiorna</button></td>
    </tr>`).join('');
}

async function setBalance(id) {
  const val = $(`nb-${id}`).value;
  const data = await api('/api/admin/set-balance', { method: 'POST', body: JSON.stringify({ id, balance: val }) });
  if (data.error) return alert(data.error);
  await refresh();
  alert('✅ Saldo aggiornato a ' + fmt(data.user.balance));
}

async function resolve(id) {
  const data = await api('/api/admin/resolve-withdrawal', { method: 'POST', body: JSON.stringify({ id, status: 'pagato' }) });
  if (data.error) return alert(data.error);
  await refresh();
}

async function reject(id) {
  const data = await api('/api/admin/resolve-withdrawal', { method: 'POST', body: JSON.stringify({ id, status: 'respinto' }) });
  if (data.error) return alert(data.error);
  await refresh();
}

async function refresh() {
  const ov = await api('/api/admin/overview');
  if (ov.error) return;
  renderOverview(ov);
  loadUsers();
}

// BOOT: se ho già una chiave/token valido entro direttamente
window.addEventListener('DOMContentLoaded', async () => {
  if (!currentAuth()) return;
  const ov = await api('/api/admin/overview');
  if (ov.error) { localStorage.removeItem(KEY); return; }
  enterPanel(ov);
});
