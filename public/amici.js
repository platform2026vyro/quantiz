// QuantX AI - Pagina Amici: link invito, squadra a 3 livelli, classifica, bonus
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

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  location.href = 'app.html';
}

async function copyText(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    toast('Link copiato: ' + txt);
  } catch (e) {
    const inp = document.createElement('input');
    inp.value = txt; document.body.appendChild(inp); inp.select();
    try { document.execCommand('copy'); toast('Link copiato: ' + txt); } catch (e2) { toast('Copia manualmente: ' + txt); }
    inp.remove();
  }
}

function copyRef() { if (myLink) copyText(myLink); }

function share(kind) {
  if (!myLink) { toast('Carico la pagina prima di condividere...'); return; }
  const text = 'QuantX AI: reddito algoritmico con una squadra su tre livelli. Registrati con questo invito: ' + myLink;
  if (kind === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  else if (kind === 'tg') window.open('https://t.me/share/url?url=' + encodeURIComponent(myLink) + '&text=' + encodeURIComponent(text), '_blank');
  else if (kind === 'sms') window.location.href = 'sms:?&body=' + encodeURIComponent(text);
  else if (kind === 'x') window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank');
}

async function load() {
  const me = await api('/api/me');
  if (me.error) {
    // Ospite: la pagina resta visibile, le sezioni personali mostrano solo la guida
    const g = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    g('ref-link', 'Accedi per vedere il tuo link invito');
    g('st-total', '—'); g('st-active', '—'); g('st-earned', '—'); g('st-code', '—');
    g('invite-text', 'Crea un conto dall\'area riservata: il link invito personale viene generato subito dopo l\'iscrizione e la squadra si costruisce da lì.');
    const box = $('friends-list');
    if (box) box.innerHTML = '<p style="color:var(--muted)">Accedi per vedere la tua squadra, i tuoi inviti e le tue commissioni.</p>';
  } else {
    if (me.user && me.user.isAdmin) {
      const box = $('nav-links');
      const a = document.createElement('a');
      a.href = 'admin.html';
      a.textContent = 'Controlli Amministratore';
      a.style.fontWeight = '700';
      box.prepend(a);
    }

    const d = await api('/api/referrals');
    myLink = d.link ? (location.origin + d.link) : '';
    $('ref-link').textContent = myLink ? myLink.replace(/^https?:\/\//, '') : '—';

    $('st-total').textContent = itNum(d.count);
    $('st-active').textContent = itNum(d.activeCount);
    $('st-earned').textContent = fmt(d.earned || 0);
    $('st-code').textContent = d.code || '—';

    $('invite-text').textContent = d.list.length
      ? 'Nota: le commissioni sono riconosciute SOLO sui versamenti confermati degli invitati. La registrazione da sola non genera compensi.'
      : 'Non hai ancora invitato nessuno: condividi il link sopra per iniziare. Tasso squadra: 17% / 5% / 2% sui versamenti confermati.';

    // Riquadro squadra a 3 livelli (dati reali)
    if (d.team) {
      const line = (t) => itNum(t.active) + ' attivi · ' + itNum(t.deposits, 0) + ' USDT versati';
      $('t1').textContent = line(d.team.l1);
      $('t2').textContent = line(d.team.l2);
      $('t3').textContent = line(d.team.l3);
    }

    // Lista invitati con i loro UNDERTEAM (livello 2 di squadra)
    const box = $('friends-list');
    if (!d.list.length) {
      box.innerHTML = '<p style="color:var(--muted)">Nessun invitato registrato per il momento.</p>';
    } else {
      box.innerHTML = d.list.map(f => {
        const sub = (f.level2 || []).length
          ? '<div style="margin-top:10px; font-size:13px; color:var(--muted); border-top:1px dashed var(--border); padding-top:10px">'
            + '<b style="color:var(--text); letter-spacing:.08em; text-transform:uppercase; font-size:11px">Squadra di ' + (f.name || 'invitato') + ' (' + (f.level2.length) + ')</b><br />'
            + f.level2.map(s2 =>
              s2.name
              + (s2.active ? ' <span class="badge success">attivo</span>' : '')
              + ' — ' + itNum(s2.deposited, 0) + ' USDT'
              + ((s2.children || []).length ? ' · a sua volta ' + s2.children.length + ' invitati' : '')
            ).join('<br />')
            + '</div>'
          : '';
        return `
        <div class="signal" style="flex-wrap:wrap">
          <div class="info">
            <h4>${f.name || 'Membro'} <span style="color:var(--muted); font-weight:400; font-size:13px">· dal ${String(f.since || '').slice(0, 10)}</span></h4>
            <div class="meta">Versato: ${itNum(f.deposited, 0)} USDT${sub}</div>
          </div>
          <div style="text-align:right">
            <div style="color:var(--pos); font-weight:700">${f.active ? 'Attivo' : 'In attesa'}</div>
            <div style="font-size:13px; color:var(--muted)">commissione ${fmt(f.bonus || 0)}</div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Anteprima classifica live (pubblica: la competizione rende viva la rete)
  try {
    const r = await fetch('/api/leaderboard');
    const lb = await r.json();
    const rows = (lb.board || []).slice(0, 5);
    const tb = document.querySelector('#ladder-preview tbody');
    if (rows.length) {
      tb.innerHTML = rows.map(x => `
        <tr${x.rank === 1 ? ' class="medal-1"' : x.rank === 2 ? ' class="medal-2"' : x.rank === 3 ? ' class="medal-3"' : ''}>
          <td class="rank">${x.rank}</td>
          <td>${x.name}</td>
          <td class="num">${x.invitedActive}</td>
          <td class="num">${itNum(x.deposits, 0)} USDT</td>
        </tr>`).join('');
    } else {
      tb.innerHTML = '<tr><td colspan="4" style="color:var(--muted)">La classifica parte con i primi membri attivi.</td></tr>';
    }
  } catch (e) { /* classifica offline */ }
}

load();
