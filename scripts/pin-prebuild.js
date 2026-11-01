/*
 * postinstall resilience: make `npm install` succeed on machines where the
 * better-sqlite3 prebuild download can fail (intermittent DNS / proxy hiccups on
 * github.com, or a missing Visual Studio toolchain for the node-gyp fallback).
 *
 * What it does:
 *   1. Backs up prebuild-install's real implementation to index-real.js and
 *      replaces index.js with a retrying wrapper (up to 6 attempts, backoff).
 *   2. Re-runs the install step once if better-sqlite3 has no build/better_sqlite3.node.
 *      prebuild-install is invoked directly (require-based), so its own retry
 *      wrapper applies even if the npm shim is missing.
 *
 * It never fails the install: any error is logged and the process exits 0, so a
 * genuinely broken environment still degrades gracefully to node-gyp rebuild.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BS3_DIR = path.join(ROOT, 'node_modules', 'better-sqlite3');
const PB_DIR = path.join(ROOT, 'node_modules', 'prebuild-install');

function log(msg) {
  try { process.stdout.write('[pin-prebuild] ' + msg + '\n'); } catch (_) {}
}

function hasBuildArtifacts() {
  return fs.existsSync(path.join(BS3_DIR, 'build', 'Release', 'better_sqlite3.node')) ||
         fs.existsSync(path.join(BS3_DIR, 'build', 'better_sqlite3.node'));
}

function ensureWrapper() {
  if (!fs.existsSync(PB_DIR)) return;
  const realPath = path.join(PB_DIR, 'index-real.js');
  const stubPath = path.join(PB_DIR, 'index.js');
  if (!fs.existsSync(realPath) && fs.existsSync(stubPath) && fs.readFileSync(stubPath, 'utf8').includes('index-real.js')) {
    // Already our wrapper; nothing to do.
    return;
  }
  if (fs.existsSync(stubPath)) {
    fs.copyFileSync(stubPath, realPath);
  }
  const wrapper = `
// Resilient prebuild-install wrapper (installed by scripts/pin-prebuild.js).
// Retries the prebuild download a few times; falls back to the original when
// index-real.js is absent (e.g. on a fresh install before unpack completes).
const fs = require('fs');
const path = require('path');
const realPath = path.join(__dirname, 'index-real.js');
let real = null;
try { real = require(realPath); } catch (e) { real = null; }
const MAX_ATTEMPTS = 6;
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function installWithRetry() {
  if (!real || typeof real.install !== 'function') { throw new Error('prebuild-install real implementation unavailable'); }
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try { await real.install(); return; }
    catch (err) {
      lastErr = err;
      process.stderr.write('prebuild-install attempt ' + attempt + '/' + MAX_ATTEMPTS + ' failed: ' + err.message + '\\n');
      if (attempt < MAX_ATTEMPTS) await delay(2500 * attempt);
    }
  }
  throw lastErr;
}
module.exports = Object.assign({}, real, { install: installWithRetry });
if (require.main === module || (process.argv[1] && path.resolve(process.argv[1]) === __filename)) {
  installWithRetry().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
}
`;
  try {
    fs.writeFileSync(stubPath, wrapper);
    log('patched prebuild-install with retry wrapper');
  } catch (e) {
    log('could not patch prebuild-install: ' + e.message);
  }
}

async function main() {
  try {
    if (!fs.existsSync(BS3_DIR)) { log('better-sqlite3 dir missing; skipping'); return; }
    ensureWrapper();
    if (hasBuildArtifacts()) { log('better-sqlite3 build already present; nothing to do'); return; }
    log('better-sqlite3 has no build artifacts; attempting prebuild download with retry...');
    const mod = require(path.join(PB_DIR, 'index.js'));
    if (mod && typeof mod.install === 'function') {
      await mod.install();
      log('prebuild download succeeded');
      return;
    }
    log('prebuild-install module unavailable; leaving to node-gyp fallback');
  } catch (e) {
    log('recovery attempt failed (' + e.message + '); node-gyp fallback will apply');
  }
  // Never fail the install.
}

main().then(() => process.exit(0), () => process.exit(0));
