/**
 * Unit tests for PointsEngine — run with: node tests/points-engine.test.cjs
 * Focus: the zero-point "trap cases" — processed derivatives of zero-point
 * foods must NEVER inherit zero status — plus the diabetic plan variant,
 * the points formula, and barcode validation.
 */
'use strict';
const E = require('../points-engine.js');
const FoodDB = require('../food-db.js');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; failures.push(label); console.error('  ✗ FAIL: ' + label); }
}
function isZero(name, plan) { return E.zeroCheck(name, '', plan || 'standard').zero; }

// ══ TRAP CASES: potato ══
ok(isZero('Potato'), 'potato is zero');
ok(isZero('Baked potato'), 'baked potato is zero');
ok(isZero('Boiled potatoes'), 'boiled potatoes are zero');
ok(!isZero('Potato chips'), 'TRAP: potato chips NOT zero');
ok(!isZero('French fries'), 'TRAP: french fries NOT zero');
ok(!isZero('Fries'), 'TRAP: fries NOT zero');
ok(!isZero('Hash browns'), 'TRAP: hash browns NOT zero');
ok(!isZero('Tater tots'), 'TRAP: tater tots NOT zero');
ok(!isZero('Potato salad'), 'TRAP: potato salad NOT zero');
ok(!isZero('Mashed potatoes'), 'TRAP (conservative): mashed potatoes NOT zero');
ok(!isZero('Loaded potato skins'), 'TRAP: loaded potato skins NOT zero');
ok(!isZero('Potato gnocchi'), 'TRAP: gnocchi NOT zero');
ok(isZero('Air-fried potato'), 'air-fried (no oil) potato IS zero');

// ══ TRAP CASES: oats ══
ok(isZero('Plain rolled oats'), 'plain rolled oats are zero');
ok(isZero('Oatmeal'), 'oatmeal is zero');
ok(isZero('Steel cut oats'), 'steel cut oats are zero');
ok(isZero('Overnight oats'), 'overnight oats are zero');
ok(!isZero('Granola bar'), 'TRAP: granola bar NOT zero');
ok(!isZero('Granola'), 'TRAP: granola NOT zero');
ok(!isZero('Oatmeal cookie'), 'TRAP: oatmeal cookie NOT zero');
ok(!isZero('Oatmeal raisin cookies'), 'TRAP: oatmeal raisin NOT zero');
ok(!isZero('Maple brown sugar oatmeal'), 'TRAP: maple/brown sugar oatmeal NOT zero');
ok(!isZero('Oat milk'), 'TRAP: oat milk NOT zero');
ok(!isZero('Honey oat bread'), 'TRAP: oat bread NOT zero');

// ══ TRAP CASES: yogurt / cottage cheese ══
ok(isZero('Plain nonfat Greek yogurt'), 'plain nonfat greek yogurt is zero');
ok(isZero('Plain fat-free yogurt'), 'plain fat-free yogurt is zero');
ok(isZero('Plain 0% Greek yogurt'), 'plain 0% greek yogurt is zero');
ok(isZero('Plain nonfat cottage cheese'), 'plain nonfat cottage cheese is zero');
ok(!isZero('Vanilla yogurt'), 'TRAP: vanilla yogurt NOT zero');
ok(!isZero('Strawberry nonfat yogurt'), 'TRAP: flavored nonfat yogurt NOT zero');
ok(!isZero('Honey Greek yogurt'), 'TRAP: honey yogurt NOT zero');
ok(!isZero('Plain whole milk yogurt'), 'TRAP: whole-milk yogurt NOT zero');
ok(!isZero('Plain low-fat yogurt'), 'TRAP: low-fat (not nonfat) yogurt NOT zero');
ok(!isZero('Greek yogurt'), 'TRAP: unqualified greek yogurt NOT zero (cannot verify plain+nonfat)');
ok(!isZero('2% cottage cheese'), 'TRAP: 2% cottage cheese NOT zero');
ok(!isZero('Yogurt parfait'), 'TRAP: yogurt parfait NOT zero');
ok(!isZero('Frozen yogurt'), 'TRAP: frozen yogurt NOT zero');

