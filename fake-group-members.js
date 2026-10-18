// QuantX - Simulatore di membri attivi nel gruppo Telegram
// Usa il bot per entrare nel gruppo e postare messaggi di prova sociale
// Simula 300+ membri con nomi italiani realistici

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8837061502:AAEjkORcp4bI45LcdN6LgGebOKw85ueSYOY';
const GROUP_USERNAME = process.env.GROUP_USERNAME || 'quantx_italiani';

// Pool di nomi italiani realistici per simulare 300+ membri
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
  'Luigi R.', 'Carmela T.', 'Vincenzo M.', ' Concetta F.', 'Salvo P.',
  'Natale L.', 'Assunta C.', 'Pasquale R.', 'Grazia B.', 'Beniamino G.',
  'Clelia T.', 'Onofrio M.', 'Silvana F.', 'Agata P.', 'Biagio L.',
  'Teresa C.', 'Domenico R.', 'Isabella B.', 'Emiliano G.', 'Carlotta T.',
  'Fabio M.', 'Orsola F.', 'Renato P.', 'Irene L.', 'Umberto C.',
  'Clara R.', 'Guido B.', 'Rita G.', 'Corrado T.', 'Bianca M.',
  'Arrigo F.', 'Vera P.', 'Aldo L.', 'Donatella C.', 'Ermanno R.',
  'Adele B.', 'Gino G.', 'Nadia T.', 'Bruno M.', 'Loretta F.',
  'Walter P.', 'Maddalena L.', 'Sandro C.', 'Cristina R.', 'Enzo B.',
  'Elvira G.', 'Armando T.', 'Gloria M.', 'Vito F.', 'Tanja P.',
  'Renzo L.', 'Patrizia C.', 'Claudia R.', 'Ivan B.', 'Sabrina G.',
  'Marcello T.', 'Emanuela M.', 'Renato F.', 'Caterina P.', 'Mirko L.',
  'Veronica C.', 'Igor R.', 'Annalisa B.', 'Fabrizio G.', 'Paola T.',
  'Dario M.', 'Susanna F.', 'Sergio P.', 'Nicoletta L.', 'Massimo C.',
  'Antonella R.', 'Alberto B.', 'Elena G.', 'Riccardo T.', 'Cinzia M.',
  'Marco F.', 'Donatella P.', 'Stefano L.', 'Simona C.', 'Luca R.',
  'Rossana B.', 'Paolo G.', 'Eva T.', 'Giacomo M.', 'Martina F.',
  'Nicola P.', 'Beatrice L.', 'Davide C.', 'Irene R.', 'Antonio B.',
  'Silvia G.', 'Federico T.', 'Camilla M.', 'Alessandro F.', 'Sara P.',
  'Lorenzo L.', 'Giulia C.', 'Matteo R.', 'Chiara B.', 'Andrea G.',
  'Valentina T.', 'Simone M.', 'Francesca F.', 'Gabriele P.', 'Elisa L.',
  'Daniele C.', 'Sofia R.', 'Thomas B.', 'Alice G.', 'Christian T.',
  'Greta M.', 'Nicholas F.', 'Pietro P.', 'Vittoria L.', 'Emilio C.',
  'Costanza R.', 'Gianluca B.', 'Serena G.', 'Claudio T.', 'Monica M.'
];

const CITIES = ['Milano', 'Roma', 'Napoli', 'Torino', 'Palermo', 'Genova', 
                'Bologna', 'Firenze', 'Bari', 'Catania', 'Venezia', 'Verona',
                'Messina', 'Padova', 'Trieste', 'Bergamo', 'Brescia', 'Parma'];

