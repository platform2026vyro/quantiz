// QuantX - Popolatore del supergruppo @quantxaiplatform
// Simula 300+ membri italiani nel gruppo per prova sociale

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8837061502:AAEjkORcp4bI45LcdN6LgGebOKw85ueSYOY';
const GROUP_ID = -1004336511890; // ID del supergruppo @quantxaiplatform
const GROUP_USERNAME = 'quantxaiplatform';

// Pool di 100 nomi italiani realistici (ciclici per 300+ membri)
const ITALIAN_NAMES = [
  'Marco B.', 'Giulia R.', 'Antonio F.', 'Elena M.', 'Luca V.', 'Sara P.',
  'Davide C.', 'Martina G.', 'Francesco L.', 'Chiara T.', 'Alessandro N.',
  'Federica S.', 'Simone D.', 'Valentina C.', 'Andrea M.', 'Silvia B.',
  'Matteo R.', 'Francesca L.', 'Lorenzo P.', 'Alessia T.', 'Gabriele F.',
  'Camilla A.', 'Riccardo G.', 'Beatrice M.', 'Daniele V.', 'Elisa R.',
  'Thomas S.', 'Sofia D.', 'Christian P.', 'Greta L.', 'Nicholas C.',
  'Alice B.', 'Pietro G.', 'Vittoria R.', 'Emilio F.', 'Costanza M.',
  'Gianluca T.', 'Serena A.', 'Claudio D.', 'Monica P.', 'Roberto L.',
  'Daniela C.', 'Stefano R.', 'Paola B.', 'Michele G.', 'Laura T.',
  'Antonio M.', 'Carmela F.', 'Salvatore R.', 'Rosaria P.', 'Giuseppe L.',
  'Maria C.', 'Giovanni A.', 'Anna B.', 'Francesco D.', 'Lucia G.',
  'Luigi R.', 'Carmela T.', 'Vincenzo M.', 'Concetta F.', 'Salvo P.',
  'Natale L.', 'Assunta C.', 'Pasquale R.', 'Grazia B.', 'Beniamino G.',
  'Clelia T.', 'Onofrio M.', 'Silvana F.', 'Agata P.', 'Biagio L.',
  'Teresa C.', 'Domenico R.', 'Isabella B.', 'Emiliano G.', 'Carlotta T.',
  'Fabio M.', 'Orsola F.', 'Renato P.', 'Irene L.', 'Umberto C.',
  'Clara R.', 'Guido B.', 'Rita G.', 'Corrado T.', 'Bianca M.',
  'Arrigo F.', 'Vera P.', 'Aldo L.', 'Donatella C.', 'Ermanno R.',
  'Adele B.', 'Gino G.', 'Nadia T.', 'Bruno M.', 'Loretta F.',
  'Walter P.', 'Maddalena L.', 'Sandro C.', 'Cristina R.', 'Enzo B.'
];

const CITIES = ['Milano', 'Roma', 'Napoli', 'Torino', 'Palermo', 'Genova', 
                'Bologna', 'Firenze', 'Bari', 'Catania', 'Venezia', 'Verona'];

// Messaggi di benvenuto/prova sociale
const WELCOME_MESSAGES = [
  "👋 Ciao a tutti! Sono {name} da {city}. Appena entrato su QuantX, non vedo l'ora di iniziare! 🚀",
  "Ciao ragazzi! {name} di {city} qui. Ho sentito parlare bene di QuantX, sono curioso! 😊",
  "👋 Salve! {name} da {city}. Ho visto i segnali, sembrano seri. Mi unisco alla community!",
  "Ciao gruppo! Sono {name}, {city}. Finalmente deciso a provare QuantX 💎",
  "🚀 {name} da {city} è dentro! Ascolto i consigli di voi esperti",
];

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Funzione hash per generare user_id univoci
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

async function populateGroup() {
  console.log('🚀 Avvio popolamento gruppo @' + GROUP_USERNAME + '...\n');
  
  const fs = require('fs');
  const stateFile = 'data/fake_group_members.json';
  
  // Ottieni info sul gruppo
  const groupInfo = await tg('getChat', { chat_id: GROUP_ID });
  
  if (!groupInfo.ok) {
    console.log('❌ Gruppo non trovato!');
    process.exit(1);
  }
  
  const currentMembers = groupInfo.result.member_count || 0;
  console.log(`📊 Gruppo: ${groupInfo.result.title} (@${GROUP_USERNAME})`);
  console.log(`👥 Membri attuali: ${currentMembers}`);
  
  // Target: 315 membri (leggermente sopra 300)
  const targetMembers = 315;
  const membersToAdd = Math.max(0, targetMembers - currentMembers);
  
  console.log(`🎯 Membri da aggiungere: ${membersToAdd}`);
  console.log('');
  
  let addedCount = 0;
  
  for (let i = 0; i < membersToAdd; i++) {
    const name = ITALIAN_NAMES[i % ITALIAN_NAMES.length];
    const city = CITIES[i % CITIES.length];
    const userId = hashCode(name + city) + i * 10000; // ID univoco
    
    // Aggiungi il membro al gruppo
    const addResult = await tg('addChatUser', {
      chat_id: GROUP_ID,
      user_id: userId,
    });
    
    if (addResult.ok) {
      addedCount++;
      
      // Ogni 50 membri, posta un messaggio di benvenuto (simulato)
      if (addedCount % 50 === 0) {
        const message = WELCOME_MESSAGES[i % WELCOME_MESSAGES.length]
          .replace('{name}', name)
          .replace('{city}', city);
        
        await tg('sendMessage', {
          chat_id: GROUP_ID,
          text: message,
        });
        
        console.log(`   ✅ ${addedCount} membri aggiunti (${name} da ${city})`);
      }
    }
    
    // Delay per non sovraccaricare
    await new Promise(r => setTimeout(r, 150));
  }
  
  console.log('');
  console.log('📊 Riepilogo:');
  console.log(`   • Membri aggiunti: ${addedCount}`);
  console.log(`   • Membri totali: ~${currentMembers + addedCount}`);
  console.log(`   • Obiettivo: ${targetMembers} membri`);
  
  // Salva stato
  const state = {
    group_username: GROUP_USERNAME,
    group_id: GROUP_ID,
    target_members: targetMembers,
    members_added: addedCount,
    total_members: currentMembers + addedCount,
    completed_at: new Date().toISOString(),
  };
  
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`\n📁 Stato salvato in ${stateFile}`);
}

populateGroup().catch(console.error);