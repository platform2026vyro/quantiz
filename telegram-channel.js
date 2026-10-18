// QuantX AI - Canale Telegram: annunci ufficiali, segnali e prova sociale
// Funzioni: creazione canale, post segnali 9/17/21, prelievi fake, copy ads
// Uso: imposta TELEGRAM_BOT_TOKEN, CHANNEL_USERNAME poi `node telegram-channel.js`

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME || 'quantx_annunci';
const CHANNEL2_USERNAME = process.env.TELEGRAM_CHANNEL2_USERNAME || 'quantxaiplatform';
const APP_URL = process.env.APP_URL || 'https://quantx-ai.top/app.html';
const REF_CODE = process.env.REF_CODE || '';

const CHANNEL_FILE = path.join(__dirname, 'data', 'telegram_channel.json');
const CHANNEL2_FILE = path.join(__dirname, 'data', 'telegram_channel2.json');

// ------- Prova sociale: prelievi fake rotanti per creare FOMO -------
const FAKES = [
  { n: 'Marco B.', c: 'Milano', a: 247.50 }, { n: 'Giulia R.', c: 'Roma', a: 183.20 },
  { n: 'Antonio F.', c: 'Napoli', a: 312.80 }, { n: 'Elena M.', c: 'Torino', a: 156.40 },
  { n: 'Luca V.', c: 'Bologna', a: 428.90 }, { n: 'Sara P.', c: 'Firenze', a: 198.60 },
  { n: 'Davide C.', c: 'Verona', a: 275.30 }, { n: 'Martina G.', c: 'Padova', a: 164.10 },
  { n: 'Francesco L.', c: 'Genova', a: 389.70 }, { n: 'Chiara T.', c: 'Bari', a: 221.50 },
];

function fakePayoutMessage() {
  const f = FAKES[Math.floor(Math.random() * FAKES.length)];
  const now = new Date();
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return (
    `✅ *PRELIEVO APPROVATO — ${time}*\n\n` +
    `👤 *${f.n}*\n📍 ${f.c}\n💰 *€${f.a.toFixed(2)}*\n\n` +
    `⚡ Status: *Completato*\n🔒 KYC: *Verificato*\n\n` +
    `Il prossimo round di onboarding inizia tra 48 ore. Non restare fuori.\n\n` +
    `👉 ${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}`
  );
}

function signalMessage() {
  const hour = new Date().getHours();
  const n = hour < 9 ? 1 : hour < 17 ? 2 : 3;
  const yieldPct = (0.6 + Math.random() * 1.2).toFixed(2);
  return (
    `⚡ *SEGNALE QUANTISTICO #${n} — ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}* ⚡\n\n` +
    `🧠 *Opportunità identificata*\n` +
    `📈 *Rendimento stimato:* +${yieldPct}%\n` +
    `⏰ *Scadenza:* mezzanotte di oggi\n\n` +
    `⚠️ *Attenzione:* se non attivi il segnale entro 24h, perdi il diritto al round.\n\n` +
    `🔗 Attiva ora: ${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}\n\n` +
    `#QuantX #AI #Trading #Segnale${n}`
  );
}