// ══ TRAP CASES: chicken / turkey ══
ok(isZero('Chicken breast'), 'chicken breast is zero');
ok(isZero('Grilled chicken breast'), 'grilled chicken breast is zero');
ok(isZero('Skinless chicken thigh'), 'skinless chicken thigh (dark meat) is zero');
ok(isZero('Turkey breast'), 'turkey breast is zero');
ok(!isZero('Breaded chicken breast'), 'TRAP: breaded chicken NOT zero');
ok(!isZero('Fried chicken'), 'TRAP: fried chicken NOT zero');
ok(!isZero('Chicken nuggets'), 'TRAP: chicken nuggets NOT zero');
ok(!isZero('Chicken tenders'), 'TRAP: chicken tenders NOT zero');
ok(!isZero('Chicken wings'), 'TRAP: chicken wings NOT zero');
ok(!isZero('Chicken thigh'), 'chicken thigh without "skinless" NOT zero (skin unverified)');
ok(!isZero('Rotisserie chicken'), 'TRAP: rotisserie chicken NOT zero (skin)');
ok(!isZero('Chicken sandwich'), 'TRAP: chicken sandwich NOT zero');
ok(!isZero('Orange chicken'), 'TRAP: orange chicken NOT zero (fruit keyword must not leak)');
ok(!isZero('Popcorn chicken'), 'TRAP: popcorn chicken NOT zero');
ok(!isZero('Turkey bacon'), 'TRAP: turkey bacon NOT zero');
ok(!isZero('Deli turkey'), 'TRAP: deli turkey NOT zero');
ok(!isZero('Turkey jerky'), 'TRAP: turkey jerky NOT zero');

// ══ TRAP CASES: fruit ══
ok(isZero('Apple'), 'apple is zero');
ok(isZero('Banana'), 'banana is zero');
ok(isZero('Frozen strawberries'), 'frozen strawberries are zero');
ok(!isZero('Apple juice'), 'TRAP: apple juice NOT zero');
ok(!isZero('Orange juice'), 'TRAP: orange juice NOT zero');
ok(!isZero('Applesauce'), 'TRAP: applesauce NOT zero');
ok(!isZero('Dried mango'), 'TRAP: dried fruit NOT zero');
ok(!isZero('Dried apricots'), 'TRAP: dried apricots NOT zero');
ok(!isZero('Banana chips'), 'TRAP: banana chips NOT zero');
ok(!isZero('Banana bread'), 'TRAP: banana bread NOT zero');
ok(!isZero('Fruit snacks'), 'TRAP: fruit snacks NOT zero');
ok(!isZero('Fruit leather'), 'TRAP: fruit leather NOT zero');
ok(!isZero('Strawberry jam'), 'TRAP: jam NOT zero');
ok(!isZero('Candied cherries'), 'TRAP: candied fruit NOT zero');
ok(!isZero('Peaches in syrup'), 'TRAP: fruit in syrup NOT zero');
ok(!isZero('Apple pie'), 'TRAP: apple pie NOT zero');
ok(!isZero('Lemonade'), 'TRAP: lemonade NOT zero (old substring bug)');
ok(!isZero('Key lime pie'), 'TRAP: key lime pie NOT zero (old substring bug)');
ok(!isZero('Fig Newtons cookies'), 'TRAP: fig newton NOT zero (old substring bug)');
ok(!isZero('Fruit smoothie'), 'TRAP: smoothie NOT zero');
ok(!isZero('Chocolate covered strawberries'), 'TRAP: chocolate strawberries NOT zero');

