// QuantX AI - Pannello admin: controllo totale su saldi e prelievi
const KEY = 'quantx_admin_key';
const $ = (id) => document.getElementById(id);
const fmt = (n) => '€' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': localStorage.getItem(KEY) || '' },
  });
  return res.json();
}

async function adminLogin() {
  const key = $('adm-key').value;
  const data = await api('/api/admin/overview', { headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key } });
  if (data.error) return $('adm-error').textContent = 'Chiave errata. Accesso negato.';
  localStorage.setItem(KEY, key);
  enterPanel(data);
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
          <div class="meta">${new Date(w.date).toLocaleString('it-IT')}</div>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn-green" onclick="resolve('${w.email}','${w.date}','pagato')">Paga</button>
          <button class="btn btn-ghost" onclick="resolve('${w.email}','${w.date}','respinto')">Rifiuta</button>
        </div>
      </div>`).join('')
    : '<p style="color:var(--muted)">Nessun prelievo in attesa.</p>';
}

async function loadUsers() {
  const data = await api('/api/admin/users');
  if (data.error) return;
  $('users-body').innerHTML = data.users.map(u => `
    <tr>
      <td>${u.email}</td>
      <td>${u.name}</td>
      <td style="color:var(--green); font-weight:700">${fmt(u.balance)}</td>
      <td>${fmt(u.totalDeposited)}</td>
      <td>${u.plan || '—'}</td>
      <td>${u.refCount} (+${fmt(u.refEarned)})</td>
      <td><input class="input" id="nb-${u.id}" type="number" value="${u.balance}" style="padding:8px 10px; width:110px" /></td>
      <td><button class="btn btn-primary" style="padding:8px 14px" onclick="setBalance('${u.id}')">Aggiorna</button></td>
    </tr>`).join('');
}

async function setBalance(id) {
  const val = $(`nb-${id}`).value;
  const data = await api('/api/admin/set-balance', { method: 'POST', body: JSON.stringify({ id, balance: val }) });
  if (data.error) return alert(data.error);
  await refresh();
  alert('✅ Saldo aggiornato a ' + fmt(data.user.balance));
}

async function resolve(email, date, status) {
  await api('/api/admin/resolve-withdrawal', { method: 'POST', body: JSON.stringify({ email, date, status }) });
  await refresh();
}

async function refresh() {
  const ov = await api('/api/admin/overview');
  renderOverview(ov);
  loadUsers();
}

// BOOT
window.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem(KEY)) return;
  const ov = await api('/api/admin/overview');
  if (ov.error) return;
  enterPanel(ov);
});
