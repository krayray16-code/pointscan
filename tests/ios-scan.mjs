// iPhone scanner verification.
// Simulates iOS Safari (no BarcodeDetector, iPhone UA) and feeds Chromium a
// fake camera. Exercises the exact path an iPhone takes:
// getUserMedia -> ZXing decodeFromStream -> barcode -> lookup -> points.
//
// Phase A uses a camera showing a real EAN-13 barcode (decode correctness).
// Phase B uses a blank camera so the scanner stays open (lifecycle checks).
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { createRequire } from 'module';
const require = createRequire(process.env.PW_MODULES || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = join(import.meta.dirname, '..');
const SCRATCH = join(import.meta.dirname, 'fixtures');
const EXPECTED = readFileSync(join(SCRATCH, 'barcode.txt'), 'utf8').trim();
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/off/')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 1, product: {
      product_name: 'Test Cola', brands: 'TestBrand',
      nutriments: { 'energy-kcal_serving': 140, 'sugars_serving': 39, 'proteins_serving': 0, 'saturated-fat_serving': 0, 'fiber_serving': 0 },
      serving_size: '12 fl oz', categories_tags: ['en:beverages','en:sodas']
    }}));
    return;
  }
  const f = join(ROOT, url === '/' ? '/index.html' : url);
  if (existsSync(f)) { res.setHeader('Content-Type', MIME[extname(f)] || 'text/plain'); res.end(readFileSync(f)); }
  else { res.statusCode = 404; res.end('nope'); }
});
await new Promise(r => server.listen(8932, r));

const fails = [];
const check = (c, l) => { if (c) console.log('  ✓ ' + l); else { fails.push(l); console.log('  ✗ ' + l); } };
const errors = [];

async function openIphone(videoFile) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
           `--use-file-for-fake-video-capture=${join(SCRATCH, videoFile)}`]
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    permissions: ['camera']
  });
  const page = await ctx.newPage();
  // THE KEY BIT: strip BarcodeDetector so the app must use ZXing, as on a real iPhone.
  await page.addInitScript(() => {
    delete window.BarcodeDetector;
    const orig = window.fetch;
    window.fetch = (u, o) => {
      if (typeof u === 'string' && u.includes('openfoodfacts.org/api')) {
        window.__scannedCode = u.match(/product\/(\d+)\.json/)[1];
        return orig('/off/' + window.__scannedCode + '.json', o);
      }
      return orig(u, o);
    };
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8932/');
  await page.waitForTimeout(400);
  return { browser, page };
}

// ── Phase A: decode a real barcode off the live stream ──
console.log('Phase A — live decode (camera shows a real EAN-13):');
{
  const { browser, page } = await openIphone('barcode.y4m');
  check(await page.evaluate(() => !('BarcodeDetector' in window)), 'simulating iOS Safari: no BarcodeDetector');
  check(await page.evaluate(() => typeof ZXing !== 'undefined'), 'vendored ZXing loaded (no CDN dependency)');

  await page.click('#nav-scan');
  await page.waitForTimeout(250);
  check(await page.locator('#live-scanner').isVisible(), 'iPhone gets the LIVE scanner UI');
  check(!(await page.locator('#photo-scanner').isVisible()), 'photo fallback hidden by default on iPhone');

  await page.click('.scan-start-btn');
  await page.waitForFunction(() => window.__scannedCode, null, { timeout: 25000 }).catch(() => {});
  const scanned = await page.evaluate(() => window.__scannedCode);
  check(scanned === EXPECTED, `ZXing decoded live barcode on the iOS path (got ${scanned})`);

  await page.waitForTimeout(700);
  check(await page.locator('#prod-result').evaluate(el => el.classList.contains('show')), 'product card shown after scan');
  // 140cal*0.0305 + 39g sugar*0.12 = 8.95 -> 9
  const pts = (await page.locator('#pts-display').textContent()).trim();
  check(pts === '9', 'scanned soda priced by the engine (9 pts, got ' + pts + ')');
  check(await page.locator('#zero-msg').isHidden(), 'soda NOT flagged zero-point');
  check(await page.evaluate(() => !document.getElementById('scanner-video').srcObject), 'camera released after successful scan');

  // Logging it clears the card so the next visit reopens the camera
  await page.click('.add-log-btn');
  await page.waitForTimeout(300);
  check(!(await page.locator('#prod-result').evaluate(el => el.classList.contains('show'))), 'result card cleared after logging');
  check(await page.locator('#hero-used').textContent() === '9', 'scanned item logged to the day (9 pts)');
  await browser.close();
}

// ── Phase B: camera lifecycle (blank camera, nothing to decode) ──
console.log('Phase B — camera lifecycle (blank camera):');
{
  const { browser, page } = await openIphone('blank.y4m');
  await page.click('#nav-scan');
  await page.click('.scan-start-btn');
  await page.waitForTimeout(1500);
  check(await page.locator('#video-wrap').evaluate(el => el.classList.contains('active')), 'camera opens and live video is shown');
  check(await page.evaluate(() => { const v = document.getElementById('scanner-video'); return !!v.srcObject && v.videoWidth > 0; }), 'video stream is actually playing (has dimensions)');
  check(await page.locator('#scan-status-bar').evaluate(el => el.classList.contains('active')), 'scanning status bar visible');
  check(await page.locator('#torch-btn').isHidden(), 'torch button hidden when device reports no torch capability');

  // Stop button releases the camera
  await page.click('.scan-stop-btn');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !document.getElementById('scanner-video').srcObject), 'Stop button releases the camera');

  // Leaving the screen releases the camera
  await page.click('.scan-start-btn');
  await page.waitForTimeout(900);
  await page.click('#nav-day');
  await page.waitForTimeout(400);
  check(await page.evaluate(() => !document.getElementById('scanner-video').srcObject), 'camera released when navigating away');

  // Returning auto-opens (permission already granted) => tap Scan, point, done
  await page.click('#nav-scan');
  await page.waitForTimeout(1500);
  check(await page.locator('#video-wrap').evaluate(el => el.classList.contains('active')), 'camera auto-opens on return visit (tap Scan → point)');

  // Backgrounding the app frees the camera (iOS suspends it anyway)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !document.getElementById('scanner-video').srcObject), 'camera released when app is backgrounded');

  // Photo fallback still reachable
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
  await page.click('text=Camera trouble?');
  await page.waitForTimeout(200);
  check(await page.locator('#photo-scanner').isVisible(), 'photo fallback reachable from the live scanner');
  check(!(await page.locator('#live-scanner').isVisible()), 'live scanner hidden while in photo mode');
  await page.click('text=Back to live scanner');
  await page.waitForTimeout(200);
  check(await page.locator('#live-scanner').isVisible(), 'can switch back to the live scanner');
  await browser.close();
}

const real = errors.filter(e => !/net::ERR_|Failed to load resource|ERR_ABORTED/.test(e));
check(real.length === 0, 'no JS errors (' + real.join(' | ') + ')');

server.close();
console.log(fails.length ? '\niOS SCAN FAILURES: ' + fails.length : '\niOS LIVE SCAN VERIFIED');
process.exit(fails.length ? 1 : 0);