// ══ TRAP CASES: eggs ══
ok(isZero('Eggs'), 'eggs are zero');
ok(isZero('Hard boiled egg'), 'hard boiled egg is zero');
ok(isZero('Scrambled eggs'), 'scrambled eggs are zero');
ok(isZero('Egg whites'), 'egg whites are zero');
ok(isZero('Eggplant'), 'eggplant is zero (old "egg" branch bug)');
ok(!isZero('Egg salad'), 'TRAP: egg salad NOT zero');
ok(!isZero('Egg roll'), 'TRAP: egg roll NOT zero');
ok(!isZero('Egg noodles'), 'TRAP: egg noodles NOT zero');
ok(!isZero('Deviled eggs'), 'TRAP: deviled eggs NOT zero');
ok(!isZero('Egg McMuffin'), 'TRAP: egg mcmuffin NOT zero');
ok(!isZero('Eggs Benedict'), 'TRAP: eggs benedict NOT zero');

// ══ TRAP CASES: fish ══
ok(isZero('Salmon'), 'salmon is zero');
ok(isZero('Grilled cod'), 'grilled cod is zero');
ok(isZero('Shrimp'), 'shrimp is zero');
ok(isZero('Canned tuna in water'), 'canned tuna is zero');
ok(!isZero('Fish sticks'), 'TRAP: fish sticks NOT zero');
ok(!isZero('Fish and chips'), 'TRAP: fish and chips NOT zero');
ok(!isZero('Breaded fish fillet'), 'TRAP: breaded fish NOT zero');
ok(!isZero('Tuna salad'), 'TRAP: tuna salad NOT zero');
ok(!isZero('Smoked salmon'), 'smoked salmon NOT zero (conservative — flagged for review)');
ok(!isZero('Swedish Fish'), 'TRAP: Swedish Fish candy NOT zero');
ok(!isZero('Crab rangoon'), 'TRAP: crab rangoon NOT zero');
ok(!isZero('Crab cakes'), 'TRAP: crab cakes NOT zero');
ok(!isZero('Imitation crab'), 'TRAP: imitation crab NOT zero');

// ══ TRAP CASES: corn / popcorn ══
ok(isZero('Corn on the cob'), 'corn on the cob is zero');
ok(isZero('Sweet corn'), 'sweet corn is zero');
ok(!isZero('Corn chips'), 'TRAP: corn chips NOT zero');
ok(!isZero('Corn flakes'), 'TRAP: corn flakes NOT zero (old blocklist gap)');
ok(!isZero('Cornbread'), 'TRAP: cornbread NOT zero');
ok(!isZero('Corn dog'), 'TRAP: corn dog NOT zero');
ok(!isZero('Corn tortilla'), 'TRAP: corn tortilla NOT zero');
ok(!isZero('Corn syrup'), 'TRAP: corn syrup NOT zero');
ok(isZero('Air-popped popcorn'), 'air-popped popcorn is zero (2025/2026 program)');
ok(isZero('Air popped plain popcorn'), 'air popped plain popcorn is zero');
ok(!isZero('Popcorn'), 'unqualified popcorn NOT zero (cannot verify air-popped/plain)');
ok(!isZero('Buttered popcorn'), 'TRAP: buttered popcorn NOT zero');
ok(!isZero('Kettle corn popcorn'), 'TRAP: kettle corn NOT zero');
ok(!isZero('Caramel popcorn'), 'TRAP: caramel popcorn NOT zero');
ok(!isZero('Movie theater popcorn'), 'TRAP: movie theater popcorn NOT zero');

