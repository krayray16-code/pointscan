// Covers the four issues reported from real use against the WW app:
//  1. a packaged snack ("Corn Pops") inheriting zero from a category keyword
//  2. points reading a point low on high-fiber foods
//  3. the scanner closing after every single scan, and being hard to aim
//  4. "product not found" being a dead end
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

// Two products: an ultra-processed corn snack, and a genuinely plain one.
const PRODUCTS = {
  '049000028911': { product_name: 'Corn Pops', brands: 'Kellogg', nova_group: 4, ingredients_n: 12,
    nutriments: { 'energy-kcal_serving': 130, 'sugars_serving': 12, 'added-sugars_serving': 12,
                  'proteins_serving': 1, 'saturated-fat_serving': 0, 'fiber_serving': 1 },
    serving_size: '1 cup (29g)', categories_tags: ['en:breakfasts'] },
  '4006381333931': { product_name: 'Frozen Broccoli Florets', brands: 'Plain Co', nova_group: 1, ingredients_n: 1,
    nutriments: { 'energy-kcal_serving': 30, 'sugars_serving': 1, 'proteins_serving': 3,
                  'saturated-fat_serving': 0, 'fiber_serving': 2 },
    serving_size: '1 cup (85g)', categories_tags: ['en:frozen-vegetables'] }
};

const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/off/')) {
    const code = url.split('/').pop().replace('.json', '');
    res.setHeader('Content-Type', 'application/json');
    res.end(PRODUCTS[code]
      ? JSON.stringify({ status: 1, product: PRODUCTS[code] })
      : JSON.stringify({ status: 0 }));
    return;
  }
  const f = join(ROOT, url === '/' ? '/index.html' : url);
  if (existsSync(f)) { res.setHeader('Content-Type', MIME[extname(f)] || 'text/plain'); res.end(readFileSync(f)); }
  else { res.statusCode = 404; res.end('nope'); }
});
await new Promise(r => server.listen(8936, r));

const fails = [];
const check = (c, l) => { if (c) console.log('  ✓ ' + l); else { fails.push(l); console.log('  ✗ ' + l); } };
const errors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
         `--use-file-for-fake-video-capture=${join(SCRATCH, 'barcode.y4m')}`]
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'],
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  delete window.BarcodeDetector;             // iOS Safari
  window.__lookups = [];
  const orig = window.fetch;
  window.fetch = (u, o) => {
    if (typeof u === 'string' && u.includes('openfoodfacts.org/api')) {
      const code = u.match(/product\/(\d+)\.json/)[1];
      window.__lookups.push(code);
      return orig('/off/' + code + '.json', o);
    }
    return orig(u, o);
  };
});
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:8936/');
await page.waitForTimeout(300);

console.log('1. Packaged snack must not inherit zero from a keyword:');
await page.evaluate(() => switchScreen('scan'));
await page.fill('#manual-barcode', '049000028911');
await page.click('text=Look up');
await page.waitForTimeout(800);
check((await page.locator('#prod-name').textContent()).includes('Corn Pops'), 'Corn Pops looked up');
const cpPts = (await page.locator('#pts-display').textContent()).trim();
check(cpPts !== '0', `Corn Pops is NOT zero points (got ${cpPts})`);
// 130*0.0305 + 0 + 12*0.12 - 1*0.098 = 5.29 -> 5
check(cpPts === '5', `Corn Pops priced from the label (5, got ${cpPts})`);
check(await page.locator('#zero-msg').isVisible(), 'explains why it is not zero');
check(/processed|packaged/i.test(await page.locator('#zero-msg').textContent()), 'names the reason');
check(await page.locator('.badge-zero').count() === 0, 'no ZERO badge anywhere on the card');

console.log('2. A genuinely plain packaged food still gets zero:');
await page.fill('#manual-barcode', '4006381333931');
await page.click('text=Look up');
await page.waitForTimeout(800);
check((await page.locator('#pts-display').textContent()).trim() === '0', 'plain frozen broccoli is still 0');
check(/zero-point/i.test(await page.locator('#zero-msg').textContent()), 'badged as a zero-point food');

console.log('3. Formula no longer reads a point low on high-fiber foods:');
const formula = await page.evaluate(() => ({
  cereal: PointsEngine.calcPoints({ cal: 210, sat: 1, sug: 12, addedSug: 12, pro: 4, fib: 3 }, 'Zzq cereal product', '', 'standard').points,
  almonds: PointsEngine.calcPoints({ cal: 164, sat: 1.1, sug: 1.2, addedSug: 0, pro: 6, fib: 3.5 }, 'Zzq nut product', '', 'standard').points,
  rice: PointsEngine.calcPoints({ cal: 216, sat: 0.4, sug: 0.7, addedSug: 0, pro: 5, fib: 3.5 }, 'Zzq grain product', '', 'standard').points
}));
check(formula.cereal === 8, `high-fiber cereal = 8, was 7 (got ${formula.cereal})`);
check(formula.almonds === 5, `almonds = 5, was 4 (got ${formula.almonds})`);
check(formula.rice === 6, `brown rice unchanged at 6 (got ${formula.rice})`);

