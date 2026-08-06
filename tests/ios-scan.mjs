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

// ── Phase A2: decoder + photo path (the parts that failed on the real phone) ──
console.log('Phase A2 — decoder core and photo upload path:');
{
  const { browser, page } = await openIphone('blank.y4m');

  // The built-in Scanner Check renders a barcode and decodes it. This proves
  // the decode core works on this browser independently of any camera.
  await page.click('#nav-settings');
  await page.click('text=Run Scanner Check');
  await page.waitForFunction(() => {
    const t = document.getElementById('scan-diag-out');
    return t && t.textContent.includes('decoder self-test');
  }, null, { timeout: 20000 }).catch(() => {});
  const diag = await page.locator('#scan-diag-out').textContent();
  check(/decoder self-test: PASS/.test(diag), 'built-in decoder self-test PASSES');
  check(/ZXing library loaded: yes/.test(diag), 'diagnostics confirm ZXing is served (not a 404)');

  // The decoder must also work when a video is ALREADY playing — the exact
  // state that deadlocked ZXing's decodeFromStream on iOS.
  const already = await page.evaluate(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    const v = document.createElement('video');
    v.setAttribute('playsinline','true'); v.muted = true; v.srcObject = s;
    await v.play();
    await new Promise(r => setTimeout(r, 800));
    const wasPlaying = v.currentTime > 0 && !v.paused && v.readyState > 2;
    // decode against an already-playing element — must not hang
    const done = await Promise.race([
      (async () => { try { decodeSourceMultiPass(v, v.videoWidth, v.videoHeight, LIVE_PASSES); } catch(e) {} return 'returned'; })(),
      new Promise(r => setTimeout(() => r('HUNG'), 5000))
    ]);
    s.getTracks().forEach(t => t.stop());
    return { wasPlaying, done };
  });
  check(already.wasPlaying === true, 'set up the iOS condition: video already playing');
  check(already.done === 'returned', 'decoding an already-playing video returns (no deadlock)');

  // Photo path: generate a real PNG barcode in-page, then upload it exactly
  // as the file input would receive a photo.
  const pngB64 = await page.evaluate((code) => {
    const L={0:'0001101',1:'0011001',2:'0010011',3:'0111101',4:'0100011',5:'0110001',6:'0101111',7:'0111011',8:'0110111',9:'0001011'};
    const G={0:'0100111',1:'0110011',2:'0011011',3:'0100001',4:'0011101',5:'0111001',6:'0000101',7:'0010001',8:'0001001',9:'0010111'};
    const R={}; for (const k in L) R[k]=L[k].split('').map(c=>c==='0'?'1':'0').join('');
    const P={0:'LLLLLL',1:'LLGLGG',2:'LLGGLG',3:'LLGGGL',4:'LGLLGG',5:'LGGLLG',6:'LGGGLL',7:'LGLGLG',8:'LGLGGL',9:'LGGLGL'};
    let bits='101';
    for (let i=0;i<6;i++) bits += (P[code[0]][i]==='L'?L[code[1+i]]:G[code[1+i]]);
    bits+='01010';
    for (let i=7;i<13;i++) bits += R[code[i]];
    bits+='101';
    const mod=4, quiet=20, W=bits.length*mod+quiet*2, H=260;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const g=c.getContext('2d');
    g.fillStyle='#fff'; g.fillRect(0,0,W,H);
    g.fillStyle='#000';
    for (let i=0;i<bits.length;i++) if (bits[i]==='1') g.fillRect(quiet+i*mod, 30, mod, 180);
    return c.toDataURL('image/png').split(',')[1];
  }, EXPECTED);

  const fs = await import('fs');
  const tmpPng = join(SCRATCH, 'photo-barcode.png');
  fs.writeFileSync(tmpPng, Buffer.from(pngB64, 'base64'));

  await page.click('#nav-scan');
  await page.click('text=Camera trouble?');
  await page.waitForTimeout(200);
  await page.setInputFiles('#barcode-file-input', tmpPng);
  await page.waitForFunction(() => window.__scannedCode, null, { timeout: 25000 }).catch(() => {});
  const photoCode = await page.evaluate(() => window.__scannedCode);
  check(photoCode === EXPECTED, `photo upload decoded locally (got ${photoCode})`);
  await page.waitForTimeout(500);
  check(await page.locator('#prod-result').evaluate(el => el.classList.contains('show')), 'photo path shows the product card');
  // The progress spinner must not be left on screen
  check(!(await page.locator('#toast').evaluate(el => el.className.includes('show') && el.innerHTML.includes('spin-sm'))), 'no stuck loading spinner after photo decode');

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
