// QuantX - Creator di bot iscritti ai canali
// Genera 100 bot che si iscrivono ai canali per simulare una community attiva

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8837061502:AAEjkORcp4bI45LcdN6LgGebOKw85ueSYOY';
const CHANNELS = ['quantxaii', 'quantxaiplatform'];

// Pool di nomi italiani per i bot
const BOT_NAMES = [
  'Marco_B_QuantX', 'Giulia_R_Trader', 'Antonio_F_Invest', 'Elena_M_Crypto',
  'Luca_V_Titan', 'Sara_P_Silver', 'Davide_C_Gold', 'Martina_G_Fan',
  'Francesco_L_Follower', 'Chiara_T_Supporter', 'Alessandro_N_Italian',
  'Federica_S_Trader', 'Simone_D_QuantX', 'Valentina_C_Invest',
  'Andrea_M_Crypto', 'Silvia_B_Fan', 'Matteo_R_Italian', 'Francesca_L_User',
  'Lorenzo_P_Trader', 'Alessia_T_QuantX', 'Gabriele_F_Invest', 'Camilla_A_Crypto',
  'Riccardo_G_Follower', 'Beatrice_M_Supporter', 'Daniele_V_Italian', 'Elisa_R_User',
  'Thomas_S_Trader', 'Sofia_D_QuantX', 'Christian_P_Invest', 'Greta_L_Crypto',
  'Nicholas_C_Fan', 'Alice_B_Follower', 'Pietro_G_Supporter', 'Vittoria_R_Italian',
  'Emilio_F_User', 'Costanza_M_Trader', 'Gianluca_T_QuantX', 'Serena_A_Invest',
  'Claudio_D_Crypto', 'Monica_P_Fan', 'Roberto_L_Follower', 'Daniela_C_Supporter',
  'Stefano_R_Italian', 'Paola_B_User', 'Michele_G_Trader', 'Laura_T_QuantX',
  'Antonio_M_Invest', 'Carmela_F_Crypto', 'Salvatore_R_Fan', 'Rosaria_P_Follower',
  'Giuseppe_L_Supporter', 'Maria_C_Italian', 'Giovanni_A_User', 'Anna_B_Trader',
  'Francesco_D_QuantX', 'Lucia_G_Invest', 'Luigi_R_Crypto', 'Carmela_T_Fan',
  'Vincenzo_M_Follower', 'Concetta_F_Supporter', 'Salvo_P_Italian', 'Natale_L_User',
  'Assunta_C_Trader', 'Pasquale_R_QuantX', 'Grazia_B_Invest', 'Beniamino_G_Crypto',
  'Clelia_T_Fan', 'Onofrio_M_Follower', 'Silvana_F_Supporter', 'Agata_P_Italian',
  'Biagio_L_User', 'Teresa_C_Trader', 'Domenico_R_QuantX', 'Isabella_B_Invest',
  'Emiliano_G_Crypto', 'Carlotta_T_Fan', 'Fabio_M_Follower', 'Orsola_F_Supporter',
  'Renato_P_Italian', 'Irene_L_User', 'Umberto_C_Trader', 'Clara_R_QuantX',
  'Guido_B_Invest', 'Rita_G_Crypto', 'Corrado_T_Fan', 'Bianca_M_Follower',
  'Arrigo_F_Supporter', 'Vera_P_Italian', 'Aldo_L_User', 'Donatella_C_Trader',
  'Ermanno_R_QuantX', 'Adele_B_Invest', 'Gino_G_Crypto', 'Nadia_T_Fan',
  'Bruno_M_Follower', 'Loretta_F_Supporter', 'Walter_P_Italian', 'Maddalena_L_User'
];

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Funzione hash per generare user_id univoci ma coerenti
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

async function createFakeBots() {
  console.log('🚀 Avvio creazione bot iscritti...\n');
  
  const fs = require('fs');
  const stateFile = 'data/fake_subscribers.json';
  
  let totalBotsCreated = 0;
  
  // Ottieni info sui canali
  for (const username of CHANNELS) {
    console.log(`📡 Canale: @${username}`);
    
    const channelInfo = await tg('getChat', { chat_id: `@${username}` });
    
    if (!channelInfo.ok) {
      console.log(`   ❌ Canale non trovato, salto.`);
      continue;
    }
    
    const chatId = channelInfo.result.id;
    const currentMembers = channelInfo.result.member_count || 0;
    
    console.log(`   • Iscritti attuali: ${currentMembers}`);
    
    // Target: 100 bot per canale (per dare l'illusione di una community)
    const targetBots = 100;
    const botsToCreate = targetBots; // Creiamo sempre 100 bot
    
    console.log(`   • Bot da creare: ${botsToCreate}`);
    
    // Crea bot e iscriviti al canale
    let createdCount = 0;
    const botIds = [];
    
    for (let i = 0; i < botsToCreate; i++) {
      const botName = BOT_NAMES[i % BOT_NAMES.length]; // Usa modulo per evitare undefined
      const userId = hashCode(botName) + i * 1000; // ID univoco
      
      // Iscrivi il bot al canale (simulato)
      const subscribeResult = await tg('addChatUser', {
        chat_id: chatId,
        user_id: userId,
      });
      
      if (subscribeResult.ok) {
        createdCount++;
        botIds.push({ name: botName, user_id: userId });
      }
      
      // Progressione ogni 10 bot
      if ((i + 1) % 10 === 0) {
        console.log(`   [+] ${i + 1}/${botsToCreate} bot iscritti...`);
      }
      
      // Delay per non sovraccaricare
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`   ✅ Bot iscritti: ${createdCount}`);
    totalBotsCreated += createdCount;
    console.log('');
  }
  
  console.log('📊 Riepilogo:');
  console.log(`   • Canali processati: ${CHANNELS.length}`);
  console.log(`   • Total bot iscritti: ${totalBotsCreated}`);
  console.log(`   • Per canale: ~${totalBotsCreated / CHANNELS.length}`);
  
  // Salva stato
  const state = {
    channels: CHANNELS,
    bot_count: totalBotsCreated,
    bots_per_channel: totalBotsCreated / CHANNELS.length,
    completed_at: new Date().toISOString(),
  };
  
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`\n📁 Stato salvato in ${stateFile}`);
}

createFakeBots().catch(console.error);