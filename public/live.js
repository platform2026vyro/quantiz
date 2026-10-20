// QuantX - controllo versione: se il sito viene aggiornato, la pagina si ricarica da sola
(function () {
  const KEY = 'quantx_version';
  const CHECK_EVERY = 45000;   // ogni 45 secondi

  async function check() {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      const data = await res.json();
      if (!data || !data.v) return;
      const saved = localStorage.getItem(KEY);
      if (saved && saved !== data.v) {
        // il server e' stato aggiornato: ricarica per prendere il codice nuovo
        localStorage.setItem(KEY, data.v);
        location.reload();
        return;
      }
      if (!saved) localStorage.setItem(KEY, data.v);
    } catch (e) { /* rete instabile: si riprova al giro dopo */ }
  }

  window.addEventListener('DOMContentLoaded', check);
  setInterval(check, CHECK_EVERY);
  // controlla anche quando l'utente torna sulla scheda
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