console.log('4. Not-found is recoverable and remembered:');
await page.fill('#manual-barcode', '012345678905');
await page.click('text=Look up');
await page.waitForTimeout(700);
check(await page.locator('#addprod-overlay').evaluate(el => el.classList.contains('show')), 'offers to add the missing product');
check(/012345678905/.test(await page.locator('#addprod-sub').textContent()), 'shows which barcode');
await page.fill('#ap-name', 'My Mystery Chips');
await page.fill('#ap-serving', '1 oz (28g)');
await page.fill('#ap-cal', '150');
await page.fill('#ap-sat', '1.5');
await page.fill('#ap-sug', '1');
await page.fill('#ap-pro', '2');
await page.click('text=Save & use');
await page.waitForTimeout(600);
check((await page.locator('#prod-name').textContent()) === 'My Mystery Chips', 'the added product is shown');
// 150*0.0305 + 1.5*0.275 + 1*0.12 - 2*0.098 = 4.83 -> 5
check((await page.locator('#pts-display').textContent()).trim() === '5', 'added product is priced by the engine');
check((await page.locator('#pts-display').textContent()).trim() !== '0', 'a typed-in product is never silently zero');
// and it resolves offline next time, without a network lookup
const before = await page.evaluate(() => window.__lookups.length);
await page.fill('#manual-barcode', '012345678905');
await page.click('text=Look up');
await page.waitForTimeout(600);
check(await page.evaluate(() => window.__lookups.length) === before, 'a re-scan resolves locally with no network call');
check((await page.locator('#prod-name').textContent()) === 'My Mystery Chips', 'remembered on re-scan');

console.log('5. Scanner keeps running after a hit:');
await page.evaluate(() => { document.getElementById('prod-result').classList.remove('show'); });
await page.evaluate(async () => { if (!scanning) await startScanner(); });
await page.waitForFunction(() => window.__lookups.some(c => c === '4006381333931'), null, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(900);
check(await page.evaluate(() => !!document.getElementById('scanner-video').srcObject), 'camera is STILL running after a successful scan');
check(await page.locator('#video-wrap').evaluate(el => el.classList.contains('active')), 'live view still visible');
check(await page.locator('#prod-result').evaluate(el => el.classList.contains('show')), 'result shown below the live camera');
check(/next item/i.test(await page.locator('#scan-status-txt').textContent()), 'prompts for the next item');
// the same barcode must not be re-logged over and over while it sits in frame
const hits = await page.evaluate(() => window.__lookups.filter(c => c === '4006381333931').length);
await page.waitForTimeout(1500);
const hits2 = await page.evaluate(() => window.__lookups.filter(c => c === '4006381333931').length);
check(hits2 === hits, `the same code in frame is not looked up repeatedly (${hits} -> ${hits2})`);
await page.evaluate(() => stopScanner());


console.log('6. Scanner guidance and escape hatches:');
await page.evaluate(() => { DB.set('ww_scan_history', []); switchScreen('scan'); });
await page.waitForTimeout(200);
check(await page.locator('.scan-links button', { hasText: 'Search manually' }).isVisible(), 'manual-search escape hatch is on the scan screen');
check(await page.locator('.scan-links button', { hasText: 'Take a photo' }).isVisible(), 'photo fallback is on the scan screen');
await page.locator('.scan-links button', { hasText: 'Search manually' }).click();
await page.waitForTimeout(250);
check(await page.locator('#screen-search').evaluate(el => el.classList.contains('active')), 'it actually goes to Search');
await page.evaluate(() => switchScreen('scan'));
// The camera may already be live (permission is remembered and it auto-opens),
// so only tap "Open camera" when it is actually idle.
await page.evaluate(async () => { if (!scanning) await startScanner(); });
await page.waitForTimeout(1000);
check(await page.locator('#aim-label').isVisible(), 'shows "Align the barcode inside the box"');
check(/align the barcode/i.test(await page.locator('#aim-label').textContent()), 'aiming text is explicit');
check(await page.locator('#scan-status-txt .scanning-dots').count() === 1, 'live animated Scanning indicator is present');
await page.evaluate(() => stopScanner());

console.log('7. Recently scanned history:');
await page.evaluate(() => switchScreen('scan'));
await page.fill('#manual-barcode', '049000028911');
await page.click('text=Look up');
await page.waitForTimeout(800);
await page.fill('#manual-barcode', '4006381333931');
await page.click('text=Look up');
await page.waitForTimeout(800);
check(await page.locator('#scan-history-wrap').isVisible(), 'history section appears after scans');
check(await page.locator('.hist-row').count() === 2, 'both scans recorded (' + (await page.locator('.hist-row').count()) + ')');
check(/Frozen Broccoli/.test(await page.locator('.hist-row').first().textContent()), 'newest scan is first');
// tapping a history row re-opens that product
await page.locator('.hist-row', { hasText: 'Corn Pops' }).click();
await page.waitForTimeout(700);
check((await page.locator('#prod-name').textContent()).includes('Corn Pops'), 'tapping history re-opens the product');
// re-scanning the same code must not duplicate the row
await page.fill('#manual-barcode', '049000028911');
await page.click('text=Look up');
await page.waitForTimeout(700);
check(await page.locator('.hist-row').count() === 2, 'a repeat scan does not duplicate the history row');

const real = errors.filter(e => !/net::ERR_|Failed to load resource|ERR_ABORTED/.test(e));
check(real.length === 0, 'no JS errors (' + real.join(' | ') + ')');

await browser.close();
server.close();
console.log(fails.length ? '\nFAILURES: ' + fails.length : '\nSCAN ACCURACY VERIFIED');
process.exit(fails.length ? 1 : 0);
