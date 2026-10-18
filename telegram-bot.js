// QuantX AI - Bot Telegram: la leva dell'engagement giornaliero
// Spinge gli utenti a fare le 3 giocate al giorno.
// Uso: imposta TELEGRAM_BOT_TOKEN e l'APP_URL, poi `npm run bot`
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000/app.html';
const CHATS_FILE = path.join(__dirname, 'data', 'telegram_chats.json');

// Lista chat da spamare. In produzione: uno per ogni "investitore" acquisito.
const chats = fs.existsSync(CHATS_FILE)
  ? JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'))
  : [];

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
    `👉 Attiva ora: ${APP_URL}`
  );
}

async function pushSignals() {
  if (!chats.length) {
    console.log('Nessuna chat registrata. Aggiungi gli ID in data/telegram_chats.json');
    return;
  }
  const msg = signalMessage();
  for (const chatId of chats) {
    await tg('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'Markdown' });
  }
  console.log(`Segnali spinti a ${chats.length} utenti`);
}

async function main() {
  if (!TOKEN) {
    console.log('Imposta TELEGRAM_BOT_TOKEN per partire.');
    process.exit(1);
  }
  const me = await tg('getMe');
  console.log(`Bot attivo: ${me.result.username}`);

  // Registra chi scrive al bot -> aggiungilo alla lista di push
  const lastUpdate = { id: 0 };
  setInterval(async () => {
    const up = await tg('getUpdates', { offset: lastUpdate.id + 1, timeout: 1 });
    for (const u of up.result) {
      lastUpdate.id = u.update_id;
      const chatId = u.message?.chat?.id;
      if (chatId && !chats.includes(chatId)) {
        chats.push(chatId);
        fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
        await tg('sendMessage', {
          chat_id: chatId,
          text: `Benvenuto su QuantX AI ⚡\nOgni giorno il bot ti invierà i segnali quantistici. Attivali tutti e 3 o perderai il profitto.\n\n${APP_URL}`,
        });
      }
    }
  }, 5000);

  // Push giornalieri alle 09:00, 17:00, 21:00 (ora locale)
  setInterval(async () => {
    const h = new Date().getHours();
    if ([9, 17, 21].includes(h)) await pushSignals();
  }, 60000);
}

main().catch(console.error);
