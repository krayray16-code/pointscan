// Verifies: (1) nothing is hidden behind the fixed bottom bar, including
// after a scan; (2) AI Meal still produces a result when the API fails
// (quota), via the local parser; (3) inputs don't trigger iOS zoom.
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { createRequire } from 'module';
const require = createRequire(process.env.PW_MODULES || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = join(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
let aiMode = 'quota';
const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/ai-meal') {
    res.setHeader('Content-Type', 'application/json');
    if (aiMode === 'quota') { res.statusCode = 429; res.end(JSON.stringify({ error: 'quota', detail: '429' })); }
    else { res.end(JSON.stringify({ mealLabel: 'AI Meal', totalPoints: 4,
      items: [{ name: 'Toast', isZero: false, calories: 80, protein: 5, saturatedFat: 0.2, sugar: 4, fiber: 3, points: 2, note: '' }] })); }
    return;
  }
  if (url.startsWith('/off/')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 1, product: { product_name: 'Test Cereal', brands: 'ACME',
      nutriments: { 'energy-kcal_serving': 210, 'sugars_serving': 12, 'proteins_serving': 4, 'saturated-fat_serving': 1, 'fiber_serving': 3 },
      serving_size: '1 cup', categories_tags: ['en:cereals'] }}));
    return;
  }
  const f = join(ROOT, url === '/' ? '/index.html' : url);
  if (existsSync(f)) { res.setHeader('Content-Type', MIME[extname(f)] || 'text/plain'); res.end(readFileSync(f)); }
  else { res.statusCode = 404; res.end('nope'); }
});
await new Promise(r => server.listen(8934, r));

const fails = [];
const check = (c, l) => { if (c) console.log('  ✓ ' + l); else { fails.push(l); console.log('  ✗ ' + l); } };
const errors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
});
// iPhone-sized viewport. Chromium can't emulate env(safe-area-inset-*), so we
// inject a bottom inset to mimic the home-indicator device this broke on.
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  const orig = window.fetch;
  window.fetch = (u, o) => (typeof u === 'string' && u.includes('openfoodfacts.org/api'))
    ? orig('/off/x.json', o) : orig(u, o);
});
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:8934/');
// Simulate a 34px home-indicator inset, then let the app re-measure.
await page.addStyleTag({ content: '.nav{padding-bottom:34px !important;}' });
await page.evaluate(() => syncNavHeight());
await page.waitForTimeout(300);

console.log('Bottom bar / cut-off:');
const navH = await page.evaluate(() => document.querySelector('.nav').offsetHeight);
const reserved = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
check(reserved >= navH, `page reserves at least the bar height (${reserved}px reserved vs ${navH}px bar)`);

// Overlap test: no interactive element may sit under the fixed bar.
async function worstOverlap() {
  return await page.evaluate(() => {
    const nav = document.querySelector('.nav').getBoundingClientRect();
    const active = document.querySelector('.screen.active');
    let worst = 0, culprit = null;
    active.querySelectorAll('button,.quick-btn,.sri-add,.prod-add .btn-primary,.big-teal-btn,.btn-primary,.teal-btn,input,select').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const over = r.bottom - nav.top;
      if (over > worst) { worst = over; culprit = (el.textContent || el.id || el.className).trim().slice(0, 40); }
    });
    return { worst, culprit, scrollable: document.documentElement.scrollHeight > window.innerHeight };
  });
}
// Scroll to the bottom of each screen and check nothing is buried.
for (const screen of ['day','scan','search','meals','progress','settings']) {
  await page.evaluate(s => switchScreen(s), screen);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  const o = await worstOverlap();
  check(o.worst <= 0, `${screen}: nothing hidden behind the bar (worst overlap ${Math.round(o.worst)}px${o.culprit ? ', ' + o.culprit : ''})`);
}

// The reported case: after a scan, the "Add to Today's Log" button.
await page.evaluate(() => switchScreen('scan'));
await page.fill('#manual-barcode', '049000028911');
await page.click('text=Look up');
await page.waitForTimeout(900);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
const afterScan = await page.evaluate(() => {
  const nav = document.querySelector('.nav').getBoundingClientRect();
  const btn = document.querySelector('.prod-add .btn-primary').getBoundingClientRect();
  return { over: btn.bottom - nav.top, visible: btn.height > 0 };
});
check(afterScan.visible && afterScan.over <= 0, `after a scan the "Add to Today's Log" button is fully visible (overlap ${Math.round(afterScan.over)}px)`);
check(await page.locator('.prod-add .btn-primary').isVisible(), 'add-to-log button is clickable after scan');

console.log('iOS input zoom:');
const smallInputs = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('input:not([type=file]),select,textarea').forEach(el => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) bad.push((el.id || el.className) + ' @' + fs + 'px');
  });
  return bad;
});
check(smallInputs.length === 0, 'no input under 16px (iOS would zoom on focus): ' + JSON.stringify(smallInputs));

console.log('AI Meal with the API failing (quota):');
await page.evaluate(() => switchScreen('ai'));
await page.fill('#meal-input', '2 eggs, 1 banana, 2 slices whole wheat bread, 1 tbsp peanut butter');
await page.click('#analyze-btn');
await page.waitForTimeout(1500);
check(await page.locator('#ai-result').evaluate(el => el.classList.contains('show')), 'still produces a result when the AI is over quota');
check(await page.locator('#ai-fallback-note').isVisible(), 'explains that it fell back to the local database');
check(/quota/i.test(await page.locator('#ai-fallback-note').textContent()), 'names the reason (quota)');
const rows = await page.locator('.ai-row').count();
check(rows >= 3, `parsed the meal into items locally (${rows} rows)`);
const total = parseInt(await page.locator('#ai-total-pts').textContent(), 10);
// eggs 0 + banana 0 + 2x wheat bread (2 each) + peanut butter 6 = 10
check(total === 10, `local total is engine-priced: expected 10, got ${total}`);
check(await page.locator('#ai-loading').isHidden(), 'loading spinner cleared');
await page.click('.ai-add-meal-btn');
await page.waitForTimeout(600);
check(await page.locator('#hero-used').textContent() === String(total), 'local meal logs to the day');

console.log('AI Meal when the API works:');
aiMode = 'ok';
await page.evaluate(() => switchScreen('ai'));
await page.fill('#meal-input', 'toast');
await page.click('#analyze-btn');
await page.waitForTimeout(1200);
check(await page.locator('#ai-fallback-note').isHidden(), 'no fallback notice when the AI responds');
check(await page.locator('#ai-result').evaluate(el => el.classList.contains('show')), 'AI result renders');

const real = errors.filter(e => !/net::ERR_|Failed to load resource|ERR_ABORTED/.test(e));
check(real.length === 0, 'no JS errors (' + real.join(' | ') + ')');

await browser.close();
server.close();
console.log(fails.length ? '\nFAILURES: ' + fails.length : '\nLAYOUT + AI MEAL VERIFIED');
process.exit(fails.length ? 1 : 0);
