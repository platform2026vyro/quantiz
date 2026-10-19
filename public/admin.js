// QuantX - Console admin: depositi, prelievi, account, ledger. Aggiornamento automatico.
const KEY = 'quantx_admin_key';
const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + Math.abs(Number(n || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n || 0) < 0 ? '-' : '') + '€' + Math.abs(Number(n || 0)).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const dt = (s) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

let currentTab = 'panoramica';
let timer = null;

function toast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function currentAuth() { return localStorage.getItem(KEY) || ''; }

async function api(path, opts = {}) {
  const auth = currentAuth();
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(auth ? { 'X-Admin-Key': auth, Authorization: 'Bearer ' + auth } : {}) },
  });
  return res.json();
}

function toggleKeyMode() {
  const w = $('key-wrap');
  const visible = w.style.display !== 'none';
  w.style.display = visible ? 'none' : 'block';
  $('key-toggle').textContent = visible ? 'Usa la chiave' : 'Usa email e password';
}

async function adminLogin(btn) {
  const email = ($('adm-email') && $('adm-email').value.trim()) || '';
  const password = ($('adm-pass') && $('adm-pass').value) || '';
  const key = ($('adm-key') && $('adm-key').value) || '';

  if (!email && !key) { $('adm-error').textContent = 'Inserisci email e password.'; return; }

  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = 'Accesso...';

  const data = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email, password } : { key }),
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
  location.href = 'index.html';
}

function enterPanel() {
  $('admin-login').style.display = 'none';
  $('admin-view').style.display = 'block';
  refreshAll();
  if (timer) clearInterval(timer);
  timer = setInterval(refreshAll, 12000);
}

