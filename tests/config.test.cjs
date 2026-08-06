/**
 * Validates vercel.json against the keys Vercel's schema actually accepts.
 * Run: node tests/config.test.cjs
 *
 * Exists because a stray "comment" key inside a headers entry failed the whole
 * production build — Vercel rejects unknown properties, and the only signal was
 * an ERROR deployment. This catches it before it is pushed.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else { fail++; failures.push(label); console.error('  ✗ FAIL: ' + label); }
}

const raw = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
let cfg = null;
try { cfg = JSON.parse(raw); ok(true, 'vercel.json is valid JSON'); }
catch (e) { ok(false, 'vercel.json is valid JSON: ' + e.message); }

if (cfg) {
  const TOP = ['functions', 'headers', 'redirects', 'rewrites', 'routes',
    'cleanUrls', 'trailingSlash', 'regions', 'buildCommand', 'outputDirectory',
    'installCommand', 'devCommand', 'framework', 'ignoreCommand', 'crons',
    'images', 'public', 'git', '$schema'];
  const badTop = Object.keys(cfg).filter(k => !TOP.includes(k));
  ok(badTop.length === 0, 'no unknown top-level keys: ' + JSON.stringify(badTop));

  const ROUTE_KEYS = ['source', 'headers', 'has', 'missing', 'destination',
    'permanent', 'statusCode'];
  (cfg.headers || []).forEach((entry, i) => {
    const bad = Object.keys(entry).filter(k => !ROUTE_KEYS.includes(k));
    ok(bad.length === 0, `headers[${i}] has only schema keys (found extra: ${JSON.stringify(bad)})`);
    ok(typeof entry.source === 'string' && entry.source.length > 0, `headers[${i}] has a source`);
    ok(Array.isArray(entry.headers) && entry.headers.length > 0, `headers[${i}] has header entries`);
    (entry.headers || []).forEach((h, j) => {
      const hb = Object.keys(h).filter(k => k !== 'key' && k !== 'value');
      ok(hb.length === 0, `headers[${i}].headers[${j}] has only key/value (found: ${JSON.stringify(hb)})`);
      ok(typeof h.key === 'string' && typeof h.value === 'string',
        `headers[${i}].headers[${j}] key/value are strings`);
    });
  });

  // The shell must never be cached hard, or a deploy looks like it didn't ship.
  const shell = (cfg.headers || []).filter(e => e.source === '/' || e.source === '/index.html');
  ok(shell.length === 2, 'both / and /index.html have cache rules');
  ok(shell.every(e => e.headers.some(h =>
      h.key.toLowerCase() === 'cache-control' && /must-revalidate|no-store|no-cache/.test(h.value))),
    'the HTML shell is always revalidated');

  Object.keys(cfg.functions || {}).forEach(f => {
    ok(fs.existsSync(path.join(__dirname, '..', f)), `functions entry exists on disk: ${f}`);
  });
}

// Every versioned script referenced by index.html must exist.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const srcs = [...html.matchAll(/<script src="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);
ok(srcs.length >= 4, 'index.html loads the engine scripts (' + srcs.length + ')');
srcs.forEach(s => ok(fs.existsSync(path.join(__dirname, '..', s)), 'script exists: ' + s));

console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? ':\n  - ' + failures.join('\n  - ') : ' ✓'));
process.exit(fail ? 1 : 0);