// ══ TRAP CASES: legumes / tofu ══
ok(isZero('Black beans'), 'black beans are zero');
ok(isZero('Lentils'), 'lentils are zero');
ok(isZero('Chickpeas'), 'chickpeas are zero');
ok(isZero('Edamame'), 'edamame is zero');
ok(isZero('Tofu'), 'tofu is zero');
ok(isZero('Tempeh'), 'tempeh is zero');
ok(!isZero('Fried tofu'), 'TRAP: fried tofu NOT zero');
ok(!isZero('Hummus'), 'TRAP: hummus NOT zero');
ok(!isZero('Refried beans'), 'TRAP: refried beans NOT zero');
ok(!isZero('Baked beans'), 'TRAP: baked beans (sweetened) NOT zero');
ok(!isZero('Falafel'), 'TRAP: falafel NOT zero');
ok(!isZero('Jelly beans'), 'TRAP: jelly beans NOT zero');
ok(!isZero('Soy milk'), 'TRAP: soy milk NOT zero');

// ══ TRAP CASES: lean beef & pork ══
ok(isZero('Lean ground beef 93%'), 'lean ground beef is zero');
ok(isZero('Sirloin steak'), 'sirloin is zero');
ok(isZero('Pork tenderloin'), 'pork tenderloin is zero');
ok(isZero('Flank steak'), 'flank steak is zero');
ok(!isZero('Ribeye steak'), 'ribeye (not lean) NOT zero');
ok(!isZero('Bacon'), 'TRAP: bacon NOT zero');
ok(!isZero('Pork sausage'), 'TRAP: sausage NOT zero');
ok(!isZero('Beef jerky'), 'TRAP: beef jerky NOT zero');
ok(!isZero('Hamburger'), 'TRAP: hamburger NOT zero');
ok(!isZero('Meatballs'), 'TRAP: meatballs NOT zero');

// ══ misc regressions ══
ok(isZero('Butternut squash'), 'butternut squash zero ("butter" must not leak into "butternut")');
ok(!isZero('Dr Pepper'), 'Dr Pepper NOT zero (pepper keyword must not match)');
ok(!isZero('Peanut butter'), 'peanut butter NOT zero');
ok(isZero('Green peas'), 'green peas are zero');
ok(isZero('Split peas'), 'split peas are zero');
ok(isZero('Pickles'), 'pickles are zero');
ok(!isZero('Vegetable soup'), 'soup NOT zero (conservative — flagged for review)');

// ══ DIABETIC PLAN VARIANT ══
const D = 'diabetic';
ok(!isZero('Banana', D), 'diabetic: fruit NOT zero');
ok(!isZero('Apple', D), 'diabetic: apple NOT zero');
ok(!isZero('Corn on the cob', D), 'diabetic: corn NOT zero');
ok(!isZero('Baked potato', D), 'diabetic: potato NOT zero');
ok(!isZero('Sweet potato', D), 'diabetic: sweet potato NOT zero');
ok(!isZero('Green peas', D), 'diabetic: starchy veg (peas) NOT zero');
ok(!isZero('Plain rolled oats', D), 'diabetic: oats NOT zero');
ok(!isZero('Plain nonfat Greek yogurt', D), 'diabetic: yogurt NOT zero');
ok(!isZero('Plain nonfat cottage cheese', D), 'diabetic: cottage cheese NOT zero');
ok(isZero('Chicken breast', D), 'diabetic: chicken breast still zero');
ok(isZero('Eggs', D), 'diabetic: eggs still zero');
ok(isZero('Salmon', D), 'diabetic: fish still zero');
ok(isZero('Broccoli', D), 'diabetic: non-starchy veg still zero');
ok(isZero('Black beans', D), 'diabetic: beans still zero');
ok(isZero('Tofu', D), 'diabetic: tofu still zero');
ok(isZero('Lean ground beef 93%', D), 'diabetic: lean beef still zero');
{
  const r = E.zeroCheck('Banana', '', D);
  ok(/diabetic/.test(r.reason), 'diabetic exclusion carries an explanatory reason');
}