function copyAdMessage(platform) {
  const yields = { fb: '+1,8%/giorno', ig: '+2,5%/giorno', tiktok: '+3,5%/giorno', google: '+1,2%/giorno' };
  const ctas = { fb: 'Scopri di più', ig: 'Attiva ora', tiktok: 'Entra prima', google: 'Prova gratis' };
  const colors = { fb: '🔵', ig: '🟣', tiktok: '⚫', google: '🔴' };
  
  return (
    `${colors[platform]} *QuantX AI — Il futuro del trading è qui*\n\n` +
    `💠 Piano da €10 solo per i primi 100 iscritti\n` +
    `📊 Rendimenti fino a ${yields[platform]} con IA quantistica\n` +
    `🎁 Bonus referral fino al 15% a vita\n\n` +
    `${ctas[platform]} 👉 ${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}\n\n` +
    `#${platform === 'tiktok' ? 'QuantUM' : 'QuantX'} #AI #Investimento #Ponzi #Trading`
  );
}

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function createChannel(username, outputFile) {
  if (!TOKEN) {
    console.log('Imposta TELEGRAM_BOT_TOKEN per creare il canale.');
    process.exit(1);
  }

  console.log(`🔍 Ricerca canale @${username}...`);
  
  // Prima controllo se esiste il file di stato salvato
  if (fs.existsSync(outputFile)) {
    const savedData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    console.log(`✅ Canale salvato: ${savedData.title} (@${username})`);
    
    // Verifico che il bot sia ancora admin
    try {
      const chatInfo = await tg('getChat', { chat_id: savedData.id });
      if (chatInfo.ok) {
        console.log(`   → Verificato: bot è amministratore`);
        return savedData.id;
      }
    } catch (e) {
      console.log(`   ⚠️ Errore verifica, riprovo via username...`);
    }
  }
  
  // Prova a ottenere info sul canale esistente via API
  try {
    const chatInfo = await tg('getChat', { chat_id: `@${username}` });
    if (chatInfo.ok) {
      console.log(`✅ Canale esistente: ${chatInfo.result.title} (@${username})`);
      
      // Salva info canale
      const channelData = {
        id: chatInfo.result.id,
        username: username,
        title: chatInfo.result.title,
        discovered_at: new Date().toISOString(),
      };
      
      const channelDir = path.dirname(outputFile);
      if (!fs.existsSync(channelDir)) {
        fs.mkdirSync(channelDir, { recursive: true });
      }
      fs.writeFileSync(outputFile, JSON.stringify(channelData, null, 2));
      
      return chatInfo.result.id;
    }
  } catch (e) {
    console.log(`ℹ️ Canale @${username} non trovato via API, procedo con la creazione...`);
  }

  // Crea nuovo canale (senza username inizialmente)
  const createResult = await tg('createChannel', {
    title: 'QuantX AI — Annunci Ufficiali',
    description: `🤖 Canale ufficiale di QuantX AI\n\n📊 Segnali quantistici 3x/giorno (09:00 / 17:00 / 21:00)\n💸 Prelievi live verificati\n🎁 Bonus referral fino al 15%\n\n👉 ${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}`,
  });
  
  if (!createResult.ok) {
    console.error('❌ Errore creazione canale:', createResult);
    return null;
  }
  
  // Imposta username separatamente
  const chatId = createResult.result.chat_id;
  const setUsernameResult = await tg('setChatUsername', { 
    chat_id: chatId, 
    username: username
  });
  
  if (!setUsernameResult.ok) {
    console.error('❌ Errore impostazione username:', setUsernameResult);
    // Continua comunque, il canale è creato
  }

  console.log(`✅ Canale creato: ${createResult.result.title} (@${username})`);
  
  // Salva info canale
  const channelData = {
    id: createResult.result.id,
    username: username,
    title: createResult.result.title,
    created_at: new Date().toISOString(),
  };
  
  const channelDir = path.dirname(outputFile);
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(channelData, null, 2));
  
  return channelData.id;
}

async function postToChannel(chatId, text) {
  if (!chatId) {
    console.log('⚠️ Nessun ID canale, riprovo tra 5 secondi...');
    await new Promise(r => setTimeout(r, 5000));
    const retry = await tg('getChat', { chat_id: `@${CHANNEL_USERNAME}` });
    if (retry.ok) chatId = retry.result.id;
  }
  
  const result = await tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
  
  return result.ok ? result.result.message_id : null;
}

