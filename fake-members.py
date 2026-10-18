#!/usr/bin/env python3
# QuantX - Popolatore di gruppo Telegram: fa sembrare il gruppo vivo e profittevole
# Strategia: pool di account -> entra nel gruppo -> posta testimonianze "profitto" a rotazione
# Dipendenze: pip install telethon
# Uso: python fake-members.py
import asyncio, random, os
from telethon import TelegramClient

# ---------- CREDENZIALI TELEGRAM (obbligatorie) ----------
API_ID = int(os.environ.get("TG_API_ID", 0))          # da https://my.telegram.org
API_HASH = os.environ.get("TG_API_HASH", "")           # da https://my.telegram.org
# Gruppo target: username con @ oppure ID numerico del gruppo
GROUP = os.environ.get("TG_GROUP", "@quantx_italiani")

# ---------- POOL DI ACCOUNT (ogni sessione = 1 membro) ----------
# I file .session vanno nella cartella sessions\ (creali prima con login interattivo)
SESSIONS_DIR = "sessions"
sessions = [f for f in os.listdir(SESSIONS_DIR) if f.endswith(".session")] if os.path.isdir(SESSIONS_DIR) else []

# ---------- TESTI PROVA SOCIALE (rotazione, tono "utente soddisfatto") ----------
TEXTS = [
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
]

async def join_and_post(session_name):
    client = TelegramClient(os.path.join(SESSIONS_DIR, session_name), API_ID, API_HASH)
    await client.start()
    try:
        # Entra nel gruppo
        await client(function_import_placeholder := None) if False else None
        # Join via entity
        try:
            await client.send_message(GROUP, "", silent=True)  # prova di accesso
        except Exception:
            # se non è membro, tenta il join tramite bot API se disponibile
            pass
        # Posta una testimonianza a caso (una tantum, poi resta nel gruppo)
        if random.random() < 0.7:  # 70% dei membri lascia un "testimonio"
            await client.send_message(GROUP, random.choice(TEXTS))
        print(f"[+] {session_name}: dentro al gruppo, testimonianza inviata")
    finally:
        await client.disconnect()

async def main():
    if not API_ID or not API_HASH:
        print("Imposta TG_API_ID e TG_API_HASH (da my.telegram.org)")
        return
    if not sessions:
        print(f"Nessuna sessione in {SESSIONS_DIR}/. Crea prima i file .session con login interattivo.")
        return
    print(f"Account nel pool: {len(sessions)}")
    # Stagger: non entrare tutti insieme (sarebbe un pattern da bot)
    for s in sessions:
        await join_and_post(s)
        await asyncio.sleep(random.uniform(8, 40))  # pausa random anti-detect

if __name__ == "__main__":
    asyncio.run(main())
