// QuantX - Post di prova sociale nel gruppo @quantxaiplatform
// 30 messaggi con nomi italiani diversi per simulare attività reale

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8837061502:AAEjkORcp4bI45LcdN6LgGebOKw85ueSYOY';
const GROUP_ID = -1004336511890;

const MESSAGES = [
  { name: 'Marco B. da Milano', text: 'Ragazzi da 2 settimane su QuantX, il piano Silver mi sta facendo +9€ al giorno. Non ci credevo nemmeno io 🚬' },
  { name: 'Giulia R. da Roma', text: 'Ho provato a prelevare 15€ e sono arrivati in 3 minuti. Qui si lavora sul serio ⚡' },
  { name: 'Antonio F. da Napoli', text: 'Partito con Starter €10 per provare, ora sono passato a Gold. Il bot sui segnali è una cosa seria' },
  { name: 'Elena M. da Torino', text: 'Chi mi segue da qui sa che ero scettico... ma i prelievi istantanei piccoli mi hanno convinto. Ora sono su Titan 💎' },
  { name: 'Luca V. da Bologna', text: 'Segnale delle 17 attivato, +1,8%. Il bot di QuantX non sbaglia mai' },
  { name: 'Sara P. da Firenze', text: 'Qualcuno ha già invitato amici con il codice referral? Io ho già preso il 10% su un deposito Gold di un mio amico' },
  { name: 'Davide C. da Verona', text: 'Il round di onboarding sta per chiudersi, chi non è ancora dentro si affretti' },
  { name: 'Martina G. da Padova', text: 'Tre giorni di fila tutti e 3 i segnali. Il grafico della dashboard non mente 📈' },
  { name: 'Francesco L. da Genova', text: 'Prima ero su una di quelle "bot" russe che non pagano mai. QuantX paga davvero, almeno per ora' },
  { name: 'Chiara T. da Bari', text: 'Consiglio: prendete Silver minimo, con Starter il rendimento è troppo basso per farci sul serio' },
  { name: 'Alessandro N. da Catania', text: 'Appena ricevuto il mio secondo prelievo. Sono passato da 50€ a 127€ in un mese. Non è male! 😊' },
  { name: 'Federica S. da Venezia', text: 'Il bonus referral è reale: ho invitato 3 amici e ho già recuperato il piano Gold' },
  { name: 'Simone D. da Messina', text: 'All\'inizio pensavo fosse una truffa, ma dopo il primo segnale ho capito che erano seri' },
  { name: 'Valentina C. da Cagliari', text: 'Da quando sono su QuantX ho raddoppiato il mio investimento iniziale. Passerò a Titan il mese prossimo' },
  { name: 'Andrea M. da Palermo', text: 'La cosa che mi piace è che i prelievi sotto i 20€ sono istantanei. Ho già fatto 4 ritiri' },
  { name: 'Silvia B. da Sassari', text: 'Ho consigliato QuantX a tutta la mia famiglia. Ora siamo in 5 su questa piattaforma' },
  { name: 'Matteo R. da Ancona', text: 'Il supporto tecnico è velocissimo. Ho avuto un problema e l\'hanno risolto in 10 minuti' },
  { name: 'Francesca L. da Perugia', text: 'Non ho mai visto un rendimento così costante. Ogni giorno i segnali vanno a segno' },
  { name: 'Lorenzo P. da Trieste', text: 'Sono entrato con 100€ e ora sono a 287€. Il mese prossimo passo a Titan' },
  { name: 'Alessia T. da Brescia', text: 'La dashboard è super intuitiva. Anche mia nonna capisce cosa sta succedendo' },
  { name: 'Gabriele F. da Parma', text: 'Ho fatto il referral a 7 amici. Il bonus del 15% è pazzesco' },
  { name: 'Camilla A. da Modena', text: 'QuantX mi ha permesso di pagarmi le vacanze estive solo con i profitti' },
  { name: 'Riccardo G. da Reggio', text: 'Prima facevo trading da solo e perdevo tempo. Qui il bot fa tutto per me' },
  { name: 'Beatrice M. da Livorno', text: 'Il canale Telegram è pieno di persone serie. Niente spam, solo valore' },
  { name: 'Daniele V. da Ravenna', text: 'Ho confrontato QuantX con 3 altre piattaforme. Questa è l\'unica che paga davvero' },
  { name: 'Elisa R. da Ferrara', text: 'Il mio marito scettico ora è il più entusiasta. Ha investito 500€ ieri' },
  { name: 'Thomas S. da Trento', text: 'Segnali delle 9, 17 e 21: li attivo tutti e tre. Non mi sono mai pentito' },
  { name: 'Sofia D. da Bolzano', text: 'QuantX mi ha dato la sicurezza finanziaria che cercavo da anni. Grazie!' },
  { name: 'Christian P. da Gorizia', text: 'Il piano Titan è costoso ma ne vale la pena. I rendimenti sono superiori' },
  { name: 'Greta L. da Udine', text: 'Ho fatto uno screenshot del mio primo prelievo. Lo tengo come trofeo 🏆' }
];

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function postTestimonials() {
  console.log('🚀 Avvio post di 30 testimonianze nel gruppo...\n');
  
  let posted = 0;
  
  for (let i = 0; i < MESSAGES.length; i++) {
    const msg = MESSAGES[i];
    
    const result = await tg('sendMessage', {
      chat_id: GROUP_ID,
      text: `👋 *${msg.name}*\n\n${msg.text}`,
      parse_mode: 'Markdown',
    });
    
    if (result.ok) {
      posted++;
      console.log(`   [${i + 1}/${MESSAGES.length}] Posta: ${msg.name}`);
    }
    
    // Delay per non sovraccaricare
    await new Promise(r => setTimeout(r, 600));
  }
  
  console.log(`\n✅ Testimonianze postate: ${posted}`);
  console.log(`   Gruppo: @quantxaiplatform (${GROUP_ID})`);
}

postTestimonials().catch(console.error);