function showTab(name, btn) {
  currentTab = name;
  for (const n of ['panoramica', 'depositi', 'prelievi', 'utenti', 'movimenti']) {
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
  $('ov-users-sub').textContent = ov.inactiveUsers + ' senza deposito';
  $('ov-deposits').textContent = fmt0(ov.totalDeposited);
  $('ov-deposits-sub').textContent = ov.totalUsers + ' account aperti';
  $('ov-balance').textContent = fmt0(ov.totalBalance);
  $('ov-balance-sub').textContent = 'saldi registrati';
  $('ov-pending').textContent = ov.pendingWithdrawals.length;
  $('ov-pending-sub').textContent = ov.pendingWithdrawals.length ? fmt0(ov.pendingWithdrawals.reduce((a, w) => a + w.amount, 0)) + ' da decidere' : 'nessuna coda';
  $('pill-pend').textContent = ov.pendingWithdrawals.length;

  $('dy-users').textContent = daily.newUsers;
  $('dy-dep').textContent = fmt0(daily.depositsSum);
  $('dy-out').textContent = fmt0(daily.withdrawalsSum);
  $('dy-paid').textContent = fmt0(daily.paidToday);

  renderPending(ov.pendingWithdrawals);
  await refreshTab();
}

async function refreshTab() {
  if (currentTab === 'panoramica' || currentTab === 'depositi') await loadDeposits();
  if (currentTab === 'utenti') await loadUsers();
  if (currentTab === 'prelievi') await loadWithdrawals();
  if (currentTab === 'movimenti') await loadLedger();
}

function renderPending(list) {
  const html = list.length ? list.map(w => `
    <div class="signal">
      <div class="info">
        <h4>${w.email} — ${fmt(w.amount)} <span class="muted" style="font-weight:400">(fee ${fmt(w.fee)})</span></h4>
        <div class="meta">${dt(w.date)}</div>
      </div>
      <div style="display:flex; gap:8px">
        <button class="btn btn-success btn-sm" onclick="resolve(${w.id}, this)">Paga</button>
        <button class="btn btn-danger btn-sm" onclick="reject(${w.id}, this)">Rifiuta</button>
      </div>
    </div>`).join('') : '<div class="empty">Nessun prelievo in attesa.</div>';
  $('pend-list').innerHTML = html;
  $('pend-list2').innerHTML = html;
}

async function loadDeposits() {
  const data = await api('/api/admin/deposits');
  if (data.error) return;
  const list = data.deposits || [];
  $('pill-dep').textContent = list.length;
  $('dep-body').innerHTML = list.length ? list.map(d => `
    <tr>
      <td>${d.email}<div class="muted" style="font-size:12px">${d.name || ''}</div></td>
      <td class="right num pos">${fmt(d.amount)}</td>
      <td>${d.plan || '—'}</td>
      <td>${d.confirmed ? '<span class="badge success">Confermato</span>' : '<span class="badge warning">In attesa</span>'}</td>
      <td class="muted nowrap">${dt(d.date)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="depStatus(${d.id}, 'confermato', this)">Conferma</button>
        <button class="btn btn-danger btn-sm" onclick="depStatus(${d.id}, 'annullato', this)">Annulla</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty">Nessun deposito registrato.</div></td></tr>';
}

async function loadWithdrawals() {
  const ov = await api('/api/admin/overview');
  if (ov.error) return;
  renderPending(ov.pendingWithdrawals);
  $('wd-body').innerHTML = (ov.recentWithdrawals || []).map(w => {
    const badge = w.status === 'completed' ? '<span class="badge success">Pagato</span>'
      : w.status === 'rejected' ? '<span class="badge danger">Respinto</span>'
      : '<span class="badge warning">In verifica</span>';
    return '<tr><td>' + w.email + '</td><td class="right num">' + fmt(w.amount) + '</td><td class="right num muted">' + fmt(w.fee) + '</td><td>' + badge + '</td><td class="muted nowrap">' + dt(w.date) + '</td></tr>';
  }).join('') || '<tr><td colspan="5"><div class="empty">Nessun prelievo.</div></td></tr>';
}

async function loadUsers() {
  const data = await api('/api/admin/users');
  if (data.error) return;
  $('users-body').innerHTML = data.users.map(u => `
    <tr>
      <td>${u.email}${u.is_admin ? ' <span class="badge info">admin</span>' : ''}</td>
      <td>${u.name || '—'}</td>
      <td class="right num pos">${fmt(u.balance)}</td>
      <td class="right num muted">${fmt(u.deposited)}</td>
      <td>${u.plan || '—'}</td>
      <td class="right num">${u.invites}<div class="muted" style="font-size:12px">${u.refCount} attivi</div></td>
      <td class="right num">${fmt(u.refEarned)}</td>
      <td class="right"><input class="input" id="nb-${u.id}" type="number" value="${u.balance}" style="padding:7px 9px; width:100px; text-align:right" /></td>
      <td><button class="btn btn-primary btn-sm" onclick="setBalance(${u.id}, this)">Salva</button></td>
    </tr>`).join('');
}

async function loadLedger() {
  const data = await api('/api/admin/ledger');
  if (data.error) return;
  const labels = { deposit: 'Deposito', withdraw: 'Prelievo', signal: 'Segnale', referral: 'Bonus invito', adjust: 'Correzione' };
  $('ledger-body').innerHTML = (data.entries || []).map(e => `
    <tr>
      <td>${e.email}</td>
      <td>${labels[e.kind] || e.kind}</td>
      <td class="muted">${e.meta || '—'}</td>
      <td class="right num ${e.amount >= 0 ? 'pos' : 'neg'}">${e.amount >= 0 ? '+' : ''}${fmt(e.amount)}</td>
      <td class="right num muted">${fmt(e.balanceAfter)}</td>
      <td class="muted nowrap">${dt(e.createdAt)}</td>
    </tr>`).join('') || '<tr><td colspan="6"><div class="empty">Ledger vuoto.</div></td></tr>';
}

async function setBalance(id, btn) {
  const val = $('nb-' + id).value;
  btn.disabled = true; btn.textContent = '...';
  const data = await api('/api/admin/set-balance', { method: 'POST', body: JSON.stringify({ id, balance: val }) });
  btn.disabled = false; btn.textContent = 'Salva';
  if (data.error) return toast(data.error, 'err');
  toast('Saldo aggiornato a ' + fmt(data.user.balance), 'ok');
  loadUsers();
}

async function depStatus(id, status, btn) {
  btn.disabled = true;
  const data = await api('/api/admin/deposit-status', { method: 'POST', body: JSON.stringify({ id, status }) });
  btn.disabled = false;
  if (data.error) return toast(data.error, 'err');
  toast('Deposito ' + data.status, 'ok');
  refreshAll();
}

async function resolve(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  const data = await api('/api/admin/resolve-withdrawal', { method: 'POST', body: JSON.stringify({ id, status: 'pagato' }) });
  if (data.error) { if (btn) btn.disabled = false; return toast(data.error, 'err'); }
  toast('Prelievo pagato', 'ok');
  refreshAll();
}

async function reject(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  const data = await api('/api/admin/resolve-withdrawal', { method: 'POST', body: JSON.stringify({ id, status: 'respinto' }) });
  if (data.error) { if (btn) btn.disabled = false; return toast(data.error, 'err'); }
  toast('Prelievo respinto');
  refreshAll();
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!currentAuth()) return;
  const ov = await api('/api/admin/overview');
  if (ov.error) { localStorage.removeItem(KEY); return; }
  enterPanel();
});
