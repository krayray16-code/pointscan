// Browser smoke test: loads the app, checks for console errors, exercises
// meals, plan toggle, search (local DB), manual barcode validation paths.
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { createRequire } from 'module';
const require = createRequire(process.env.PW_MODULES || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = join(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = join(ROOT, p);
  if (existsSync(f)) {
    res.setHeader('Content-Type', MIME[extname(f)] || 'text/plain');
    res.end(readFileSync(f));
  } else { res.statusCode = 404; res.end('nope'); }
});
await new Promise(r => server.listen(8931, r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
// Block external requests (CDN fonts/zxing, OFF) to simulate rough network & keep test hermetic
await page.route(/^(?!http:\/\/localhost)/, r => r.abort());

await page.goto('http://localhost:8931/');
await page.waitForTimeout(500);

const fails = [];
const check = (cond, label) => { if (cond) console.log('  ✓ ' + label); else { fails.push(label); console.log('  ✗ ' + label); } };

// Day screen renders
check(await page.locator('#hero-budget').textContent() === '23', 'default budget renders');

// Meals screen: starter meals seeded
await page.click('#nav-meals');
await page.waitForTimeout(200);
const mealCards = await page.locator('.meal').count();
check(mealCards === 4, 'four starter meals seeded (' + mealCards + ')');
const bowlPts = await page.locator('.meal', { hasText: 'Grilled Chicken Power Bowl' }).locator('.meal-pts').textContent();
check(bowlPts.trim() === '0', 'all-zero starter meal shows 0 pts');
const tacoPts = await page.locator('.meal', { hasText: 'Turkey Taco Night' }).locator('.meal-pts').textContent();
check(tacoPts.trim() === '10', 'turkey tacos = 10 pts');

// One-tap log
await page.locator('.meal', { hasText: 'Turkey Taco Night' }).locator('.btn-primary').click();
await page.waitForTimeout(800);
check(await page.locator('#hero-used').textContent() === '10', 'logging meal updates day total to 10');

// Meal builder: create meal, save, re-render
await page.click('#nav-meals');
await page.click('#new-meal-btn');
await page.fill('#mb-name', 'Test Meal');
await page.fill('#mb-search', 'banana');
await page.waitForTimeout(200);
await page.locator('.picker-item').first().click();
await page.fill('#mb-search', 'peanut');
await page.waitForTimeout(200);
await page.locator('.picker-item').first().click();
const builderTotal = await page.locator('#mb-total').textContent();
check(builderTotal === '6 pts', 'builder total = banana(0) + PB(6) = 6 (' + builderTotal + ')');
// qty bump on PB → 1.5 servings → round(6*1.5)=9
await page.locator('.comp-row', { hasText: 'Peanut butter' }).locator('.mini-step button').nth(1).click();
check(await page.locator('#mb-total').textContent() === '9 pts', 'qty 1.5 → 9 pts');
await page.click('text=Save meal');
await page.waitForTimeout(300);
check(await page.locator('.meal').count() === 5, 'saved meal appears in list');

// Editing a meal does not change past logs
await page.locator('.meal', { hasText: 'Turkey Taco Night' }).locator('.btn-ghost').click();
await page.locator('.comp-row', { hasText: 'tortilla' }).locator('.li-del').click();
await page.click('text=Save meal');
await page.waitForTimeout(300);
await page.click('#nav-day');
await page.waitForTimeout(300);
check(await page.locator('#hero-used').textContent() === '10', 'past log keeps 10 pts after meal edited');

// Search: local DB works offline
await page.click('#nav-search');
await page.fill('#food-search-input', 'potato');
await page.click('#search-btn');
await page.waitForTimeout(500);
check(await page.locator('.sri').count() >= 2, 'local DB search returns potato results offline');
check((await page.locator('#zero-banner').textContent()).includes('zero-point'), 'zero banner shows for potato');
const chipsRow = page.locator('.sri', { hasText: 'Potato chips' });
check(await chipsRow.locator('.badge-zero').count() === 0, 'potato chips NOT marked zero in search');

// Manual barcode: malformed input rejected without crash
await page.click('#nav-scan');
await page.fill('#manual-barcode', 'abc123');
await page.click('text=Look up');
await page.waitForTimeout(300);
check((await page.locator('#toast').textContent()).includes('valid'), 'malformed barcode shows clear message');
await page.fill('#manual-barcode', '049000028912'); // bad checksum
await page.click('text=Look up');
await page.waitForTimeout(300);
check((await page.locator('#toast').textContent()).includes('checksum'), 'checksum failure shows clear message');

// Plan toggle: diabetic makes banana pointed
await page.evaluate(() => switchScreen('settings'));
await page.click('#plan-btn-diabetic');
await page.waitForTimeout(300);
check((await page.locator('#plan-desc').textContent()).includes('Diabetic'), 'diabetic plan description shown');
await page.click('#nav-search');
await page.fill('#food-search-input', 'banana');
await page.click('#search-btn');
await page.waitForTimeout(500);
const bananaRow = page.locator('.sri', { hasText: 'Banana (medium)' });
const bananaPts = await bananaRow.locator('.sri-pts-n').textContent();
check(bananaPts.trim() === '3', 'diabetic: banana = 3 pts (' + bananaPts + ')');
check((await page.locator('#zero-banner').textContent()).includes('diabetic'), 'diabetic info banner for banana');
// back to standard
await page.evaluate(() => switchScreen('settings'));
await page.click('#plan-btn-standard');
await page.waitForTimeout(200);

// Meals recompute per plan (display) — diabetic check
await page.click('#plan-btn-diabetic');
await page.click('#nav-meals');
await page.waitForTimeout(200);
const bowlDia = await page.locator('.meal', { hasText: 'Grilled Chicken Power Bowl' }).locator('.meal-pts').textContent();
check(bowlDia.trim() === '4', 'diabetic: chicken bowl shows potato points (4), (' + bowlDia + ')');

const realErrors = errors.filter(e => !/net::ERR_FAILED|Failed to load resource|ERR_ABORTED/.test(e));
check(realErrors.length === 0, 'no JS errors (' + realErrors.join(' | ') + ')');

await browser.close();
server.close();
console.log(fails.length ? '\nSMOKE FAILURES: ' + fails.length : '\nSMOKE TEST PASSED');
process.exit(fails.length ? 1 : 0);
