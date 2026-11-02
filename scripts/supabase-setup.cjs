#!/usr/bin/env node
// Setup Supabase per QuantX:
// - legge .env (SUPABASE_DB_URL oppure SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF)
// - crea/aggiorna lo schema con le migrations contenute in supabase/migrations
// Uso:
//   node scripts/supabase-setup.cjs          (applica migration via db push)
//   node scripts/supabase-setup.cjs ping     (verifica connessione)
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function readEnv() {
  const f = path.join(root, '.env');
  const env = {};
  if (!fs.existsSync(f)) { console.error('❌ Manca il file .env (prendi esempio da .env.example)'); process.exit(1); }
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !m[2].startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnv();
const dbUrl = env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('❌ In .env manca SUPABASE_DB_URL =postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const cmd = process.argv[2] || 'push';

if (cmd === 'ping') {
  console.log('🔎 Verifica connessione ...');
  const r = spawnSync(npx, ['supabase', 'db', 'url', '--db-url', dbUrl], { cwd: root, encoding: 'utf8', shell: false });
  console.log(r.stdout || r.stderr);
  process.exit(0);
}

console.log('🚀 Applico migrations su Supabase ...');
const r = spawnSync(npx, ['supabase', 'db', 'push', '--db-url', dbUrl, '--include-all'], { cwd: root, encoding: 'utf8', stdio: 'inherit', shell: false });
if (r.status !== 0) { console.error('\n❌ push fallito'); process.exit(r.status || 1); }
console.log('\n✅ Schema creato su Supabase. Ora in Project Settings → API prendi also SUPABASE_URL e service_role per il runtime.');
