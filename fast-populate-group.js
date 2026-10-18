// QuantX - Aggiunta rapida di membri al gruppo @quantxaiplatform
// Aggiunge 300+ membri in parallelo per velocità

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8837061502:AAEjkORcp4bI45LcdN6LgGebOKw85ueSYOY';
const GROUP_ID = -1004336511890;

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

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

async function fastPopulate() {
  console.log('⚡ Avvio aggiunta rapida di 300 membri...\n');
  
  const targetMembers = 315;
  const membersToAdd = targetMembers;
  
  // Aggiungo 50 membri in parallelo per batch
  const batchSize = 50;
  const batches = Math.ceil(membersToAdd / batchSize);
  
  let totalAdded = 0;
  
  for (let batch = 0; batch < batches; batch++) {
    console.log(`📦 Batch ${batch + 1}/${batches} (${batchSize} membri)...`);
    
    const promises = [];
    const startIdx = batch * batchSize;
    
    for (let i = 0; i < batchSize; i++) {
      const name = ITALIAN_NAMES[(startIdx + i) % ITALIAN_NAMES.length];
      const userId = hashCode(name) + (startIdx + i) * 10000;
      
      promises.push(
        tg('addChatUser', {
          chat_id: GROUP_ID,
          user_id: userId,
        }).then(result => {
          if (result.ok) totalAdded++;
        })
      );
    }
    
    await Promise.all(promises);
    console.log(`   ✅ Batch completato. Membri aggiunti: ${totalAdded}\n`);
    
    // Delay tra i batch
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('📊 Riepilogo:');
  console.log(`   • Membri aggiunti: ${totalAdded}`);
  console.log(`   • Target: ${targetMembers}`);
  console.log(`   • Completato: ${((totalAdded / targetMembers) * 100).toFixed(1)}%\n`);
  
  // Verifica finale
  const finalCheck = await tg('getChatMemberCount', { chat_id: GROUP_ID });
  console.log(`📈 Membri reali nel gruppo: ${finalCheck.result}`);
}

fastPopulate().catch(console.error);