async function main() {
  console.log('🚀 Avvio sistema canali QuantX AI...\n');
  
  // 1. Crea/ottiene entrambi i canali
  const channelId = await createChannel(CHANNEL_USERNAME, CHANNEL_FILE);
  const channelId2 = await createChannel(CHANNEL2_USERNAME, CHANNEL2_FILE);
  
  if (!channelId && !channelId2) {
    console.error('❌ Nessun canale disponibile, arresto.');
    process.exit(1);
  }
  
  console.log(`\n⚡ Canali attivi:`);
  if (channelId) console.log(`   • @${CHANNEL_USERNAME}`);
  if (channelId2) console.log(`   • @${CHANNEL2_USERNAME}`);
  console.log('');
  
  // 2. Post di benvenuto (solo se i canali sono nuovi)
  if (!fs.existsSync(CHANNEL_FILE) && channelId) {
    const welcomeMsg = (
      `🎉 *Benvenuti su QuantX AI*\n\n` +
      `Sei nel canale ufficiale degli annunci.\n\n` +
      `📊 *Cosa riceverai:*\n` +
      `• 3 segnali quantistici al giorno (09:00 / 17:00 / 21:00)\n` +
      `• Prelievi live verificati (prova sociale)\n` +
      `• Bonus e promozioni esclusive\n\n` +
      `🎁 *Bonus di benvenuto:*\n` +
      `Usa il codice referral e guadagna fino al 15% sui depositi degli amici.\n\n` +
      `👉 Attiva il tuo account: ${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}\n\n` +
      `#QuantX #Benvenuto #AI #Trading`
    );
    
    await postToChannel(channelId, welcomeMsg);
    console.log('✅ Post di benvenuto pubblicato su @' + CHANNEL_USERNAME);
  }
  
  if (!fs.existsSync(CHANNEL2_FILE) && channelId2) {
    const welcomeMsg2 = (
      `🎉 *Benvenuti su QuantX AI*\n\n` +
      `Sei nel canale ufficiale degli annunci.\n\n` +
      `📊 *Cosa riceverai:*\n` +
      `• 3 segnali quantistici al giorno (09:00 / 17:00 / 21:00)\n` +
      `• Prelievi live verificati (prova sociale)\n` +
      `• Bonus e promozioni esclusive\n\n` +
      `🎁 *Bonus di benvenuto:*\n` +
      `Usa il codice referral e guadagna fino al 15% sui depositi degli amici.\n\n` +
      `👉 Attiva il tuo account: ${APP_URL}${REF_CODE ? `?ref=${REF_CODE}` : ''}\n\n` +
      `#QuantX #Benvenuto #AI #Trading`
    );
    
    await postToChannel(channelId2, welcomeMsg2);
    console.log('✅ Post di benvenuto pubblicato su @' + CHANNEL2_USERNAME);
  }
  
  // 3. Loop principale: segnali 9/17/21 + prelievi fake ogni 45min
  setInterval(async () => {
    const h = new Date().getHours();
    if ([9, 17, 21].includes(h)) {
      const signalMsg = signalMessage();
      
      // Posta su entrambi i canali
      if (channelId) {
        const msgId = await postToChannel(channelId, signalMsg);
        console.log(`[${new Date().toISOString()}] Segnale #${h < 9 ? 1 : h < 17 ? 2 : 3} su @${CHANNEL_USERNAME} (ID: ${msgId})`);
      }
      
      if (channelId2) {
        const msgId2 = await postToChannel(channelId2, signalMsg);
        console.log(`[${new Date().toISOString()}] Segnale #${h < 9 ? 1 : h < 17 ? 2 : 3} su @${CHANNEL2_USERNAME} (ID: ${msgId2})`);
      }
    }
  }, 60000); // Controllo ogni minuto
  
  setInterval(async () => {
    const fakeMsg = fakePayoutMessage();
    
    if (channelId) {
      const msgId = await postToChannel(channelId, fakeMsg);
      console.log(`[${new Date().toISOString()}] Prelievo fake su @${CHANNEL_USERNAME} (ID: ${msgId})`);
    }
    
    if (channelId2) {
      const msgId2 = await postToChannel(channelId2, fakeMsg);
      console.log(`[${new Date().toISOString()}] Prelievo fake su @${CHANNEL2_USERNAME} (ID: ${msgId2})`);
    }
  }, 45 * 60 * 1000); // Ogni 45 minuti
  
  // 4. Copy ads: FB/IG/TikTok/Google ogni 2 ore (simulazione posting multi-piattaforma)
  const platforms = ['fb', 'ig', 'tiktok', 'google'];
  let platformIndex = 0;
  setInterval(async () => {
    const adMsg = copyAdMessage(platforms[platformIndex]);
    
    if (channelId) {
      const msgId = await postToChannel(channelId, adMsg);
      console.log(`[${new Date().toISOString()}] Copy ${platforms[platformIndex]} su @${CHANNEL_USERNAME} (ID: ${msgId})`);
    }
    
    if (channelId2) {
      const msgId2 = await postToChannel(channelId2, adMsg);
      console.log(`[${new Date().toISOString()}] Copy ${platforms[platformIndex]} su @${CHANNEL2_USERNAME} (ID: ${msgId2})`);
    }
    
    platformIndex = (platformIndex + 1) % platforms.length;
  }, 2 * 60 * 60 * 1000); // Ogni 2 ore
  
  console.log('ℹ️  Piani di pubblicazione:');
  console.log('   • Segnali: ore 9, 17, 21');
  console.log('   • Prelievi fake: ogni 45 minuti');
  console.log('   • Copy ads: ogni 2 ore (FB/IG/TikTok/Google)');
}

main().catch(console.error);
