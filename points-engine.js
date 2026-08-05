/**
 * PointsEngine — points + zero-point classification for the current WW Points
 * program (2025/2026, the program that replaced PersonalPoints).
 *
 * NOTE ON ACCURACY: WW's exact Points algorithm is proprietary and has never
 * been published. The formula below is the closest published approximation,
 * driven by calories, saturated fat, added sugar, protein, and fiber. Values
 * may differ from the official WW app by ±1 point for some foods. When added
 * sugar is unavailable (Open Food Facts usually reports only total sugars),
 * total sugars are used as a stand-in and the result is flagged as an
 * approximation that may OVERestimate points for foods with natural sugars.
 *
 * ZERO-POINT RULE (critical): zero-point status applies ONLY to plain, whole,
 * unprocessed forms of foods in the zero-point categories. Derivatives never
 * inherit zero points (potato=0 but chips/fries/hash browns=points; plain
 * oats=0 but granola bars=points; plain nonfat yogurt=0 but flavored=points;
 * chicken breast=0 but breaded/fried=points; fruit=0 but juice/dried=points).
 * This file enforces that with a processing/preparation check that runs BEFORE
 * any zero-point category can match.
 *
 * Works in both the browser (window.PointsEngine) and Node (module.exports)
 * so the same logic is unit-testable and usable by validation tooling.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PointsEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLAN_STANDARD = 'standard';
  var PLAN_DIABETIC = 'diabetic';

  // ── keyword matching ────────────────────────────────────────────────────
  // Word-boundary matching (not substring) so "lemon" ≠ "lemonade",
  // "fig" ≠ "fig newton" is handled by markers, "butter" ≠ "butternut",
  // "egg" ≠ "eggplant", "corn" ≠ "popcorn", "pea" ≠ "peanut".
  var rxCache = {};
  function kwRegex(kw) {
    if (rxCache[kw]) return rxCache[kw];
    var rawWords = kw.trim().toLowerCase().split(/\s+/);
    var words = rawWords.map(function (w) {
      var esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (/[^a-z0-9]$/.test(w)) return esc; // e.g. "2%" — no plural suffix
      if (/y$/.test(w)) return esc.slice(0, -1) + '(?:y|ies)';
      if (/(s|x|z|ch|sh)$/.test(w)) return esc + '(?:es)?';
      return esc + '(?:s|es)?';
    });
    // Trailing \b only works next to a word character; skip it for keywords
    // ending in symbols like "%" (the plural suffix keeps \b valid otherwise).
    var tail = /[a-z0-9]$/.test(rawWords[rawWords.length - 1]) ? '\\b' : '';
    rxCache[kw] = new RegExp('\\b' + words.join('[\\s\\-]+') + tail, 'i');
    return rxCache[kw];
  }
  function matchAny(text, list) {
    for (var i = 0; i < list.length; i++) {
      if (kwRegex(list[i]).test(text)) return list[i];
    }
    return null;
  }

  // ── processing / preparation check ──────────────────────────────────────
  // Any of these in a food NAME means the food is a processed derivative and
  // can never be zero, no matter what base-food keyword it also contains.
  // Cooking methods that preserve zero status (baked, boiled, steamed,
  // roasted, grilled, poached, air-fried without oil, raw, frozen) are
  // deliberately NOT in this list.
  var PROCESSED_MARKERS = [
    // fried / breaded / coated
    'fried', 'fry', 'breaded', 'battered', 'tempura', 'katsu', 'schnitzel',
    'crusted', 'coated', 'popcorn chicken', 'popcorn shrimp', 'melt',
    // potato / veg derivatives
    'chip', 'crisps', 'hash brown', 'hash', 'tater tot', 'gnocchi', 'latke',
    'fritter', 'wedges', 'au gratin', 'gratin', 'scalloped', 'loaded',
    'stuffed', 'smothered', 'casserole', 'creamed',
    // dehydrated/boxed mixes (deliberately specific — "instant pot" is a
    // cooking device, not a processed product)
    'instant mashed', 'instant potato', 'instant oatmeal', 'instant rice',
    // drinks / liquid forms (whole fruit = 0, juice = points)
    'juice', 'nectar', 'soda', 'cola', 'lemonade', 'punch', 'cocktail',
    'smoothie', 'shake', 'milkshake', 'frappe', 'latte', 'mocha',
    'beer', 'wine', 'vodka', 'rum', 'whiskey', 'liqueur', 'margarita',
    'drink', 'beverage',
    // dried / sweetened fruit forms
    'dried', 'dehydrated', 'candied', 'glazed', 'sweetened', 'in syrup',
    'syrup', 'jam', 'jelly', 'preserves', 'marmalade', 'fruit snack',
    'fruit leather', 'roll-up',
    // baked goods / grains-as-products
    'bread', 'toast', 'bagel', 'muffin', 'mcmuffin', 'biscuit', 'roll',
    'bun', 'croissant', 'pastry', 'danish', 'donut', 'doughnut', 'cake',
    'pie', 'cobbler', 'tart', 'cookie', 'brownie', 'bar', 'granola',
    'cereal', 'flakes', 'puffs', 'cracker', 'pretzel', 'pancake', 'waffle',
    'noodle', 'pasta', 'macaroni', 'ravioli', 'lasagna', 'pizza',
    'quesadilla', 'burrito', 'enchilada', 'sandwich', 'wrap', 'panini',
    'sushi', 'tortilla', 'dumpling', 'pierogi', 'pot pie',
    // processed meats
    'nugget', 'tender', 'strip', 'stick', 'patty', 'burger', 'sausage', 'bacon',
    'jerky', 'deli', 'ham', 'salami', 'pepperoni', 'bologna', 'hot dog',
    'corn dog', 'meatball', 'meatloaf', 'wing', 'rotisserie', 'imitation',
    'smoked', 'cured', 'orange chicken', 'sesame chicken', 'general tso',
    'sweet and sour', 'kung pao', 'buffalo', 'teriyaki', 'bbq', 'barbecue',
    // fats / sauces / dressings added
    'butter', 'buttered', 'oil', 'cream', 'creamy', 'alfredo', 'mayo',
    'mayonnaise', 'aioli', 'ranch', 'dressing', 'gravy', 'sauce', 'ketchup',
    'cheesy', 'cheddar', 'mozzarella', 'parmesan',
    // mixed salads that imply mayo/dressing (NOT garden salads)
    'egg salad', 'chicken salad', 'tuna salad', 'potato salad',
    'macaroni salad', 'deviled', 'scotch egg', 'benedict',
    // desserts / candy
    'chocolate', 'cocoa', 'candy', 'gummy', 'fudge', 'frosted', 'frosting',
    'icing', 'ice cream', 'frozen yogurt', 'froyo', 'gelato', 'sorbet',
    'sherbet', 'pudding', 'custard', 'parfait', 'mousse',
    // common sweet flavorings (block flavored dairy/oats/etc.)
    'vanilla', 'caramel', 'maple', 'brown sugar', 'honey', 'kettle',
    // legume derivatives
    'hummus', 'refried', 'baked bean', 'bean dip', 'dip', 'falafel',
    // misc processed
    'soup', 'protein powder', 'powder', 'supplement', 'swedish fish',
    'rangoon', 'oat milk', 'soy milk', 'almond milk', 'coconut milk',
    'rice milk'
  ];

  // Smaller marker set applied to Open Food Facts category tags (which are
  // hyphenated slugs like "en:orange-juices"). Kept narrow because OFF tags
  // legitimately contain broad words (e.g. plain yogurt is tagged
  // "fermented-milk-products", air-popped popcorn is tagged "snacks").
  var CATEGORY_MARKERS = [
    'juice', 'soda', 'chip', 'crisps', 'fry', 'candy', 'chocolate',
    'cereal', 'bread', 'cookie', 'cake', 'dried', 'jam', 'syrup',
    'smoothie', 'sausage', 'bacon', 'ice cream', 'biscuit', 'confectioner'
  ];

  // ── zero-point categories (2025/2026 standard plan) ─────────────────────
  // zeroOnDiabetic:false ⇒ on the diabetic plan variant this category is NOT
  // zero (fruit, corn, potatoes/starchy vegetables, oats, yogurt, cottage
  // cheese carry points on that plan).
  // requireAny / requireAllGroups are extra qualifiers that must appear in
  // the NAME for the category to apply (e.g. dairy must be plain AND nonfat).
  var ZERO_CATEGORIES = [
    {
      // Checked FIRST and exclusive: a yogurt/cottage-cheese product that
      // fails the plain+nonfat qualifiers must be definitively NOT zero —
      // it must never fall through and be reclassified by a flavor keyword
      // (e.g. "strawberry nonfat yogurt" must not match the fruit category).
      // Plain + nonfat BOTH required — flavored, sweetened, low-fat (not
      // nonfat), or whole-milk versions all carry points.
      id: 'dairy-plain-nonfat', label: 'Plain nonfat yogurt & cottage cheese',
      zeroOnDiabetic: false, exclusive: true,
      keywords: ['yogurt', 'yoghurt', 'greek yogurt', 'cottage cheese',
        'quark', 'skyr'],
      requireAllGroups: [
        ['plain', 'unsweetened'],
        ['nonfat', 'non-fat', 'fat free', 'fat-free', '0%', 'skim']
      ],
      blockAny: ['strawberry', 'blueberry', 'peach', 'raspberry', 'cherry',
        'mango', 'pineapple', 'lemon', 'coconut', 'coffee', 'cinnamon',
        'fruit', 'flavored', 'whipped', 'light', 'low-fat', 'lowfat',
        '1%', '2%', '4%', '5%', 'whole milk']
    },
    {
      id: 'legumes', label: 'Beans, lentils & legumes', zeroOnDiabetic: true,
      keywords: ['bean', 'black bean', 'kidney bean', 'pinto bean',
        'cannellini bean', 'navy bean', 'lima bean', 'garbanzo', 'chickpea',
        'lentil', 'split pea', 'mung bean', 'adzuki bean', 'fava bean',
        'soybean', 'edamame']
    },
    {
      id: 'tofu-tempeh', label: 'Tofu & tempeh', zeroOnDiabetic: true,
      keywords: ['tofu', 'tempeh']
    },
    {
      id: 'nonstarchy-veg', label: 'Non-starchy vegetables', zeroOnDiabetic: true,
      keywords: ['broccoli', 'spinach', 'kale', 'lettuce', 'cabbage',
        'carrot', 'cucumber', 'celery', 'tomato', 'zucchini', 'courgette',
        'squash', 'eggplant', 'aubergine', 'bell pepper', 'red pepper',
        'green pepper', 'jalapeno', 'onion', 'garlic', 'mushroom',
        'asparagus', 'artichoke', 'beet', 'radish', 'turnip', 'leek',
        'chard', 'arugula', 'watercress', 'cauliflower', 'brussels sprout',
        'green bean', 'snap pea', 'snow pea', 'okra', 'pumpkin', 'fennel',
        'kohlrabi', 'rutabaga', 'bok choy', 'collard', 'jicama',
        'mixed greens', 'salad greens', 'side salad', 'garden salad',
        'cherry tomato', 'pickle', 'sauerkraut', 'salsa',
        // Generic phrasings people actually type. Safe because the processing
        // check runs first: "vegetable oil", "vegetable soup", "veggie chips"
        // and "vegetable juice" are all rejected before reaching here.
        'vegetable', 'veggies', 'veggie', 'mixed vegetable', 'garden vegetable',
        'crudite']
    },
    {
      id: 'fruit', label: 'Fruits (whole, plain)', zeroOnDiabetic: false,
      keywords: ['apple', 'apricot', 'banana', 'blackberry', 'blueberry',
        'cantaloupe', 'cherry', 'clementine', 'cranberry', 'date', 'fig',
        'grape', 'grapefruit', 'guava', 'honeydew', 'kiwi', 'lemon', 'lime',
        'lychee', 'mango', 'melon', 'nectarine', 'orange', 'papaya',
        'passion fruit', 'peach', 'pear', 'pineapple', 'plum',
        'pomegranate', 'raspberry', 'strawberry', 'tangerine', 'watermelon',
        'berries', 'mixed berry']
    },
    {
      id: 'eggs', label: 'Eggs', zeroOnDiabetic: true,
      keywords: ['egg', 'egg white', 'hard boiled egg', 'poached egg',
        'scrambled egg', 'omelette', 'omelet']
    },
    {
      id: 'fish-shellfish', label: 'Fish & shellfish', zeroOnDiabetic: true,
      keywords: ['fish', 'tilapia', 'cod', 'salmon', 'tuna', 'shrimp',
        'prawn', 'scallop', 'crab', 'lobster', 'clam', 'oyster', 'mussel',
        'sardine', 'anchovy', 'halibut', 'flounder', 'haddock', 'trout',
        'catfish', 'pollock', 'mahi mahi', 'snapper', 'swordfish',
        'whitefish', 'sea bass', 'mackerel', 'herring', 'perch', 'sole',
        'sashimi']
    },
    {
      id: 'poultry', label: 'Skinless chicken & turkey', zeroOnDiabetic: true,
      keywords: ['chicken breast', 'chicken tenderloin', 'turkey breast',
        'turkey tenderloin', 'ground chicken breast', 'ground turkey breast',
        'skinless chicken', 'skinless turkey', 'boneless skinless']
    },
    {
      // Dark meat is zero ONLY when explicitly skinless (2025/2026 rule:
      // skinless chicken/turkey including dark meat).
      id: 'poultry-dark', label: 'Skinless dark-meat poultry', zeroOnDiabetic: true,
      exclusive: true,
      keywords: ['chicken thigh', 'chicken drumstick', 'chicken leg',
        'turkey thigh', 'turkey drumstick', 'dark meat'],
      requireAny: ['skinless', 'boneless skinless']
    },
    {
      id: 'lean-beef-pork', label: 'Lean beef & lean pork', zeroOnDiabetic: true,
      keywords: ['lean beef', 'lean ground beef', 'extra lean', '90% lean',
        '93% lean', '95% lean', '96% lean', '97% lean', 'sirloin',
        'tenderloin', 'eye of round', 'top round', 'bottom round',
        'flank steak', 'filet mignon', 'london broil', 'lean pork',
        'pork loin', 'pork tenderloin']
    },
    {
      id: 'corn', label: 'Corn', zeroOnDiabetic: false,
      keywords: ['corn', 'corn on the cob', 'sweet corn', 'baby corn']
    },
    {
      id: 'potato-starchy', label: 'Potatoes & starchy vegetables',
      zeroOnDiabetic: false,
      keywords: ['potato', 'sweet potato', 'yam', 'plantain', 'parsnip',
        'cassava', 'taro', 'pea', 'green pea']
    },
    {
      id: 'oats', label: 'Plain oats & oatmeal', zeroOnDiabetic: false,
      keywords: ['oats', 'oatmeal', 'rolled oats', 'steel cut oats',
        'steel-cut oats', 'overnight oats', 'oat bran'],
      blockAny: ['flavored', 'fruit', 'apple cinnamon', 'peaches and cream',
        'strawberries and cream', 'raisin', 'protein oatmeal']
    },
    {
      // Only AIR-POPPED plain popcorn is zero. Buttered, kettle, caramel,
      // movie-theater, microwave-butter popcorn all carry points.
      id: 'popcorn', label: 'Air-popped plain popcorn', zeroOnDiabetic: true,
      exclusive: true,
      keywords: ['popcorn'],
      requireAny: ['air-popped', 'air popped'],
      blockAny: ['movie', 'microwave', 'white cheddar', 'cheese']
    }
  ];

  // ── conditional preparations ────────────────────────────────────────────
  // These are zero-point foods prepared in a way where added fat or dairy is
  // COMMON BUT OPTIONAL. Plain mashed potato is just potato — zero. Mashed
  // potato with butter and cream is not. The name alone can't tell us which,
  // so instead of guessing (the old build assumed the worst and charged
  // points for all of them), the engine returns zero AND flags the item as
  // conditional so the app can ask what went in and add points for exactly
  // those add-ins.
  //
  // A name that already states an add-in ("mashed potatoes with butter")
  // never reaches here — butter/oil/cream/cheese/gravy are processed markers,
  // so the food is pointed before the conditional check runs.
  var CONDITIONAL_PREPARATIONS = [
    { match: ['mashed potato', 'mashed sweet potato', 'mashed cauliflower'],
      prompt: 'Was anything mashed in — butter, milk, cream?' },
    { match: ['roasted potato', 'roasted vegetable', 'roasted veggies',
              'grilled vegetable', 'grilled veggies', 'roasted brussels sprout',
              'roasted broccoli', 'roasted cauliflower', 'roasted carrot'],
      prompt: 'Roasted or grilled in any oil?' },
    { match: ['scrambled egg', 'omelet', 'omelette', 'egg white omelet'],
      prompt: 'Cooked with butter, oil, cheese or milk?' },
    { match: ['sauteed spinach', 'sauteed mushroom', 'sauteed onion',
              'sauteed vegetable', 'sauteed green bean'],
      prompt: 'How much oil or butter went in the pan?' }
  ];

  // Foods whose zero/points status is a genuine judgment call under the
  // "plain, whole, unprocessed only" rule. The engine treats them
  // CONSERVATIVELY (points, not zero) and surfaces them for human review.
  var REVIEW_NOTES = [
    { term: 'smoked', note: 'Smoked fish/poultry treated as processed (points). Official WW has sometimes counted smoked fish as zero.' },
    { term: 'date', note: 'Dates matched as fruit (zero) when fresh; "dried dates" are blocked. Most store dates are semi-dried — review.' },
    { term: 'squash', note: 'All squash (incl. winter/butternut) classified non-starchy (zero on both plans). If you treat winter squash as starchy, it should not be zero on the diabetic plan.' },
    { term: 'soup', note: 'All soups treated as processed (points) because broth/additions cannot be verified from a name.' },
    { term: 'popcorn', note: 'Popcorn is zero ONLY when the name says air-popped; plain "popcorn" without that qualifier gets points.' }
  ];

  function conditionalFor(hay) {
    for (var i = 0; i < CONDITIONAL_PREPARATIONS.length; i++) {
      if (matchAny(hay, CONDITIONAL_PREPARATIONS[i].match)) return CONDITIONAL_PREPARATIONS[i];
    }
    return null;
  }

  function normalizeName(s) {
    // "air fried"/"air-fried" (no oil) is an allowed cooking method — rewrite
    // it so the 'fried'/'fry' processed markers don't fire on it.
    return String(s || '').toLowerCase()
      .replace(/\bair[\s-]?fr(?:ied|y|yer)\b/g, 'airprepared');
  }

  /**
   * zeroCheck(name, cats, plan) → { zero, category, categoryId, reason }
   * cats: space-joined Open Food Facts category tags (optional).
   * plan: 'standard' (default) or 'diabetic'.
   */
  function zeroCheck(name, cats, plan) {
    plan = plan === PLAN_DIABETIC ? PLAN_DIABETIC : PLAN_STANDARD;
    if (!name || !String(name).trim()) {
      return { zero: false, category: null, categoryId: null, reason: 'no name' };
    }
    var hay = normalizeName(name);
    var hayCats = normalizeName(cats || '');

    // 1) Processing/preparation check — runs FIRST so derivatives can never
    //    inherit zero points from a base-food keyword.
    var m = matchAny(hay, PROCESSED_MARKERS);
    if (m) {
      return { zero: false, category: null, categoryId: null,
        reason: 'processed/prepared form ("' + m + '")' };
    }
    var mc = matchAny(hayCats, CATEGORY_MARKERS);
    if (mc) {
      return { zero: false, category: null, categoryId: null,
        reason: 'processed product category ("' + mc + '")' };
    }

    // 2) Category matching (name first, then category tags).
    var both = hay + ' ' + hayCats;
    for (var i = 0; i < ZERO_CATEGORIES.length; i++) {
      var cat = ZERO_CATEGORIES[i];
      var hit = matchAny(both, cat.keywords);
      if (!hit) continue;

      var disqualified = null;
      if (cat.blockAny && matchAny(hay, cat.blockAny)) {
        disqualified = 'contains a disqualifying ingredient/flavor';
      } else if (cat.requireAny && !matchAny(hay, cat.requireAny)) {
        disqualified = 'missing required qualifier ("' + cat.requireAny[0] + '")';
      } else if (cat.requireAllGroups) {
        var ok = cat.requireAllGroups.every(function (group) {
          return group.some(function (q) {
            if (q === '0%') return /(?:^|[^\d.])0\s?%/.test(hay);
            return kwRegex(q).test(hay);
          });
        });
        if (!ok) disqualified = 'must be explicitly plain AND nonfat';
      }
      if (disqualified) {
        // Exclusive categories claim their keyword: a failed qualifier means
        // definitively NOT zero (no fallthrough to other categories).
        if (cat.exclusive) {
          return { zero: false, category: cat.label, categoryId: cat.id,
            reason: disqualified };
        }
        continue;
      }

      if (plan === PLAN_DIABETIC && !cat.zeroOnDiabetic) {
        return { zero: false, category: cat.label, categoryId: cat.id,
          reason: 'not zero on diabetic plan' };
      }
      // Zero — but if it's a preparation where fat/dairy is commonly added,
      // say so, so the caller can ask instead of guessing.
      var cond = conditionalFor(hay);
      return { zero: true, category: cat.label, categoryId: cat.id,
        conditional: !!cond, prompt: cond ? cond.prompt : null,
        reason: 'matches "' + hit + '" (' + cat.label + ')'
          + (cond ? ' — plain form is zero; add-ins carry points' : '') };
    }
    return { zero: false, category: null, categoryId: null,
      reason: 'no zero-point category match' };
  }

  /**
   * calcPoints(nutrition, name, cats, plan) →
   *   { points, zero, category, reason, flags:[] }
   *
   * nutrition: { cal, sat, sug, addedSug, pro, fib } per serving.
   * points is null (never a silent guess) when calories are unknown for a
   * non-zero food — callers must surface that for review.
   *
   * Formula: closest published approximation of the proprietary WW Points
   * algorithm. Driven by calories, saturated fat, added sugar (total sugars
   * as fallback), protein, and fiber.
   */
  function calcPoints(n, name, cats, plan) {
    var zc = zeroCheck(name, cats, plan);
    var flags = [];
    if (zc.zero) {
      return { points: 0, zero: true, category: zc.category,
        categoryId: zc.categoryId, conditional: !!zc.conditional,
        prompt: zc.prompt || null, reason: zc.reason, flags: flags };
    }
    if (!n || n.cal == null || isNaN(+n.cal)) {
      flags.push('missing-nutrition');
      return { points: null, zero: false, category: zc.category,
        categoryId: zc.categoryId, reason: 'nutrition unknown — needs review',
        flags: flags };
    }
    var sugar;
    if (n.addedSug != null && !isNaN(+n.addedSug)) {
      sugar = +n.addedSug;
    } else {
      sugar = +n.sug || 0;
      if (sugar > 0) flags.push('total-sugar-fallback'); // may overestimate
    }
    var pts = (+n.cal * 0.0305)
      + ((+n.sat || 0) * 0.275)
      + (sugar * 0.12)
      - ((+n.pro || 0) * 0.098)
      - ((+n.fib || 0) * 0.098);
    return { points: Math.max(0, Math.round(pts)), zero: false,
      category: zc.category, categoryId: zc.categoryId,
      reason: zc.reason, flags: flags };
  }

  // Barcode sanity: UPC-A(12)/EAN-13(13)/EAN-8(8) verified with the GS1
  // mod-10 checksum. 6–7 digit codes are compressed UPC-E (checksum requires
  // expansion, so they're accepted as plausible and left to the lookup).
  function validateBarcode(code) {
    var c = String(code || '').trim();
    if (!/^\d+$/.test(c)) return { ok: false, reason: 'not-digits' };
    if (c.length < 6 || c.length > 14) return { ok: false, reason: 'bad-length' };
    if (c.length === 6 || c.length === 7) return { ok: true, format: 'upc_e' };
    if (c.length !== 8 && c.length !== 12 && c.length !== 13 && c.length !== 14) {
      return { ok: false, reason: 'bad-length' };
    }
    var digits = c.split('').map(Number);
    var check = digits.pop();
    var sum = 0;
    digits.reverse().forEach(function (d, i) { sum += d * (i % 2 === 0 ? 3 : 1); });
    var expected = (10 - (sum % 10)) % 10;
    if (expected !== check) {
      // 8-digit codes are ambiguous (EAN-8 vs UPC-E); don't hard-fail those.
      if (c.length === 8) return { ok: true, format: 'ean8_or_upce', checksum: 'unverified' };
      return { ok: false, reason: 'checksum' };
    }
    var fmt = c.length === 8 ? 'ean_8' : c.length === 12 ? 'upc_a' : 'ean_13';
    return { ok: true, format: fmt, checksum: 'valid' };
  }

  return {
    PLAN_STANDARD: PLAN_STANDARD,
    PLAN_DIABETIC: PLAN_DIABETIC,
    ZERO_CATEGORIES: ZERO_CATEGORIES,
    PROCESSED_MARKERS: PROCESSED_MARKERS,
    CATEGORY_MARKERS: CATEGORY_MARKERS,
    CONDITIONAL_PREPARATIONS: CONDITIONAL_PREPARATIONS,
    REVIEW_NOTES: REVIEW_NOTES,
    zeroCheck: zeroCheck,
    calcPoints: calcPoints,
    validateBarcode: validateBarcode
  };
});
