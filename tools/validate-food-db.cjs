/**
 * Validation pass over the food database (Phase 2/5 requirement).
 * Run with: node tools/validate-food-db.cjs
 *
 * For every item in FOOD_DB (and every starter-meal component):
 *  - computes points with the NEW engine on both plans,
 *  - re-classifies with a faithful copy of the OLD app logic to report
 *    exactly what changed,
 *  - verifies the zero-point invariant: an item may be zero ONLY if it
 *    matches a zero-point category AND passes the processing check,
 *  - flags anything unverifiable (missing nutrition, total-sugar fallback,
 *    judgment calls) for human review.
 *
 * Writes reports/validation-report.md and exits non-zero on invariant
 * violations.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../points-engine.js');
const FoodDB = require('../food-db.js');

// ── faithful copy of the OLD app's classification (index.html pre-upgrade) ──
const OLD_ZERO_SIMPLE = ['apple','apricot','banana','blackberr','blueberr','cantaloupe','cherry','clementine','cranberr','date','fig','grape','grapefruit','guava','honeydew','kiwi','lemon','lime','lychee','mango','nectarine','orange','papaya','passion fruit','peach','pear','pineapple','plum','pomegranate','raspberry','strawberr','tangerine','watermelon','potato','sweet potato','yam','corn','edamame','broccoli','spinach','kale','lettuce','cabbage','carrot','cucumber','celery','tomato','zucchini','squash','eggplant','aubergine','bell pepper','onion','garlic','mushroom','asparagus','artichoke','beet','radish','turnip','parsnip','leek','chard','arugula','watercress','cauliflower','brussels sprout','green bean','snap pea','snow pea','okra','pumpkin','plantain','butternut squash','courgette','fennel','kohlrabi','rutabaga','black bean','kidney bean','pinto bean','cannellini bean','navy bean','lima bean','split pea','mung bean','adzuki bean','fava bean','soybean','chickpea','lentil','tofu','tempeh','chicken breast','chicken thigh','turkey breast','turkey thigh','skinless chicken','skinless turkey','ground turkey breast','tilapia','cod','salmon','tuna','shrimp','scallop','crab','lobster','clam','oyster','mussel','sardine','halibut','flounder','haddock','trout','catfish','pollock','mahi','snapper','swordfish','whitefish','whole egg','hard boiled egg','hard-boiled egg','soft boiled egg','poached egg','scrambled egg','fried egg','omelette','omelet','egg white'];
const OLD_REQ_QUAL = ['yogurt','cottage cheese','quark'];
const OLD_QUALIFIERS = ['plain','nonfat','non-fat','fat-free','fat free','0%','0 %','skim'];
const OLD_NOT_ZERO = ['french frie','potato chip','hash brown','tater tot','potato wedge','potato bread','potato roll','potato gnocchi','potato soup','mashed potato mix','corn chip','tortilla chip','corn dog','cornbread','corn muffin','popcorn','egg noodle','egg pasta','egg roll','scotch egg','egg salad','deviled egg','egg mcmuffin','egg sandwich','egg muffin','chicken nugget','fried chicken','breaded chicken','chicken wing','chicken strip','chicken finger','chicken tender','chicken sandwich','buffalo chicken','turkey bacon','turkey jerky','deli turkey','turkey sandwich','fish stick','fish and chip','breaded fish','fish cake','fish sandwich','fish taco','banana chip','banana bread','banana muffin','banana foster','banana pudding','dried fruit','fruit juice','fruit snack','fruit candy','fruit leather','fruit roll','apple juice','apple sauce','applesauce','apple pie','apple crisp','grape juice','mango juice','orange juice','fruit punch','fruit drink','chobani','dannon','yoplait','oikos','siggi','fage 2','fage total 2','greek yogurt with','yogurt with','fruit yogurt','flavored yogurt','vanilla yogurt','honey yogurt','strawberry yogurt','blueberry yogurt','peach yogurt','cherry yogurt','coconut yogurt','chocolate yogurt','yogurt parfait','yogurt smoothie','yogurt drink','drinkable yogurt','2% cottage','4% cottage','small curd cottage cheese 4','lowfat cottage','oat cookie','oat bar','granola','oatmeal cookie','oatmeal raisin','instant oatmeal','flavored oatmeal','maple oatmeal','brown sugar oatmeal','bean dip','refried bean','hummus','bean soup','bean burrito','pea protein powder','soy sauce','soy milk','edamame hummus'];

function oldIsZeroPoint(name, cats) {
  if (!name) return false;
  const hay = (name + ' ' + (cats || '')).toLowerCase();
  if (OLD_NOT_ZERO.some(x => hay.includes(x))) return false;
  if (OLD_REQ_QUAL.some(f => hay.includes(f))) {
    if (!OLD_QUALIFIERS.some(q => hay.includes(q))) return false;
    const flavorWords = ['vanilla','strawberry','blueberry','peach','honey','maple','cherry','mango','pineapple','mixed berry','lemon','coconut','caramel','chocolate','coffee','cinnamon','fruit','flavored','sweetened'];
    if (flavorWords.some(f => hay.includes(f))) return false;
    return true;
  }
  if (hay.includes('egg')) {
    const eggProducts = ['egg noodle','egg pasta','egg roll','scotch egg','egg salad','deviled egg','egg sandwich','egg muffin','egg mcmuffin','egg beater'];
    if (eggProducts.some(x => hay.includes(x))) return false;
    if (/\begg(s)?\b/.test(hay) || hay.includes('egg white')) return true;
    return false;
  }
  return OLD_ZERO_SIMPLE.some(kw => hay.includes(kw));
}
function oldCalcWW(cal, sat, sug, pro, fib, name, cats) {
  if (oldIsZeroPoint(name, cats)) return 0;
  if (cal == null) return null;
  return Math.max(0, Math.round((cal * 0.0305) + ((sat||0) * 0.275) + ((sug||0) * 0.12) - ((pro||0) * 0.098) - ((fib||0) * 0.098)));
}

// ── run the pass ──
const rows = [];
const flagged = [];
const changed = [];
let violations = 0;

for (const f of FoodDB.FOODS) {
  const n = { cal: f.cal, sat: f.sat, sug: f.sug, addedSug: f.asug, pro: f.pro, fib: f.fib };
  const std = E.calcPoints(n, f.name, '', 'standard');
  const dia = E.calcPoints(n, f.name, '', 'diabetic');
  const oldPts = oldCalcWW(f.cal, f.sat, f.sug, f.pro, f.fib, f.name, '');
  const oldZero = oldIsZeroPoint(f.name, '');

  // Invariant: zero ⇒ matched a zero category AND passed the processing check.
  if (std.zero && !std.categoryId) violations++;
  if (std.zero) {
    const zc = E.zeroCheck(f.name, '', 'standard');
    if (/processed/.test(zc.reason)) violations++;
  }

  const itemFlags = [...std.flags];
  if (std.conditional) itemFlags.push('asks about add-ins before logging');
  for (const rn of E.REVIEW_NOTES) {
    if (f.name.toLowerCase().includes(rn.term)) itemFlags.push('review: ' + rn.note);
  }
  const delta = (oldZero !== std.zero) || (oldPts !== std.points);
  if (delta) changed.push(f);
  if (itemFlags.length) flagged.push({ f, itemFlags });

  rows.push({
    name: f.name, serving: f.serving,
    oldPts: oldZero ? '0 (zero)' : String(oldPts),
    newStd: std.zero ? '0 (zero: ' + std.category + (std.conditional ? ', asks about add-ins' : '') + ')' : String(std.points),
    newDia: dia.zero ? '0 (zero)' : String(dia.points),
    status: delta ? 'CHANGED' : 'unchanged',
    flags: itemFlags.join('; ') || '—',
    reason: std.zero ? std.reason : (std.reason || '')
  });
}

// starter meal totals
const mealRows = FoodDB.STARTER_MEALS.map(m => {
  const per = m.components.map(c => {
    const f = FoodDB.byId(c.foodId);
    const r = E.calcPoints({ cal: f.cal, sat: f.sat, sug: f.sug, addedSug: f.asug, pro: f.pro, fib: f.fib }, f.name, '', 'standard');
    return { name: f.name, qty: c.qty, pts: r.zero ? 0 : Math.round(r.points * c.qty), zero: r.zero };
  });
  const total = per.reduce((s, p) => s + p.pts, 0);
  return { meal: m.name, total, per };
});

// ── report ──
const lines = [];
lines.push('# Food Database Validation Report');
lines.push('');
lines.push('Generated: ' + new Date().toISOString().slice(0, 10) + ' · Engine: 2025/2026 WW Points program (nutrition-based approximation; official algorithm is proprietary)');
lines.push('');
lines.push('Invariant checked for every item: **zero points ⇒ matches a zero-point category AND passes the processing/preparation check.** Violations found: **' + violations + '**');
lines.push('');
lines.push('## Every item (old → new)');
lines.push('');
lines.push('| Food | Serving | Old pts | New (standard) | New (diabetic) | Status | Flags |');
lines.push('|---|---|---|---|---|---|---|');
for (const r of rows) {
  lines.push(`| ${r.name} | ${r.serving} | ${r.oldPts} | ${r.newStd} | ${r.newDia} | ${r.status} | ${r.flags} |`);
}
lines.push('');
lines.push('**' + changed.length + ' item(s) changed** vs the old logic; **' + flagged.length + ' item(s) flagged** for review.');
lines.push('');
lines.push('## Flagged for review');
lines.push('');
if (!flagged.length) lines.push('None.');
for (const { f, itemFlags } of flagged) {
  lines.push('- **' + f.name + '**: ' + itemFlags.join(' · '));
}
lines.push('');
lines.push('## Conditional preparations (zero when plain — the app asks what went in)');
lines.push('');
lines.push('These are zero-point foods where added fat/dairy is common but optional. Instead of guessing, logging one opens a short "what went in?" sheet: plain keeps it at 0, and any add-ins are priced by the same engine.');
lines.push('');
for (const cp of E.CONDITIONAL_PREPARATIONS) {
  lines.push('- ' + cp.match.map(m => '`' + m + '`').join(', ') + ' → _"' + cp.prompt + '"_');
}
lines.push('');
lines.push('## Judgment calls encoded in the engine (conservative: points, not zero)');
lines.push('');
for (const rn of E.REVIEW_NOTES) lines.push('- **' + rn.term + '** — ' + rn.note);
lines.push('');
lines.push('## Starter meals (standard plan)');
lines.push('');
for (const m of mealRows) {
  lines.push('- **' + m.meal + '** = ' + m.total + ' pts (' +
    m.per.map(p => `${p.name} ×${p.qty} → ${p.zero ? '0 (zero)' : p.pts}`).join('; ') + ')');
}
lines.push('');

const outDir = path.join(__dirname, '..', 'reports');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'validation-report.md');
fs.writeFileSync(outFile, lines.join('\n'));
console.log(lines.join('\n'));
console.log('\nReport written to ' + path.relative(process.cwd(), outFile));
process.exit(violations ? 1 : 0);
