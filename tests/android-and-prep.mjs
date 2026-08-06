// 1) Android path: native BarcodeDetector still selected & decodes.
// 2) Mashed-potato flow: plain = 0, and add-ins price exactly what went in.
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
    const code = url.split('/').pop().replace('.json', '');
    res.setHeader('Content-Type', 'application/json');
    // 049000028911 => the real-world regression case: a 647-style light bread
    // whose high fiber made the uncapped formula round to 0, which the UI then
    // badged "Zero-point food!".
    if (code === '049000028911') {
      res.end(JSON.stringify({ status: 1, product: { product_name: 'Italian Bread', brands: 'Old Tyme',
        nutriments: { 'energy-kcal_serving': 40, 'sugars_serving': 1, 'proteins_serving': 2, 'saturated-fat_serving': 0, 'fiber_serving': 7 },
        serving_size: '1 slice (27 g)',
        categories_tags: ['en:plant-based-foods-and-beverages','en:cereals-and-potatoes','en:breads'] }}));
      return;
    }
    res.end(JSON.stringify({ status: 1, product: { product_name: 'Test Cola', brands: 'T',
      nutriments: { 'energy-kcal_serving': 140, 'sugars_serving': 39, 'proteins_serving': 0, 'saturated-fat_serving': 0, 'fiber_serving': 0 },
      serving_size: '12 fl oz', categories_tags: ['en:sodas'] }}));
    return;
  }
  const f = join(ROOT, url === '/' ? '/index.html' : url);
  if (existsSync(f)) { res.setHeader('Content-Type', MIME[extname(f)] || 'text/plain'); res.end(readFileSync(f)); }
  else { res.statusCode = 404; res.end('nope'); }
});
await new Promise(r => server.listen(8933, r));

const fails = [];
const check = (c, l) => { if (c) console.log('  ✓ ' + l); else { fails.push(l); console.log('  ✗ ' + l); } };
const errors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
         `--use-file-for-fake-video-capture=${join(SCRATCH, 'barcode.y4m')}`]
});
const ctx = await browser.newContext({
  viewport: { width: 393, height: 851 },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  permissions: ['camera']
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  // Chromium headless lacks a real BarcodeDetector; install a shim that
  // reports the food formats so the app takes its NATIVE (Android) branch.
  window.__usedNative = false;
  class FakeBarcodeDetector {
    constructor(o) { this.formats = o.formats; }
    static getSupportedFormats() { return Promise.resolve(['ean_13','ean_8','upc_a','upc_e']); }
    async detect() { window.__usedNative = true; return [{ rawValue: '4006381333931', format: 'ean_13' }]; }
  }
  window.BarcodeDetector = FakeBarcodeDetector;
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
await page.goto('http://localhost:8933/');
await page.waitForTimeout(400);

console.log('Android path (native BarcodeDetector):');
await page.click('#nav-scan');
await page.click('#scanner-idle .btn-primary');
await page.waitForFunction(() => window.__scannedCode, null, { timeout: 20000 }).catch(() => {});
check(await page.evaluate(() => window.__usedNative === true), 'Android uses the NATIVE BarcodeDetector (not ZXing)');
check(await page.evaluate(() => window.__scannedCode) === EXPECTED, 'native path decoded and looked up the barcode');
await page.waitForTimeout(600);
check((await page.locator('#pts-display').textContent()).trim() === '9', 'same engine prices the scan identically to iOS (9 pts)');

console.log('Regression — light bread must not be a "zero-point food":');
await page.click('#nav-scan');
await page.fill('#manual-barcode', '049000028911');
await page.click('text=Look up');
await page.waitForTimeout(900);
check((await page.locator('#prod-name').textContent()).includes('Italian Bread'), 'bread product looked up');
const breadPts = (await page.locator('#pts-display').textContent()).trim();
check(breadPts === '1', 'light bread = 1 pt, not 0 (got ' + breadPts + ')');
check(await page.locator('#zero-msg').isHidden(), 'NO "Zero-point food!" badge on bread');
check((await page.locator('#pts-lbl').textContent()).trim() === 'WW Points', 'label reads "WW Points", not the retired PersonalPoints branding');
// And it must not carry a zero badge into the day log either
await page.click('.prod-add .btn-primary');
await page.waitForTimeout(400);
await page.click('#nav-day');
await page.waitForTimeout(300);
check(await page.locator('.log-item', { hasText: 'Italian Bread' }).locator('.badge-zero').count() === 0, 'no ZERO badge on the logged bread entry');
// A genuine zero-point food still gets its badge
await page.evaluate(() => pushToLog({ name: 'Banana', pts: 0, qty: 1, totalPts: 0, icon: '🍌', source: 'search', zero: true }));
await page.waitForTimeout(300);
check(await page.locator('.log-item', { hasText: 'Banana' }).locator('.badge-zero').count() === 1, 'real zero-point food still shows the ZERO badge');

console.log('Mashed potato / add-ins flow:');
await page.click('#nav-search');
await page.fill('#food-search-input', 'potato');
await page.click('#search-btn');
await page.waitForTimeout(600);
// Add a conditional food by name through the engine-backed search list
const hasMashInDb = await page.evaluate(() => !!FoodDB.search('potato').length);
check(hasMashInDb, 'potato foods available in local DB');

// Verify engine classification drives the prompt
const cond = await page.evaluate(() => PointsEngine.zeroCheck('Mashed potatoes', '', 'standard'));
check(cond.zero === true && cond.conditional === true, 'engine: plain mashed potatoes = zero + conditional');

// Drive the prep sheet directly, as the search "+ Log" would
await page.evaluate(() => {
  openPrepSheet({ name: 'Mashed potatoes' }, 'Was anything mashed in?', res => { window.__prepResult = res; });
});
await page.waitForTimeout(200);
check(await page.locator('#prep-overlay').evaluate(el => el.classList.contains('show')), 'prep sheet opens for mashed potatoes');
check((await page.locator('#prep-total').textContent()) === '0 pts', 'defaults to plain = 0 pts');

// Add 1 tsp olive oil -> should cost exactly the oil (1 pt)
await page.evaluate(() => prepQty('ai-oliveoil', 1));
await page.waitForTimeout(150);
check((await page.locator('#prep-total').textContent()) === '1 pts', 'mashed potato + 1 tsp olive oil = 1 pt');
// Add 1 tbsp butter -> +5
await page.evaluate(() => prepQty('ai-butter', 1));
await page.waitForTimeout(150);
check((await page.locator('#prep-total').textContent()) === '6 pts', '+ 1 tbsp butter = 6 pts total');
// Back to plain
await page.click('.plain-row');
await page.waitForTimeout(150);
check((await page.locator('#prep-total').textContent()) === '0 pts', '"Plain — nothing added" resets to 0');

await page.evaluate(() => prepQty('ai-oliveoil', 1));
await page.click('text=Log it');
await page.waitForTimeout(300);
const res = await page.evaluate(() => window.__prepResult);
check(res && res.pts === 1, 'confirm returns 1 pt');
check(res && /olive oil/i.test(res.name), 'log entry names the add-in (' + (res && res.name) + ')');

const real = errors.filter(e => !/net::ERR_|Failed to load resource|ERR_ABORTED/.test(e));
check(real.length === 0, 'no JS errors (' + real.join(' | ') + ')');

await browser.close();
server.close();
console.log(fails.length ? '\nFAILURES: ' + fails.length : '\nANDROID + PREP FLOW VERIFIED');
process.exit(fails.length ? 1 : 0);
