// QuantX - Console admin: depositi, prelievi, utenti. Aggiornamento automatico.
const KEY = 'quantx_admin_key';
const $ = (id) => document.getElementById(id);
const fmt = (n) => '€' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + Math.abs(Number(n || 0)).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const dt = (s) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('it-IT');

let currentTab = 'panoramica';
let timer = null;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function currentAuth() {
  // Sessione unificata: se l'account e' gia' collegato nel pannello, si riusa quel token
  return localStorage.getItem(KEY) || localStorage.getItem('quantx_token') || '';
}

async function api(path, opts = {}) {
  const auth = currentAuth();
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(auth ? { 'X-Admin-Key': auth, Authorization: 'Bearer ' + auth } : {}) },
  });
  return res.json();
}

function toggleKeyMode() { /* non serve piu': si entra solo con l'account */ }

async function adminLogin(btn) {
  const email = ($('adm-email') && $('adm-email').value.trim()) || '';
  const password = ($('adm-pass') && $('adm-pass').value) || '';

  if (!email) { $('adm-error').textContent = 'Inserisci email e password.'; return; }

  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = '⏳ Accesso...';

  const data = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(r => r.json()).catch(() => ({ error: 'Errore di rete' }));

  btn.disabled = false;
  btn.textContent = old;

  if (data.error) { $('adm-error').textContent = data.error; return; }

  localStorage.setItem(KEY, data.token || data.key);
  enterPanel();
}

function adminLogout() {
  localStorage.removeItem(KEY);
  if (timer) clearInterval(timer);
  location.href = 'app.html';
}

function enterPanel() {
  $('admin-login').style.display = 'none';
  $('admin-view').style.display = 'block';
  refreshAll();
  if (timer) clearInterval(timer);
  timer = setInterval(refreshAll, 10000);   // si aggiorna da solo
}

function showTab(name, btn) {
  currentTab = name;
  for (const n of ['panoramica', 'depositi', 'prelievi', 'utenti']) {
    $('tab-' + n).style.display = (n === name) ? 'block' : 'none';
  }
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  refreshTab();
}

async function refreshAll() {
  const [ov, daily] = await Promise.all([api('/api/admin/overview'), api('/api/admin/daily')]);
  if (ov.error) { localStorage.removeItem(KEY); location.reload(); return; }

  $('ov-users').textContent = ov.totalUsers;
  $('ov-deposits').textContent = fmt(ov.totalDeposited);
  $('ov-balance').textContent = fmt(ov.totalBalance);
  $('ov-pending').textContent = ov.pendingWithdrawals.length;
  $('pill-pend').textContent = ov.pendingWithdrawals.length;

  $('dy-users').textContent = daily.newUsers;
  $('dy-dep').textContent = fmt(daily.depositsSum);
  $('dy-out').textContent = fmt(daily.withdrawalsSum);
  $('dy-paid').textContent = fmt(daily.paidToday);

  renderPending(ov.pendingWithdrawals);
  renderMovements(ov.recentWithdrawals);
  await refreshTab();
}

async function refreshTab() {
  if (currentTab === 'panoramica' || currentTab === 'depositi') await loadDeposits();
  if (currentTab === 'utenti') await loadUsers();
  if (currentTab === 'prelievi') await loadWithdrawals();
}

function renderPending(list) {
  const html = list.length ? list.map(w => `
    <div class="signal">
      <div class="info">
        <h4>${w.email} — ${fmt(w.amount)} <span style="color:var(--muted); font-size:13px">(fee ${fmt(w.fee)})</span></h4>
        <div class="meta">${dt(w.date)}</div>
      </div>
      <div style="display:flex; gap:8px">
        <button class="btn btn-green" onclick="resolve(${w.id}, this)">Paga</button>
        <button class="btn btn-ghost" onclick="reject(${w.id}, this)">Rifiuta</button>
      </div>
    </div>`).join('') : '<p style="color:var(--muted)">Nessun prelievo in attesa.</p>';
  $('pend-list').innerHTML = html;
  $('pend-list2').innerHTML = html;
}

