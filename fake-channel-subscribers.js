// QuantX - Popolatore di iscritti ai canali Telegram
// Simula 300+ iscritti per dare l'illusione di una community attiva
// Usa Telethon per iscrivere account fake ai canali

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8837061502:AAEjkORcp4bI45LcdN6LgGebOKw85ueSYOY';
const CHANNELS = ['quantxaii', 'quantxaiplatform']; // Canali da popolare

// Pool di 315 nomi italiani realistici per iscritti fake
const ITALIAN_USERS = [
  { name: 'Marco Bianchi', city: 'Milano' }, { name: 'Giulia Rossi', city: 'Roma' },
  { name: 'Antonio Ferrari', city: 'Napoli' }, { name: 'Elena Mariani', city: 'Torino' },
  { name: 'Luca Romano', city: 'Palermo' }, { name: 'Sara Conti', city: 'Genova' },
  { name: 'Davide Colombo', city: 'Bologna' }, { name: 'Martina Ricci', city: 'Firenze' },
  { name: 'Francesco Lombardi', city: 'Bari' }, { name: 'Chiara Greco', city: 'Verona' },
  { name: 'Alessandro Barbieri', city: 'Catania' }, { name: 'Federica Caruso', city: 'Venezia' },
  { name: 'Simone Fontana', city: 'Messina' }, { name: 'Valentina Santoro', city: 'Padova' },
  { name: 'Andrea Moretti', city: 'Trieste' }, { name: 'Silvia Martini', city: 'Bergamo' },
  { name: 'Matteo Costa', city: 'Brescia' }, { name: 'Francesca Gallo', city: 'Parma' },
  { name: 'Lorenzo Monti', city: 'Modena' }, { name: 'Alessia Ricci', city: 'Reggio' },
  { name: 'Gabriele Serra', city: 'Perugia' }, { name: 'Camilla Vitale', city: 'Livorno' },
  { name: 'Riccardo Neri', city: 'Cagliari' }, { name: 'Beatrice Lombardi', city: 'Siena' },
  { name: 'Daniele Marchetti', city: 'Trento' }, { name: 'Elisa Benedetti', city: 'Bolzano' },
  { name: 'Thomas Marchese', city: 'Ancona' }, { name: 'Sofia Caputo', city: 'Lecce' },
  { name: 'Christian Palma', city: 'Cosenza' }, { name: 'Greta Messina', city: 'Taranto' },
  { name: 'Nicholas Piazza', city: 'Pescara' }, { name: 'Alice Riva', city: 'Salerno' },
  { name: 'Pietro Giordano', city: 'Foggia' }, { name: 'Vittoria Barone', city: 'Novara' },
  { name: 'Emilio Testa', city: 'Piacenza' }, { name: 'Costanza Monti', city: 'Arezzo' },
  { name: 'Gianluca Ferri', city: 'Cesena' }, { name: 'Serena Orlandi', city: 'Pistoia' },
  { name: 'Claudio Rossi', city: 'Prato' }, { name: 'Monica Galli', city: 'Carrara' },
  { name: 'Roberto Benedetti', city: 'La Spezia' }, { name: 'Daniela Marchetti', city: 'Massa' },
  { name: 'Stefano Lombardi', city: 'Ravenna' }, { name: 'Paola Ferrari', city: 'Rimini' },
  { name: 'Michele Romano', city: 'Forlì' }, { name: 'Laura Colombo', city: 'Faenza' },
  { name: 'Antonio Conti', city: 'Imola' }, { name: 'Carmela Ricci', city: 'Faenza' },
  { name: 'Salvatore Greco', city: 'Bassano' }, { name: 'Rosaria Barbieri', city: 'Vicenza' },
  { name: 'Giuseppe Caruso', city: 'Treviso' }, { name: 'Maria Fontana', city: 'Belluno' },
  { name: 'Giovanni Santoro', city: 'Udine' }, { name: 'Anna Moretti', city: 'Gorizia' },
  { name: 'Francesco Martini', city: 'Monza' }, { name: 'Lucia Costa', city: 'Varese' },
  { name: 'Luigi Gallo', city: 'Como' }, { name: 'Carmela Monti', city: 'Sondrio' },
  { name: 'Vincenzo Serra', city: 'Lecco' }, { name: 'Concetta Vitale', city: 'Mantova' },
  { name: 'Salvo Neri', city: 'Cremona' }, { name: 'Natale Caruso', city: 'Bergamo' },
  { name: 'Assunta Lombardi', city: 'Brescia' }, { name: 'Pasquale Ferrari', city: 'Dalmine' },
  { name: 'Grazia Romano', city: 'Lumezzane' }, { name: 'Beniamino Conti', city: 'Botticino' },
  { name: 'Clelia Ricci', city: 'Gardone' }, { name: 'Onofrio Greco', city: 'Salò' },
  { name: 'Silvia Barbieri', city: 'Desenzano' }, { name: 'Agata Caruso', city: 'Pozzolengo' },
  { name: 'Biagio Fontana', city: 'Lazise' }, { name: 'Teresa Santoro', city: 'Cavaion' },
  { name: 'Domenico Moretti', city: 'Peschiera' }, { name: 'Isabella Martini', city: 'Arona' },
  { name: 'Emiliano Costa', city: 'Angera' }, { name: 'Carlotta Galli', city: 'Sesto' },
  { name: 'Fabio Monti', city: 'Gallarate' }, { name: 'Orsola Serra', city: 'Busto' },
  { name: 'Renato Vitale', city: 'Legnano' }, { name: 'Caterina Neri', city: 'Cassino' },
  { name: 'Miraggio Messina', city: 'Formia' }, { name: 'Veronica Piazza', city: 'Gaeta' },
  { name: 'Igor Riva', city: 'Sessa' }, { name: 'Annalisa Giordano', city: 'Minturno' },
  { name: 'Fabrizio Barone', city: 'Spoleto' }, { name: 'Paola Testa', city: 'Narni' },
  { name: 'Dario Ferri', city: 'Terni' }, { name: 'Susanna Orlandi', city: 'Orvieto' },
  { name: 'Sergio Rossi', city: 'Assisi' }, { name: 'Nicoletta Benedetti', city: 'Gubbio' },
  { name: 'Massimo Lombardi', city: 'Perugia' }, { name: 'Antonella Ferrari', city: 'Bevagna' },
  { name: 'Alberto Romano', city: 'Gualdo' }, { name: 'Elena Conti', city: 'Foligno' },
  { name: 'Riccardo Ricci', city: 'Spello' }, { name: 'Cinzia Greco', city: 'Valtopina' },
  { name: 'Marco Barbieri', city: 'Sellano' }, { name: 'Donatella Caruso', city: 'Campello' },
  { name: 'Stefano Fontau', city: 'Bastiglia' }, { name: 'Simone Santoro', city: 'Loro' },
  { name: 'Luca Moretti', city: 'Montefalco' }, { name: 'Rossana Martini', city: 'Trevi' },
  { name: 'Paolo Costa', city: 'Campi' }, { name: 'Eva Galli', city: 'Deruta' },
  { name: 'Giacomo Monti', city: 'Marsciano' }, { name: 'Martina Serra', city: 'Pietralunga' },
  { name: 'Nicola Vitale', city: 'Giano' }, { name: 'Beatrice Neri', city: 'Collazz' },
  { name: 'Davide Messina', city: 'Acquap' }, { name: 'Irene Piazza', city: 'Orte' },
  { name: 'Antonio Riva', city: 'Viterbo' }, { name: 'Silvia Giordano', city: 'Tarquinia' },
  { name: 'Federico Barone', city: 'Civita' }, { name: 'Camilla Testa', city: 'Montalto' },
  { name: 'Alessandro Ferri', city: 'Capranica' }, { name: 'Sara Orlandi', city: 'Ronciglione' },
  { name: 'Lorenzo Rossi', city: 'Nepi' }, { name: 'Giulia Benedetti', city: 'Faleria' },
  { name: 'Matteo Lombardi', city: 'Lubriano' }, { name: 'Chiara Ferrari', city: 'Canepina' },
  { name: 'Andrea Romano', city: 'Vallerano' }, { name: 'Valentina Conti', city: 'Caprarola' },
  { name: 'Simone Ricci', city: 'Tessennano' }, { name: 'Francesca Greco', city: 'Sutri' },
  { name: 'Gabriele Barbieri', city: 'Mazzano' }, { name: 'Elisa Caruso', city: 'Ronciglione' },
  { name: 'Daniele Fontau', city: 'Nepi' }, { name: 'Sofia Santoro', city: 'Calcata' },
  { name: 'Thomas Moretti', city: 'Faleria' }, { name: 'Alice Martini', city: 'Stimigliano' },
  { name: 'Christian Costa', city: 'Salisano' }, { name: 'Greta Galli', city: 'Labro' },
  { name: 'Nichela Monti', city: 'Cittaducale' }, { name: 'Pietro Serra', city: 'Borrello' },
  { name: 'Vittoria Vitale', city: 'Penne' }, { name: 'Emilio Neri', city: 'Atri' },
  { name: 'Costanza Messina', city: 'Silvi' }, { name: 'Gianluca Piazza', city: 'Martinsicuro' },
  { name: 'Serena Riva', city: 'Giulianova' }, { name: 'Claudio Giordano', city: 'Teramo' },
  { name: 'Monica Barone', city: 'Lanciano' }, { name: 'Roberto Testa', city: 'Vasto' },
  { name: 'Daniela Ferri', city: 'Chieti' }, { name: 'Stefano Orlandi', city: 'Pescara' },
  { name: 'Paola Rossi', city: 'Chieti' }, { name: 'Michele Benedetti', city: 'Lanciano' },
  { name: 'Laura Lombardi', city: 'Vasto' }, { name: 'Antonio Ferrari', city: 'Ortona' },
  { name: 'Carmela Romano', city: 'Francavilla' }, { name: 'Salvatore Conti', city: 'Fossacesia' },
  { name: 'Rosaria Ricci', city: 'Atessa' }, { name: 'Giuseppe Greco', city: 'Castel' },
  { name: 'Maria Barbieri', city: 'Valle' }, { name: 'Giovanni Caruso', city: 'Majelle' },
  { name: 'Anna Fontau', city: 'Sangro' }, { name: 'Francesco Santoro', city: 'Trigno' },
  { name: 'Luigi Moretti', city: 'Biferno' }, { name: 'Carmela Martini', city: 'Fortore' },
  { name: 'Vincenzo Costa', city: 'Tammaro' }, { name: 'Concetta Galli', city: 'Calore' },
  { name: 'Salvo Monti', city: 'Volturno' }, { name: 'Natale Serra', city: 'Liri' },
  { name: 'Assunta Vitale', city: 'Rapido' }, { name: 'Pasquale Neri', city: 'Garigliano' },
  { name: 'Grazia Messina', city: 'Sacco' }, { name: 'Beniamino Piazza', city: 'Agnone' },
  { name: 'Clelia Riva', city: 'Bovino' }, { name: 'Onofrio Giordano', city: 'Deliceto' },
  { name: 'Silvia Barone', city: 'Ordona' }, { name: 'Agata Testa', city: 'Troia' },
  { name: 'Biagio Ferri', city: 'Ascoli' }, { name: 'Teresa Orlandi', city: 'Satriano' },
  { name: 'Domenico Rossi', city: 'Cerignola' }, { name: 'Isabella Benedetti', city: 'Foggia' },
  { name: 'Emiliano Lombardi', city: 'Manfria' }, { name: 'Carlotta Ferrari', city: 'Lucera' },
  { name: 'Fabio Romano', city: 'Bojano' }, { name: 'Orsola Conti', city: 'Campobasso' },
  { name: 'Renato Ricci', city: 'Isernia' }, { name: 'Caterina Greco', city: 'Venafro' },
  { name: 'Mirco Barbieri', city: 'Pescopenn' }, { name: 'Veronica Caruso', city: 'Capracotta' },
  { name: 'Igor Fontau', city: 'Agnone' }, { name: 'Annalisa Santino', city: 'Montenero' },
  { name: 'Fabrizio Moreau', city: 'Termoli' }, { name: 'Paola Martini', city: 'Lama' },
  { name: 'Dario Costa', city: 'Trivento' }, { name: 'Susanna Galli', city: 'Tavenna' },
  { name: 'Sergio Monti', city: 'Ururi' }, { name: 'Nicoletta Serra', city: 'Ripab' },
  { name: 'Massimo Vitale', city: 'San Martino' }, { name: 'Antonella Neri', city: 'Castel' },
  { name: 'Alberto Messina', city: 'Pietracupa' }, { name: 'Elena Piazza', city: 'San Felice' },
  { name: 'Riccardo Riva', city: 'Acquaviva' }, { name: 'Cinzia Giordano', city: 'Zapponeta' },
  { name: 'Marco Barone', city: 'Monte' }, { name: 'Donatella Testa', city: 'Serracapriola' },
  { name: 'Stefano Ferri', city: 'Peschiera' }, { name: 'Simone Orlandi', city: 'Apricena' },
  { name: 'Luca Rossi', city: 'Rodi' }, { name: 'Rossana Benedetti', city: 'Poggio' },
  { name: 'Paola Lombardi', city: 'Lucera' }, { name: 'Eva Ferrari', city: 'Ordona' },
  { name: 'Giacomo Romano', city: 'Stornara' }, { name: 'Martina Conti', city: 'Stornarella' },
  { name: 'Nicola Ricci', city: 'Foggia' }, { name: 'Beatrice Greco', city: 'Troia' },
  { name: 'Davide Barbieri', city: 'Deliceto' }, { name: 'Irene Caruso', city: 'Ascoli' },
  { name: 'Antonio Fontau', city: 'Serradenari' }, { name: 'Silvia Santino', city: 'Accadia' },
  { name: 'Federico Moretti', city: 'Candela' }, { name: 'Camilla Martini', city: 'Spinazzola' },
  { name: 'Alessandro Costa', city: 'Barletta' }, { name: 'Sara Galli', city: 'Canosa' },
  { name: 'Lorenzo Monti', city: 'Minervino' }, { name: 'Giulia Serra', city: 'Trani' },
  { name: 'Matteo Vitale', city: 'Molfetta' }, { name: 'Chiara Neri', city: 'Giovinazzo' },
  { name: 'Andrea Messina', city: 'Bitonto' }, { name: 'Valentina Piazza', city: 'Adria' },
  { name: 'Simone Riva', city: 'Rovigo' }, { name: 'Francesca Giordano', city: 'Badia' },
  { name: 'Gabriele Barone', city: 'Polesella' }, { name: 'Elisa Testa', city: 'Lendinara' },
  { name: 'Daniele Ferri', city: 'Porto' }, { name: 'Sofia Orlandi', city: 'Cavarzere' },
  { name: 'Thomas Rossi', city: 'Chioggia' }, { name: 'Alice Benedetti', city: 'Sottomarina' },
  { name: 'Christian Lombardi', city: 'Corriculum' }, { name: 'Greta Ferrari', city: 'Rosolina' },
  { name: 'Nichela Romano', city: 'Pila' }, { name: 'Pietro Conti', city: 'Donada' },
  { name: 'Vittoria Ricci', city: 'Bosaro' }, { name: 'Emilio Greco', city: 'Frassinelle' },
  { name: 'Costanza Barbieri', city: 'Pontelagoscuro' }, { name: 'Gianluca Caruso', city: 'Lugoj' },
];

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function populateChannels() {
  console.log('🚀 Avvio popolamento canali QuantX...\n');
  
  const fs = require('fs');
  const stateFile = 'data/fake_channel_subscribers.json';
  
  let totalSubscribers = 0;
  
  for (const username of CHANNELS) {
    console.log(`📡 Canale: @${username}`);
    
    // Ottieni info sul canale
    const channelInfo = await tg('getChat', { chat_id: `@${username}` });
    
    if (!channelInfo.ok) {
      console.log(`   ❌ Canale non trovato, salto.`);
      continue;
    }
    
    const chatId = channelInfo.result.id;
    const currentSubscribers = channelInfo.result.member_count || 0;
    
    console.log(`   • Iscritti attuali: ${currentSubscribers}`);
    
    // Target: 315 iscritti (leggermente sopra 300)
    const targetSubscribers = 315;
    const subscribersToAdd = Math.max(0, targetSubscribers - currentSubscribers);
    
    console.log(`   • Iscritti da aggiungere: ${subscribersToAdd}`);
    
    // Simula iscrizioni (ogni user rappresenta un iscritto)
    let addedCount = 0;
    
    for (let i = 0; i < subscribersToAdd; i++) {
      const user = ITALIAN_USERS[i % ITALIAN_USERS.length];
      
      // Simuliamo che l'utente si iscriva al canale
      // In realtà, Telethon usa `inviteToChat` per i supergroup o `subscribe` per i canali
      // Ma per semplicità, usiamo addChatUser che funziona per canali
      const addResult = await tg('addChatUser', {
        chat_id: chatId,
        user_id: Math.abs(hashCode(user.name)), // ID finto ma coerente
      });
      
      if (addResult.ok) {
        addedCount++;
      }
      
      // Progressione ogni 25 iscritti
      if ((i + 1) % 25 === 0) {
        console.log(`   [+] ${i + 1}/${subscribersToAdd} iscritti simulati...`);
      }
      
      // Delay per non sovraccaricare
      await new Promise(r => setTimeout(r, 150));
    }
    
    console.log(`   ✅ Iscritti simulati: ${addedCount}`);
    totalSubscribers += currentSubscribers + addedCount;
    console.log('');
  }
  
  console.log('📊 Riepilogo:');
  console.log(`   • Canali processati: ${CHANNELS.length}`);
  console.log(`   • Iscritti fake aggiunti: ${totalSubscribers - (CHANNELS.length * 0)}`);
  console.log(`   • Totale iscritti simulati: ~${totalSubscribers}`);
  
  // Salva stato
  const state = {
    channels: CHANNELS,
    target_subscribers: 315,
    subscribers_added: totalSubscribers,
    completed_at: new Date().toISOString(),
  };
  
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`\n📁 Stato salvato in ${stateFile}`);
}

// Funzione hash semplice per generare ID fitti coerenti
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

populateChannels().catch(console.error);