// Messaggi di prova sociale realistici
const TESTIMONIANZE = [
  "Ragazzi da 2 settimane su QuantX, il piano Silver mi sta facendo +9€ al giorno. Non ci credevo nemmeno io 🚬",
  "Ho provato a prelevare 15€ e sono arrivati in 3 minuti. Qui si lavora sul serio ⚡",
  "Partito con Starter €10 per provare, ora sono passato a Gold. Il bot sui segnali è una cosa seria",
  "Chi mi segue da qui sa che ero scettico... ma i prelievi istantanei piccoli mi hanno convinto. Ora sono su Titan 💎",
  "Segnale delle 17 attivato, +1,8%. Il bot di QuantX non sbaglia mai",
  "Qualcuno ha già invitato amici con il codice referral? Io ho già preso il 10% su un deposito Gold di un mio amico",
  "Il round di onboarding sta per chiudersi, chi non è ancora dentro si affretti",
  "Tre giorni di fila tutti e 3 i segnali. Il grafico della dashboard non mente 📈",
  "Prima ero su una di quelle 'bot' russe che non pagano mai. QuantX paga davvero, almeno per ora",
  "Consiglio: prendete Silver minimo, con Starter il rendimento è troppo basso per farci sul serio",
  "Appena ricevuto il mio secondo prelievo. Sono passata da 50€ a 127€ in un mese. Non è male! 😊",
  "Il bonus referral è reale: ho invitato 3 amici e ho già recuperato il piano Gold",
  "All'inizio pensavo fosse una truffa, ma dopo il primo segnale ho capito che erano seri",
  "Da quando sono su QuantX ho raddoppiato il mio investimento iniziale. Passerò a Titan il mese prossimo",
  "La cosa che mi piace è che i prelievi sotto i 20€ sono istantanei. Ho già fatto 4 ritiri",
];

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function populateGroup() {
  console.log(`🚀 Avvio popolamento gruppo @${GROUP_USERNAME}...\n`);
  
  // Ottieni info sul gruppo
  const groupInfo = await tg('getChat', { chat_id: `@${GROUP_USERNAME}` });
  
  if (!groupInfo.ok) {
    console.log(`❌ Gruppo @${GROUP_USERNAME} non trovato.`);
    console.log('Assicurati che il bot sia aggiunto come membro.');
    process.exit(1);
  }
  
  const chatId = groupInfo.result.id;
  const currentMembers = groupInfo.result.member_count || 0;
  
  console.log(`📊 Gruppo: ${groupInfo.result.title}`);
  console.log(`👥 Membri attuali: ${currentMembers}`);
  console.log(`🎯 Target: 300+ membri\n`);
  
  // Calcola quanti membri aggiungere
  const targetMembers = 315; // Leggermente sopra 300
  const membersToAdd = Math.max(0, targetMembers - currentMembers);
  
  console.log(`➕ Aggiungo ${membersToAdd} membri fake...\n`);
  
  // Simula l'aggiunta di membri (ogni nome rappresenta un membro)
  let addedCount = 0;
  
  for (let i = 0; i < membersToAdd; i++) {
    const name = ITALIAN_NAMES[i % ITALIAN_NAMES.length];
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const message = TESTIMONIANZE[Math.floor(Math.random() * TESTIMONIANZE.length)];
    
    // Simula un messaggio dal gruppo (ogni membro posta una volta)
    const postResult = await tg('sendMessage', {
      chat_id: chatId,
      text: `👋 Ciao a tutti! Sono ${name} da ${city}.\n\n${message}\n\n#QuantX #Investimento #Italia`,
      parse_mode: 'Markdown',
    });
    
    addedCount++;
    
    // Stampa progressione ogni 10 membri
    if ((i + 1) % 10 === 0) {
      console.log(`   [+] ${i + 1}/${membersToAdd} membri simulati...`);
    }
    
    // Piccolo delay per non sovraccaricare l'API
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n✅ Popolamento completato!`);
  console.log(`   • Membri simulati: ${addedCount}`);
  console.log(`   • Messaggi postati: ${addedCount}`);
  console.log(`   • Gruppo @${GROUP_USERNAME} ora sembra attivo con ${currentMembers + addedCount} membri\n`);
  
  // Salva stato
  const stateFile = 'data/fake_group_state.json';
  const state = {
    group_username: GROUP_USERNAME,
    target_members: targetMembers,
    members_added: addedCount,
    total_simulated: currentMembers + addedCount,
    completed_at: new Date().toISOString(),
  };
  
  const fs = require('fs');
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`📁 Stato salvato in ${stateFile}`);
}

populateGroup().catch(console.error);