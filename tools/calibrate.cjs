/**
 * Points calibration harness.
 *   node tools/calibrate.cjs
 *
 * WW's algorithm is proprietary, so the only way to close the gap honestly is
 * to compare against observed values from the WW app. Add a row to REFERENCE
 * for each comparison (product, label nutrition, and the Points WW showed),
 * then run this: it reports our value against theirs and scores several
 * candidate formula variants so the data — not a hunch — picks the winner.
 *
 * Adding rows is the whole point. One data point cannot distinguish the
 * candidates below; they diverge on fatty vs sugary vs high-protein foods,
 * so aim for a spread.
 */
'use strict';
const E = require('../points-engine.js');

// serving:  what the WW screen showed
// ww:       Points WW displayed
// cal/sat/addedSug/pro/fib: from the product label for THAT serving
const REFERENCE = [
  {
    product: 'Pringles Snack Stacks Original Potato Crisps',
    serving: '1 tub (19g)',
    cal: 100, sat: 1.5, addedSug: 0, pro: 1, fib: 1,
    ww: 4,
    source: 'WW app screenshot, 2026-08-06'
  }
  // ── add more here ──────────────────────────────────────────────────────
  // Aim for a spread: something fatty, something sugary, something
  // high-protein, something plain. Example shape:
  // { product: '...', serving: '...', cal: 0, sat: 0, addedSug: 0, pro: 0, fib: 0,
  //   ww: 0, source: 'WW app screenshot, YYYY-MM-DD' },
];

// Candidate explanations for the systematic gap. Each takes the label values
// and returns a Points value.
const VARIANTS = {
  'current (round to nearest)': r =>
    Math.max(0, Math.round(r.cal * 0.0305 + r.sat * 0.275 + r.addedSug * 0.12 - r.pro * 0.098)),
  'round UP (ceiling)': r =>
    Math.max(0, Math.ceil(r.cal * 0.0305 + r.sat * 0.275 + r.addedSug * 0.12 - r.pro * 0.098)),
  'calorie weight 0.0335': r =>
    Math.max(0, Math.round(r.cal * 0.0335 + r.sat * 0.275 + r.addedSug * 0.12 - r.pro * 0.098)),
  'sat-fat weight 0.60': r =>
    Math.max(0, Math.round(r.cal * 0.0305 + r.sat * 0.60 + r.addedSug * 0.12 - r.pro * 0.098)),
  'no protein credit': r =>
    Math.max(0, Math.round(r.cal * 0.0305 + r.sat * 0.275 + r.addedSug * 0.12)),
  'old (fiber credited)': r =>
    Math.max(0, Math.round(r.cal * 0.0305 + r.sat * 0.275 + r.addedSug * 0.12 - r.pro * 0.098 - r.fib * 0.098))
};

if (!REFERENCE.length) {
  console.log('No reference data yet — add rows to REFERENCE.');
  process.exit(0);
}

console.log('\nObserved vs. engine\n');
console.log('product'.padEnd(46) + 'serving'.padEnd(16) + 'WW'.padStart(4) + 'ours'.padStart(6) + '  diff');
console.log('-'.repeat(82));

let engineDiffs = [];
for (const r of REFERENCE) {
  const ours = E.calcPoints(
    { cal: r.cal, sat: r.sat, sug: r.addedSug, addedSug: r.addedSug, pro: r.pro, fib: r.fib },
    r.product, '', 'standard', { packaged: true, nova: 4 }
  ).points;
  const diff = ours - r.ww;
  engineDiffs.push(diff);
  console.log(
    r.product.slice(0, 44).padEnd(46) +
    r.serving.slice(0, 14).padEnd(16) +
    String(r.ww).padStart(4) + String(ours).padStart(6) +
    '  ' + (diff === 0 ? 'match' : (diff > 0 ? '+' : '') + diff)
  );
}

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
console.log('\nEngine bias: ' + mean(engineDiffs).toFixed(2) + ' points ' +
  (mean(engineDiffs) < 0 ? '(reading LOW)' : mean(engineDiffs) > 0 ? '(reading HIGH)' : '(unbiased)'));

console.log('\nCandidate formulas — exact matches out of ' + REFERENCE.length + '\n');
const scored = Object.entries(VARIANTS).map(([name, fn]) => {
  let exact = 0, within1 = 0, diffs = [];
  for (const r of REFERENCE) {
    const v = fn(r);
    const d = v - r.ww;
    diffs.push(d);
    if (d === 0) exact++;
    if (Math.abs(d) <= 1) within1++;
  }
  return { name, exact, within1, bias: mean(diffs),
           mae: mean(diffs.map(Math.abs)) };
}).sort((a, b) => b.exact - a.exact || a.mae - b.mae);

console.log('variant'.padEnd(30) + 'exact'.padStart(7) + 'within1'.padStart(9) + 'bias'.padStart(8) + 'MAE'.padStart(7));
console.log('-'.repeat(61));
for (const v of scored) {
  console.log(v.name.padEnd(30) + String(v.exact).padStart(7) +
    String(v.within1).padStart(9) + v.bias.toFixed(2).padStart(8) + v.mae.toFixed(2).padStart(7));
}

console.log('\nBest fit: ' + scored[0].name +
  ' (' + scored[0].exact + '/' + REFERENCE.length + ' exact)');
if (REFERENCE.length < 5) {
  console.log('\n⚠ Only ' + REFERENCE.length + ' reference point(s). Several variants will tie on ' +
    'this little data —\n  add more (fatty / sugary / high-protein / plain) before changing the formula.');
}
console.log();
