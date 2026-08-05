/**
 * FOOD_DB — curated local food database for PointScan.
 * Per-serving nutrition from USDA FoodData Central reference values.
 * Points are ALWAYS computed at runtime through PointsEngine (never stored),
 * so the plan toggle (standard/diabetic) and any engine fix apply everywhere.
 * asug = added sugar (g); null means "no data" (engine falls back to total
 * sugars and flags the item as an approximation).
 *
 * Works in both the browser (window.FoodDB) and Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FoodDB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FOODS = [
    // ── fruits (zero on standard, pointed on diabetic) ──
    { id: 'apple',       name: 'Apple (medium)',                    icon: '🍎', serving: '1 medium (182g)',  cal: 95,  sat: 0,   sug: 19,  asug: 0, pro: 0.5, fib: 4.4 },
    { id: 'banana',      name: 'Banana (medium)',                   icon: '🍌', serving: '1 medium (118g)',  cal: 105, sat: 0.1, sug: 14,  asug: 0, pro: 1.3, fib: 3.1 },
    { id: 'strawberries',name: 'Strawberries',                      icon: '🍓', serving: '1 cup (152g)',     cal: 49,  sat: 0,   sug: 7.4, asug: 0, pro: 1,   fib: 3 },
    { id: 'blueberries', name: 'Blueberries',                       icon: '🫐', serving: '1 cup (148g)',     cal: 84,  sat: 0,   sug: 15,  asug: 0, pro: 1.1, fib: 3.6 },
    { id: 'orange',      name: 'Orange (medium)',                   icon: '🍊', serving: '1 medium (131g)',  cal: 62,  sat: 0,   sug: 12,  asug: 0, pro: 1.2, fib: 3.1 },
    { id: 'grapes',      name: 'Grapes',                            icon: '🍇', serving: '1 cup (151g)',     cal: 104, sat: 0.1, sug: 23,  asug: 0, pro: 1.1, fib: 1.4 },
    { id: 'watermelon',  name: 'Watermelon',                        icon: '🍉', serving: '1 cup (152g)',     cal: 46,  sat: 0,   sug: 9.4, asug: 0, pro: 0.9, fib: 0.6 },
    // ── non-starchy vegetables (zero on both plans) ──
    { id: 'broccoli',    name: 'Broccoli (steamed)',                icon: '🥦', serving: '1 cup (156g)',     cal: 55,  sat: 0.1, sug: 2.2, asug: 0, pro: 3.7, fib: 5.1 },
    { id: 'spinach',     name: 'Spinach (raw)',                     icon: '🥬', serving: '2 cups (60g)',     cal: 14,  sat: 0,   sug: 0.3, asug: 0, pro: 1.7, fib: 1.3 },
    { id: 'carrots',     name: 'Baby carrots',                      icon: '🥕', serving: '10 pieces (100g)', cal: 35,  sat: 0,   sug: 4.8, asug: 0, pro: 0.6, fib: 2.9 },
    { id: 'bellpepper',  name: 'Bell pepper',                       icon: '🫑', serving: '1 medium (119g)',  cal: 24,  sat: 0,   sug: 5,   asug: 0, pro: 1,   fib: 2.5 },
    { id: 'cucumber',    name: 'Cucumber (sliced)',                 icon: '🥒', serving: '1 cup (119g)',     cal: 16,  sat: 0,   sug: 2,   asug: 0, pro: 0.8, fib: 0.6 },
    { id: 'tomatoes',    name: 'Cherry tomatoes',                   icon: '🍅', serving: '1 cup (149g)',     cal: 27,  sat: 0,   sug: 3.9, asug: 0, pro: 1.3, fib: 1.8 },
    { id: 'lettuce',     name: 'Romaine lettuce (shredded)',        icon: '🥬', serving: '2 cups (94g)',     cal: 16,  sat: 0,   sug: 1.1, asug: 0, pro: 1.2, fib: 2 },
    { id: 'eggplant',    name: 'Eggplant (roasted)',                icon: '🍆', serving: '1 cup (99g)',      cal: 35,  sat: 0,   sug: 3.2, asug: 0, pro: 0.8, fib: 2.5 },
    // ── potatoes / starchy / corn (zero standard, pointed diabetic) ──
    { id: 'potato',      name: 'Baked potato (plain)',              icon: '🥔', serving: '1 medium (173g)',  cal: 161, sat: 0,   sug: 2,   asug: 0, pro: 4.3, fib: 3.8 },
    { id: 'sweetpotato', name: 'Sweet potato (baked, plain)',       icon: '🍠', serving: '1 medium (114g)',  cal: 103, sat: 0,   sug: 7.4, asug: 0, pro: 2.3, fib: 3.8 },
    { id: 'mashedpotato',name: 'Mashed potatoes',                   icon: '🥔', serving: '1 cup (210g)',     cal: 174, sat: 0,   sug: 1.6, asug: 0, pro: 4.2, fib: 3.2 },
    { id: 'corn',        name: 'Corn on the cob (plain)',           icon: '🌽', serving: '1 ear (90g)',      cal: 88,  sat: 0.2, sug: 5,   asug: 0, pro: 3.3, fib: 2 },
    { id: 'peas',        name: 'Green peas (steamed)',              icon: '🟢', serving: '1/2 cup (80g)',    cal: 59,  sat: 0.1, sug: 4.7, asug: 0, pro: 4.1, fib: 4.4 },
    // ── oats & popcorn ──
    { id: 'oats',        name: 'Plain rolled oats (dry)',           icon: '🌾', serving: '1/2 cup (40g)',    cal: 150, sat: 0.5, sug: 1,   asug: 0, pro: 5,   fib: 4 },
    { id: 'popcorn-air', name: 'Air-popped plain popcorn',          icon: '🍿', serving: '3 cups (24g)',     cal: 93,  sat: 0.1, sug: 0.2, asug: 0, pro: 3.1, fib: 3.5 },
    // ── eggs / dairy ──
    { id: 'egg',         name: 'Egg (hard boiled)',                 icon: '🥚', serving: '1 large (50g)',    cal: 72,  sat: 1.6, sug: 0.2, asug: 0, pro: 6.3, fib: 0 },
    { id: 'eggwhites',   name: 'Egg whites',                        icon: '🥚', serving: '2 large (66g)',    cal: 34,  sat: 0,   sug: 0.5, asug: 0, pro: 7.2, fib: 0 },
    { id: 'scrambledegg',name: 'Scrambled eggs',                    icon: '🍳', serving: '2 large (100g)',   cal: 144, sat: 3.2, sug: 0.4, asug: 0, pro: 12.6,fib: 0 },
    { id: 'roastedveg',  name: 'Roasted vegetables',                icon: '🥘', serving: '1 cup (150g)',     cal: 70,  sat: 0.1, sug: 5,   asug: 0, pro: 2.5, fib: 4 },
    { id: 'greekyogurt', name: 'Plain nonfat Greek yogurt',         icon: '🥛', serving: '3/4 cup (170g)',   cal: 100, sat: 0,   sug: 6,   asug: 0, pro: 17,  fib: 0 },
    { id: 'cottage',     name: 'Plain nonfat cottage cheese',       icon: '🧀', serving: '1/2 cup (113g)',   cal: 80,  sat: 0,   sug: 4,   asug: 0, pro: 12,  fib: 0 },
    // ── lean proteins ──
    { id: 'chickenbreast',name: 'Chicken breast (grilled, skinless)',icon: '🍗', serving: '4 oz (113g)',     cal: 187, sat: 1.1, sug: 0,   asug: 0, pro: 35,  fib: 0 },
    { id: 'turkeybreast', name: 'Turkey breast (roasted, skinless)', icon: '🦃', serving: '4 oz (113g)',     cal: 153, sat: 0.4, sug: 0,   asug: 0, pro: 34,  fib: 0 },
    { id: 'groundturkey', name: 'Ground turkey breast (99% lean)',   icon: '🦃', serving: '4 oz (113g)',     cal: 132, sat: 0.6, sug: 0,   asug: 0, pro: 30,  fib: 0 },
    { id: 'sirloin',      name: 'Sirloin steak (lean, trimmed)',     icon: '🥩', serving: '4 oz (113g)',     cal: 207, sat: 2.5, sug: 0,   asug: 0, pro: 33,  fib: 0 },
    { id: 'porktenderloin',name: 'Pork tenderloin (roasted)',        icon: '🥩', serving: '4 oz (113g)',     cal: 158, sat: 1.2, sug: 0,   asug: 0, pro: 30,  fib: 0 },
    { id: 'salmon',       name: 'Salmon (baked)',                    icon: '🐟', serving: '4 oz (113g)',     cal: 233, sat: 2.1, sug: 0,   asug: 0, pro: 25,  fib: 0 },
    { id: 'cod',          name: 'Cod (baked)',                       icon: '🐟', serving: '4 oz (113g)',     cal: 96,  sat: 0.2, sug: 0,   asug: 0, pro: 21,  fib: 0 },
    { id: 'shrimp',       name: 'Shrimp (steamed)',                  icon: '🦐', serving: '4 oz (113g)',     cal: 112, sat: 0.1, sug: 0,   asug: 0, pro: 23,  fib: 0 },
    { id: 'tuna',         name: 'Tuna (canned in water)',            icon: '🐟', serving: '1 can (142g)',    cal: 100, sat: 0.2, sug: 0,   asug: 0, pro: 22,  fib: 0 },
    { id: 'tofu',         name: 'Tofu (firm)',                       icon: '⬜', serving: '1/2 cup (126g)',  cal: 94,  sat: 0.7, sug: 0.4, asug: 0, pro: 10,  fib: 0.4 },
    { id: 'blackbeans',   name: 'Black beans (cooked)',              icon: '🫘', serving: '1/2 cup (86g)',   cal: 114, sat: 0.1, sug: 0.3, asug: 0, pro: 7.6, fib: 7.5 },
    { id: 'chickpeas',    name: 'Chickpeas (cooked)',                icon: '🫘', serving: '1/2 cup (82g)',   cal: 134, sat: 0.2, sug: 3.9, asug: 0, pro: 7.3, fib: 6.2 },
    { id: 'lentils',      name: 'Lentils (cooked)',                  icon: '🫘', serving: '1/2 cup (99g)',   cal: 115, sat: 0.1, sug: 1.8, asug: 0, pro: 9,   fib: 7.8 },
    // ── pointed foods ──
    { id: 'wheatbread',   name: 'Whole wheat bread',                 icon: '🍞', serving: '1 slice (43g)',   cal: 80,  sat: 0.2, sug: 4,   asug: 3,   pro: 5,   fib: 3 },
    { id: 'whitebread',   name: 'White bread',                       icon: '🍞', serving: '1 slice (25g)',   cal: 75,  sat: 0.2, sug: 1.5, asug: 1.5, pro: 2.6, fib: 0.8 },
    { id: 'brownrice',    name: 'Brown rice (cooked)',               icon: '🍚', serving: '1 cup (195g)',    cal: 216, sat: 0.4, sug: 0.7, asug: 0,   pro: 5,   fib: 3.5 },
    { id: 'whiterice',    name: 'White rice (cooked)',               icon: '🍚', serving: '1 cup (158g)',    cal: 205, sat: 0.1, sug: 0.1, asug: 0,   pro: 4.3, fib: 0.6 },
    { id: 'pasta',        name: 'Pasta (cooked)',                    icon: '🍝', serving: '1 cup (140g)',    cal: 220, sat: 0.2, sug: 0.8, asug: 0,   pro: 8.1, fib: 2.5 },
    { id: 'tortilla',     name: 'Flour tortilla (8-inch)',           icon: '🫓', serving: '1 tortilla (49g)',cal: 140, sat: 1,   sug: 1,   asug: 1,   pro: 4,   fib: 1 },
    { id: 'oliveoil',     name: 'Olive oil',                         icon: '🫒', serving: '1 tbsp (14g)',    cal: 119, sat: 1.9, sug: 0,   asug: 0,   pro: 0,   fib: 0 },
    { id: 'butter',       name: 'Butter',                            icon: '🧈', serving: '1 tbsp (14g)',    cal: 102, sat: 7.3, sug: 0,   asug: 0,   pro: 0.1, fib: 0 },
    { id: 'peanutbutter', name: 'Peanut butter',                     icon: '🥜', serving: '2 tbsp (32g)',    cal: 188, sat: 3.1, sug: 3.4, asug: 2,   pro: 8,   fib: 1.9 },
    { id: 'cheddar',      name: 'Cheddar cheese',                    icon: '🧀', serving: '1 oz (28g)',      cal: 114, sat: 6,   sug: 0.1, asug: 0,   pro: 6.5, fib: 0 },
    { id: 'avocado',      name: 'Avocado',                           icon: '🥑', serving: '1/2 fruit (100g)',cal: 160, sat: 2.1, sug: 0.7, asug: 0,   pro: 2,   fib: 6.7 },
    { id: 'almonds',      name: 'Almonds',                           icon: '🥜', serving: '1 oz (28g)',      cal: 164, sat: 1.1, sug: 1.2, asug: 0,   pro: 6,   fib: 3.5 },
    { id: 'granolabar',   name: 'Granola bar (oats & honey)',        icon: '🍫', serving: '1 bar (42g)',     cal: 190, sat: 1.5, sug: 12,  asug: 11,  pro: 3,   fib: 2 },
    { id: 'potatochips',  name: 'Potato chips',                      icon: '🥔', serving: '1 oz (28g)',      cal: 152, sat: 1.4, sug: 0.2, asug: 0,   pro: 1.8, fib: 1.4 },
    { id: 'fries',        name: 'French fries',                      icon: '🍟', serving: 'small (85g)',     cal: 222, sat: 1.6, sug: 0.3, asug: 0,   pro: 2.4, fib: 2.1 },
    { id: 'vanillayogurt',name: 'Vanilla low-fat yogurt',            icon: '🥛', serving: '6 oz (170g)',     cal: 150, sat: 1.2, sug: 22,  asug: 16,  pro: 6,   fib: 0 },
    { id: 'oj',           name: 'Orange juice',                      icon: '🧃', serving: '1 cup (248g)',    cal: 112, sat: 0,   sug: 21,  asug: null, pro: 1.7, fib: 0.5 },
    { id: 'driedcranberries', name: 'Dried cranberries (sweetened)', icon: '🍒', serving: '1/4 cup (40g)',   cal: 123, sat: 0,   sug: 29,  asug: 26,  pro: 0,   fib: 2.3 },
    { id: 'skimmilk',     name: 'Skim milk',                         icon: '🥛', serving: '1 cup (245g)',    cal: 83,  sat: 0.1, sug: 12,  asug: null, pro: 8.3, fib: 0 },
    { id: 'honey',        name: 'Honey',                             icon: '🍯', serving: '1 tbsp (21g)',    cal: 64,  sat: 0,   sug: 17,  asug: 17,  pro: 0.1, fib: 0 },
    { id: 'salsa',        name: 'Salsa (fresh)',                     icon: '🍅', serving: '2 tbsp (32g)',    cal: 10,  sat: 0,   sug: 1,   asug: 0,   pro: 0.5, fib: 0.5 }
  ];

  // ADD_INS — the things that actually get stirred into an otherwise
  // zero-point food (mashed potatoes, roasted veg, scrambled eggs). Points are
  // computed at runtime by the engine, same as any other food, so a plain
  // potato stays 0 and "potato + 1 tsp olive oil" costs exactly the oil.
  // Names are deliberately generic ingredient names so the engine's processing
  // check scores them as the fats/dairy they are.
  var ADD_INS = [
    { id: 'ai-butter',     name: 'Butter',            icon: '🧈', serving: '1 tbsp',   cal: 102, sat: 7.3, sug: 0,   asug: 0, pro: 0.1, fib: 0 },
    { id: 'ai-butter-tsp', name: 'Butter',            icon: '🧈', serving: '1 tsp',    cal: 34,  sat: 2.4, sug: 0,   asug: 0, pro: 0,   fib: 0 },
    { id: 'ai-oliveoil',   name: 'Olive oil',         icon: '🫒', serving: '1 tsp',    cal: 40,  sat: 0.6, sug: 0,   asug: 0, pro: 0,   fib: 0 },
    { id: 'ai-oliveoil-tb',name: 'Olive oil',         icon: '🫒', serving: '1 tbsp',   cal: 119, sat: 1.9, sug: 0,   asug: 0, pro: 0,   fib: 0 },
    { id: 'ai-milk',       name: 'Milk (2%)',         icon: '🥛', serving: '1/4 cup',  cal: 31,  sat: 0.8, sug: 3,   asug: null, pro: 2,  fib: 0 },
    { id: 'ai-cream',      name: 'Heavy cream',       icon: '🥛', serving: '2 tbsp',   cal: 101, sat: 6.9, sug: 0.8, asug: null, pro: 0.6, fib: 0 },
    { id: 'ai-sourcream',  name: 'Sour cream',        icon: '🥣', serving: '2 tbsp',   cal: 59,  sat: 3.5, sug: 0.8, asug: null, pro: 0.7, fib: 0 },
    { id: 'ai-cheese',     name: 'Shredded cheese',   icon: '🧀', serving: '1/4 cup',  cal: 114, sat: 6,   sug: 0.1, asug: 0, pro: 6.5, fib: 0 },
    { id: 'ai-gravy',      name: 'Gravy',             icon: '🥣', serving: '1/4 cup',  cal: 30,  sat: 0.6, sug: 0.6, asug: 0, pro: 0.7, fib: 0 },
    { id: 'ai-cookingspray',name:'Cooking spray',     icon: '💨', serving: '1 second', cal: 7,   sat: 0.1, sug: 0,   asug: 0, pro: 0,   fib: 0 }
  ];

  // Starter meals — components reference FOOD_DB ids with quantities.
  // Points are computed at runtime by summing per-component points
  // (rounded per component, zero components contribute 0 at any quantity).
  var STARTER_MEALS = [
    {
      id: 'starter-chicken-bowl', name: 'Grilled Chicken Power Bowl', icon: '🍗',
      starter: true,
      components: [
        { foodId: 'chickenbreast', qty: 1 },
        { foodId: 'potato', qty: 1 },
        { foodId: 'broccoli', qty: 1 }
      ]
    },
    {
      id: 'starter-overnight-oats', name: 'Berry Overnight Oats', icon: '🫐',
      starter: true,
      components: [
        { foodId: 'oats', qty: 1 },
        { foodId: 'greekyogurt', qty: 1 },
        { foodId: 'blueberries', qty: 0.5 },
        { foodId: 'honey', qty: 0.5 }
      ]
    },
    {
      id: 'starter-turkey-tacos', name: 'Turkey Taco Night', icon: '🌮',
      starter: true,
      components: [
        { foodId: 'groundturkey', qty: 1 },
        { foodId: 'tortilla', qty: 2 },
        { foodId: 'cheddar', qty: 0.5 },
        { foodId: 'lettuce', qty: 0.5 },
        { foodId: 'salsa', qty: 1 }
      ]
    },
    {
      id: 'starter-pb-toast', name: 'PB Banana Toast', icon: '🥪',
      starter: true,
      components: [
        { foodId: 'wheatbread', qty: 2 },
        { foodId: 'peanutbutter', qty: 1 },
        { foodId: 'banana', qty: 1 }
      ]
    }
  ];

  function byId(id) {
    for (var i = 0; i < FOODS.length; i++) if (FOODS[i].id === id) return FOODS[i];
    for (var j = 0; j < ADD_INS.length; j++) if (ADD_INS[j].id === id) return ADD_INS[j];
    return null;
  }

  function search(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    return FOODS.filter(function (f) { return f.name.toLowerCase().indexOf(q) !== -1; });
  }

  return { FOODS: FOODS, ADD_INS: ADD_INS, STARTER_MEALS: STARTER_MEALS,
    byId: byId, search: search };
});
