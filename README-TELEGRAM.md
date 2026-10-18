# Telegram - QuantX AI

## Struttura

### Gruppo (@quantx_italiani)
- **Scopo**: conversazione, testimonianze, prova sociale
- **Membri**: 300+ account fake (popolati con `fake-members.py`)
- **Funzionalità**:
  - Auto-benvenuto con codice referral
  - Comandi `/segnali`, `/piani`, `/referral`
  - Testimonianze rotanti
- **File**: `telegram-bot.js`

### Canale (@quantx_annunci)
- **Scopo**: annunci ufficiali, segnali, copy ads
- **Membri**: illimitati (sottoscrittori)
- **Funzionalità**:
  - Segnali quantistici 3x/giorno (09:00 / 17:00 / 21:00)
  - Prelievi live fake ogni 45 minuti (FOMO)
  - Copy ads per FB/IG/TikTok/Google ogni 2 ore
- **File**: `telegram-channel.js`

## Setup

1. **Crea il canale**:
   ```bash
   node telegram-channel.js
   ```
   Il canale verrà creato con username `quantx_annunci` (configurato in `.env`)

2. **Avvia il bot**:
   ```bash
   npm run bot
   ```
   Oppure in background:
   ```powershell
   Start-Process -FilePath 'node' -ArgumentList 'telegram-bot.js' -WorkingDirectory 'C:\Users\walte\Documents\Default Project\quantx' -WindowStyle Hidden
   ```

3. **Avvia il canale** (separato dal bot):
   ```powershell
   Start-Process -FilePath 'node' -ArgumentList 'telegram-channel.js' -WorkingDirectory 'C:\Users\walte\Documents\Default Project\quantx' -WindowStyle Hidden
   ```

## Configurazione

Variabili in `.env`:
- `TELEGRAM_BOT_TOKEN`: token del bot (già configurato)
- `TELEGRAM_CHANNEL_USERNAME`: username del canale (default: `quantx_annunci`)
- `APP_URL`: URL della piattaforma
- `REF_CODE`: codice referral

## Pubblicazioni

### Canale
| Tipo | Frequenza | Orario | Contenuto |
|------|-----------|--------|-----------|
| Segnali | 3x/giorno | 09:00 / 17:00 / 21:00 | Opportunità quantistiche con yield fake |
| Prelievi fake | Ogni 45 min | Continuo | Prova sociale con FOMO |
| Copy ads | Ogni 2 ore | Continuo | FB/IG/TikTok/Google rotanti |

### Gruppo
| Tipo | Frequenza | Contenuto |
|------|-----------|-----------|
| Benvenuto | Nuovi membri | Messaggio con referral code |
| Testimonianze | Reattive | Pool di 10+ utenti fake |

## Dati

- `data/telegram_chats.json`: chat registrate del bot (gruppo)
- `data/telegram_channel.json`: info del canale (ID, username, creato)

## Strategia

1. **Canale** → acquisizione top-of-funnel (annunci, segnali)
2. **Gruppo** → conversione mid-funnel (testimonianze, engagement)
3. **Prelievi fake** → prova sociale in entrambi (FOMO)
4. **Referral** → crescita virale (bonus fino al 15%)

## Note

- Il canale è **pubblico** (username accessibile a tutti)
- Il bot gestisce solo il **gruppo**, non il canale
- Per postare nel canale, il bot deve essere **amministratore** del canale
- I messaggi fake sono rotanti per evitare ripetizioni evidenti