// ══ POINTS FORMULA ══
function pts(n, name) { return E.calcPoints(n, name || 'test food item xq', '', 'standard').points; }
ok(pts({ cal: 100, sat: 0, sug: 0, addedSug: 0, pro: 0, fib: 0 }) === 3, 'formula: 100 cal plain = 3 pts');
ok(pts({ cal: 120, sat: 1, sug: 0, addedSug: 0, pro: 24, fib: 0 }) === 2, 'formula: protein credit works');
ok(pts({ cal: 50, sat: 0, sug: 0, addedSug: 0, pro: 20, fib: 5 }) === 0, 'formula: floors at 0');
ok(pts({ cal: 152, sat: 1.4, sug: 0.2, addedSug: 0, pro: 1.8, fib: 1.4 }, 'Potato chips') === 5, 'potato chips ≈ 5 pts');
{
  const r = E.calcPoints(null, 'Mystery casserole', '', 'standard');
  ok(r.points === null && r.flags.includes('missing-nutrition'),
    'unknown nutrition → null points + missing-nutrition flag (never a silent guess)');
  const r2 = E.calcPoints({ cal: 100, sat: 0, sug: 10, pro: 0, fib: 0 }, 'Mystery snack bar', '', 'standard');
  ok(r2.flags.includes('total-sugar-fallback'), 'total-sugar fallback is flagged');
  const r3 = E.calcPoints({ cal: 105, sat: 0.1, sug: 14, pro: 1.3, fib: 3.1 }, 'Banana', '', 'standard');
  ok(r3.points === 0 && r3.zero === true, 'zero-point food → 0 pts regardless of nutrition');
  const r4 = E.calcPoints({ cal: 105, sat: 0.1, sug: 14, pro: 1.3, fib: 3.1 }, 'Banana', '', 'diabetic');
  ok(r4.points > 0 && r4.zero === false, 'diabetic: banana gets real points from nutrition');
}

// ══ CATEGORY TAGS (Open Food Facts) ══
ok(!E.zeroCheck('Tropicana Pure Premium', 'en:orange-juices en:beverages', 'standard').zero,
  'OFF category tags catch juice sold under a brand name');
ok(E.zeroCheck('Plain nonfat Greek yogurt', 'en:fermented-milk-products en:yogurts', 'standard').zero,
  'broad OFF dairy tags ("milk") must not block plain nonfat yogurt');

// ══ BARCODE VALIDATION ══
ok(E.validateBarcode('049000028911').ok, 'valid UPC-A accepted');
ok(E.validateBarcode('049000028911').format === 'upc_a', 'UPC-A format detected');
ok(E.validateBarcode('4006381333931').ok, 'valid EAN-13 accepted');
ok(E.validateBarcode('96385074').ok, 'valid EAN-8 accepted');
ok(!E.validateBarcode('049000028912').ok, 'bad checksum rejected (12-digit)');
ok(!E.validateBarcode('12ab34').ok, 'non-digits rejected');
ok(!E.validateBarcode('123').ok, 'too-short rejected');
ok(E.validateBarcode('654321').ok, 'UPC-E (6-digit) accepted');

// ══ FOOD DB SANITY ══
ok(FoodDB.FOODS.length >= 40, 'food DB has a useful number of entries');
ok(FoodDB.STARTER_MEALS.every(m => m.components.every(c => FoodDB.byId(c.foodId))),
  'every starter-meal component resolves to a DB food');
{
  // Meal math: zero components contribute zero at any quantity.
  const bowl = FoodDB.STARTER_MEALS.find(m => m.id === 'starter-chicken-bowl');
  const total = bowl.components.reduce((s, c) => {
    const f = FoodDB.byId(c.foodId);
    const r = E.calcPoints({ cal: f.cal, sat: f.sat, sug: f.sug, addedSug: f.asug, pro: f.pro, fib: f.fib }, f.name, '', 'standard');
    return s + (r.zero ? 0 : Math.round(r.points * c.qty));
  }, 0);
  ok(total === 0, 'all-zero starter meal totals 0 pts on standard plan');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? ':\n  - ' + failures.join('\n  - ') : ' ✓'));
process.exit(fail ? 1 : 0);