function renderMovements(list) {
  $('mov-body').innerHTML = (list || []).map(w => `
    <tr>
      <td>Prelievo</td>
      <td>${w.email}</td>
      <td>${fmt(w.amount)}</td>
      <td>${w.status === 'completed' ? '<span style="color:var(--green)">Pagato</span>' : w.status === 'rejected' ? '<span style="color:#ff5c7a">Respinto</span>' : '<span style="color:#f59e0b">In verifica</span>'}</td>
      <td>${dt(w.date)}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="color:var(--muted)">Nessun movimento.</td></tr>';
}

async function loadDeposits() {
  const data = await api('/api/admin/deposits');
  if (data.error) return;
  const list = data.deposits || [];
  $('pill-dep').textContent = list.length;
  $('dep-body').innerHTML = list.length ? list.map(d => `
    <tr>
      <td>${d.email}<div style="color:var(--muted); font-size:12px">${d.name || ''}</div></td>
      <td style="color:var(--green); font-weight:700">${fmt(d.amount)}</td>
      <td>${d.method === 'crypto' ? '<span style="color:#f59e0b">Crypto</span>' : '<span style="color:var(--green)">Carta</span>'}</td>
      <td>${d.plan || '-'}</td>
      <td>${d.confirmed ? '<span style="color:var(--green)">Confermato</span>' : '<span style="color:#f59e0b">In attesa</span>'}</td>
      <td>${dt(d.date)}</td>
      <td>
        <button class="btn btn-ghost" style="padding:6px 12px" onclick="depStatus(${d.id}, 'confermato', this)">Conferma</button>
        <button class="btn btn-ghost" style="padding:6px 12px" onclick="depStatus(${d.id}, 'annullato', this)">Annulla</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="7" style="color:var(--muted)">Nessun deposito.</td></tr>';
}

async function loadWithdrawals() {
  const ov = await api('/api/admin/overview');
  if (ov.error) return;
  renderPending(ov.pendingWithdrawals);
  $('wd-body').innerHTML = (ov.recentWithdrawals || []).map(w => `
    <tr>
      <td>${w.email}</td>
      <td>${fmt(w.amount)}</td>
      <td>${fmt(w.fee)}</td>
      <td>${w.status === 'completed' ? 'Pagato' : w.status === 'rejected' ? 'Respinto' : 'In verifica'}</td>
      <td>${dt(w.date)}</td>
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
      <td><b>${u.activePlans || 0}</b> <span style="color:var(--muted)">(${fmt0(u.investedInPlans || 0)})</span></td>
      <td><input class="input" id="nb-${u.id}" type="number" value="${u.balance}" style="padding:8px 10px; width:110px" /></td>
      <td><button class="btn btn-primary" style="padding:8px 14px" onclick="setBalance(${u.id}, this)">Aggiorna</button></td>
    </tr>`).join('');
}

async function setBalance(id, btn) {
  const val = $(`nb-${id}`).value;
  btn.disabled = true; btn.textContent = '⏳';
  const data = await api('/api/admin/set-balance', { method: 'POST', body: JSON.stringify({ id, balance: val }) });
  btn.disabled = false; btn.textContent = 'Aggiorna';
  if (data.error) return toast(data.error);
  toast('✅ Saldo aggiornato a ' + fmt(data.user.balance));
  loadUsers();
}

async function depStatus(id, status, btn) {
  btn.disabled = true;
  const data = await api('/api/admin/deposit-status', { method: 'POST', body: JSON.stringify({ id, status }) });
  btn.disabled = false;
  if (data.error) return toast(data.error);
  toast('✅ Deposito ' + data.status);
  refreshAll();
}

async function resolve(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const data = await api('/api/admin/resolve-withdrawal', { method: 'POST', body: JSON.stringify({ id, status: 'pagato' }) });
  if (data.error) { if (btn) btn.disabled = false; return toast(data.error); }
  toast('✅ Prelievo pagato');
  refreshAll();
}

async function reject(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const data = await api('/api/admin/resolve-withdrawal', { method: 'POST', body: JSON.stringify({ id, status: 'respinto' }) });
  if (data.error) { if (btn) btn.disabled = false; return toast(data.error); }
  toast('Prelievo respinto');
  refreshAll();
}

// BOOT
window.addEventListener('DOMContentLoaded', async () => {
  if (!currentAuth()) return;
  const ov = await api('/api/admin/overview');
  if (ov.error) { localStorage.removeItem(KEY); return; }
  enterPanel();
});
