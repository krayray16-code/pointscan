/**
 * FOOD_DB — curated food database for PointScan.
 * Per-serving nutrition from USDA FoodData Central reference values.
 *
 * Points are ALWAYS computed at runtime through PointsEngine, never stored,
 * so the plan toggle (standard/diabetic) and any engine fix apply everywhere
 * at once. asug = added sugar (g); null means "no data", and the engine then
 * falls back to total sugars and flags the item as an approximation.
 *
 * This is the first thing Search looks at, so it deliberately covers plain,
 * generic foods ("chicken breast", "banana", "brown rice") that a barcode
 * database is bad at — packaged-product databases are full of brands and
 * miss the everyday foods people actually log.
 *
 * Works in both the browser (window.FoodDB) and Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FoodDB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FOODS = [
    { id: 'apple', name: 'Apple (medium)', icon: '🍎', serving: '1 medium (182g)', cal: 95, sat: 0, sug: 19, asug: 0, pro: 0.5, fib: 4.4, tags: 'fruit' },
    { id: 'applesliced', name: 'Apple slices', icon: '🍎', serving: '1 cup (109g)', cal: 57, sat: 0, sug: 11, asug: 0, pro: 0.3, fib: 2.6, tags: 'fruit' },
    { id: 'banana', name: 'Banana (medium)', icon: '🍌', serving: '1 medium (118g)', cal: 105, sat: 0.1, sug: 14, asug: 0, pro: 1.3, fib: 3.1, tags: 'fruit' },
    { id: 'strawberries', name: 'Strawberries', icon: '🍓', serving: '1 cup (152g)', cal: 49, sat: 0, sug: 7.4, asug: 0, pro: 1, fib: 3, tags: 'fruit' },
    { id: 'blueberries', name: 'Blueberries', icon: '🫐', serving: '1 cup (148g)', cal: 84, sat: 0, sug: 15, asug: 0, pro: 1.1, fib: 3.6, tags: 'fruit' },
    { id: 'raspberries', name: 'Raspberries', icon: '🍇', serving: '1 cup (123g)', cal: 64, sat: 0, sug: 5.4, asug: 0, pro: 1.5, fib: 8, tags: 'fruit' },
    { id: 'blackberries', name: 'Blackberries', icon: '🫐', serving: '1 cup (144g)', cal: 62, sat: 0, sug: 7, asug: 0, pro: 2, fib: 7.6, tags: 'fruit' },
    { id: 'orange', name: 'Orange (medium)', icon: '🍊', serving: '1 medium (131g)', cal: 62, sat: 0, sug: 12, asug: 0, pro: 1.2, fib: 3.1, tags: 'fruit' },
    { id: 'clementine', name: 'Clementine', icon: '🍊', serving: '1 fruit (74g)', cal: 35, sat: 0, sug: 6.8, asug: 0, pro: 0.6, fib: 1.3, tags: 'fruit' },
    { id: 'grapes', name: 'Grapes', icon: '🍇', serving: '1 cup (151g)', cal: 104, sat: 0.1, sug: 23, asug: 0, pro: 1.1, fib: 1.4, tags: 'fruit' },
    { id: 'watermelon', name: 'Watermelon', icon: '🍉', serving: '1 cup (152g)', cal: 46, sat: 0, sug: 9.4, asug: 0, pro: 0.9, fib: 0.6, tags: 'fruit' },
    { id: 'cantaloupe', name: 'Cantaloupe', icon: '🍈', serving: '1 cup (160g)', cal: 54, sat: 0, sug: 13, asug: 0, pro: 1.3, fib: 1.4, tags: 'fruit' },
    { id: 'pineapple', name: 'Pineapple', icon: '🍍', serving: '1 cup (165g)', cal: 83, sat: 0, sug: 16, asug: 0, pro: 0.9, fib: 2.3, tags: 'fruit' },
    { id: 'mango', name: 'Mango', icon: '🥭', serving: '1 cup (165g)', cal: 99, sat: 0.1, sug: 23, asug: 0, pro: 1.4, fib: 2.6, tags: 'fruit' },
    { id: 'peach', name: 'Peach (medium)', icon: '🍑', serving: '1 medium (150g)', cal: 59, sat: 0, sug: 13, asug: 0, pro: 1.4, fib: 2.3, tags: 'fruit' },
    { id: 'pear', name: 'Pear (medium)', icon: '🍐', serving: '1 medium (178g)', cal: 101, sat: 0, sug: 17, asug: 0, pro: 1, fib: 5.5, tags: 'fruit' },
    { id: 'plum', name: 'Plum', icon: '🍑', serving: '1 fruit (66g)', cal: 30, sat: 0, sug: 7, asug: 0, pro: 0.5, fib: 0.9, tags: 'fruit' },
    { id: 'kiwi', name: 'Kiwi', icon: '🥝', serving: '1 fruit (69g)', cal: 42, sat: 0, sug: 6.2, asug: 0, pro: 0.8, fib: 2.1, tags: 'fruit' },
    { id: 'cherries', name: 'Cherries', icon: '🍒', serving: '1 cup (154g)', cal: 97, sat: 0.1, sug: 20, asug: 0, pro: 1.6, fib: 3.2, tags: 'fruit' },
    { id: 'grapefruit', name: 'Grapefruit', icon: '🍊', serving: '1/2 fruit (123g)', cal: 52, sat: 0, sug: 11, asug: 0, pro: 1, fib: 2, tags: 'fruit' },
    { id: 'melonhoney', name: 'Honeydew melon', icon: '🍈', serving: '1 cup (170g)', cal: 61, sat: 0, sug: 14, asug: 0, pro: 0.9, fib: 1.4, tags: 'fruit' },
    { id: 'pomegranate', name: 'Pomegranate seeds', icon: '🍎', serving: '1/2 cup (87g)', cal: 72, sat: 0.1, sug: 12, asug: 0, pro: 1.5, fib: 3.5, tags: 'fruit' },
    { id: 'fruitsalad', name: 'Mixed fruit salad', icon: '🍓', serving: '1 cup (175g)', cal: 80, sat: 0, sug: 16, asug: 0, pro: 1, fib: 2.5, tags: 'fruit' },
    { id: 'broccoli', name: 'Broccoli (steamed)', icon: '🥦', serving: '1 cup (156g)', cal: 55, sat: 0.1, sug: 2.2, asug: 0, pro: 3.7, fib: 5.1, tags: 'veg' },
    { id: 'spinach', name: 'Spinach (raw)', icon: '🥬', serving: '2 cups (60g)', cal: 14, sat: 0, sug: 0.3, asug: 0, pro: 1.7, fib: 1.3, tags: 'veg' },
    { id: 'spinachcooked', name: 'Spinach (cooked)', icon: '🥬', serving: '1 cup (180g)', cal: 41, sat: 0.1, sug: 0.8, asug: 0, pro: 5.3, fib: 4.3, tags: 'veg' },
    { id: 'carrots', name: 'Baby carrots', icon: '🥕', serving: '10 pieces (100g)', cal: 35, sat: 0, sug: 4.8, asug: 0, pro: 0.6, fib: 2.9, tags: 'veg' },
    { id: 'bellpepper', name: 'Bell pepper', icon: '🫑', serving: '1 medium (119g)', cal: 24, sat: 0, sug: 5, asug: 0, pro: 1, fib: 2.5, tags: 'veg' },
    { id: 'cucumber', name: 'Cucumber (sliced)', icon: '🥒', serving: '1 cup (119g)', cal: 16, sat: 0, sug: 2, asug: 0, pro: 0.8, fib: 0.6, tags: 'veg' },
    { id: 'tomatoes', name: 'Cherry tomatoes', icon: '🍅', serving: '1 cup (149g)', cal: 27, sat: 0, sug: 3.9, asug: 0, pro: 1.3, fib: 1.8, tags: 'veg' },
    { id: 'tomato', name: 'Tomato (medium)', icon: '🍅', serving: '1 medium (123g)', cal: 22, sat: 0, sug: 3.2, asug: 0, pro: 1.1, fib: 1.5, tags: 'veg' },
    { id: 'lettuce', name: 'Romaine lettuce (shredded)', icon: '🥬', serving: '2 cups (94g)', cal: 16, sat: 0, sug: 1.1, asug: 0, pro: 1.2, fib: 2, tags: 'veg' },
    { id: 'mixedgreens', name: 'Mixed salad greens', icon: '🥗', serving: '2 cups (72g)', cal: 15, sat: 0, sug: 0.9, asug: 0, pro: 1.4, fib: 1.4, tags: 'veg' },
    { id: 'eggplant', name: 'Eggplant (roasted)', icon: '🍆', serving: '1 cup (99g)', cal: 35, sat: 0, sug: 3.2, asug: 0, pro: 0.8, fib: 2.5, tags: 'veg' },
    { id: 'zucchini', name: 'Zucchini (cooked)', icon: '🥒', serving: '1 cup (180g)', cal: 29, sat: 0.1, sug: 5, asug: 0, pro: 2.1, fib: 2.5, tags: 'veg' },
    { id: 'cauliflower', name: 'Cauliflower (steamed)', icon: '🥦', serving: '1 cup (124g)', cal: 29, sat: 0.1, sug: 2.6, asug: 0, pro: 2.3, fib: 2.9, tags: 'veg' },
    { id: 'greenbeans', name: 'Green beans (steamed)', icon: '🫛', serving: '1 cup (125g)', cal: 44, sat: 0.1, sug: 4.6, asug: 0, pro: 2.4, fib: 4, tags: 'veg' },
    { id: 'asparagus', name: 'Asparagus (roasted)', icon: '🌿', serving: '1 cup (180g)', cal: 40, sat: 0.1, sug: 2.5, asug: 0, pro: 4.3, fib: 3.6, tags: 'veg' },
    { id: 'brusselsprouts', name: 'Brussels sprouts (roasted)', icon: '🥬', serving: '1 cup (156g)', cal: 56, sat: 0.1, sug: 2.7, asug: 0, pro: 4, fib: 4.1, tags: 'veg' },
    { id: 'mushrooms', name: 'Mushrooms (sauteed)', icon: '🍄', serving: '1 cup (156g)', cal: 44, sat: 0.1, sug: 3.5, asug: 0, pro: 3.4, fib: 2.3, tags: 'veg' },
    { id: 'onion', name: 'Onion (chopped)', icon: '🧅', serving: '1/2 cup (80g)', cal: 32, sat: 0, sug: 3.4, asug: 0, pro: 0.9, fib: 1.4, tags: 'veg' },
    { id: 'cabbage', name: 'Cabbage (shredded)', icon: '🥬', serving: '1 cup (89g)', cal: 22, sat: 0, sug: 2.8, asug: 0, pro: 1.1, fib: 2.2, tags: 'veg' },
    { id: 'kale', name: 'Kale (raw)', icon: '🥬', serving: '1 cup (21g)', cal: 7, sat: 0, sug: 0.2, asug: 0, pro: 0.6, fib: 0.9, tags: 'veg' },
    { id: 'celery', name: 'Celery sticks', icon: '🥬', serving: '1 cup (101g)', cal: 16, sat: 0, sug: 1.3, asug: 0, pro: 0.7, fib: 1.6, tags: 'veg' },
    { id: 'beets', name: 'Beets (cooked)', icon: '🍠', serving: '1 cup (170g)', cal: 75, sat: 0, sug: 14, asug: 0, pro: 2.9, fib: 3.4, tags: 'veg' },
    { id: 'squashbutter', name: 'Butternut squash (roasted)', icon: '🎃', serving: '1 cup (205g)', cal: 82, sat: 0, sug: 3.4, asug: 0, pro: 1.8, fib: 6.6, tags: 'veg' },
    { id: 'salsa', name: 'Salsa (fresh)', icon: '🍅', serving: '2 tbsp (32g)', cal: 10, sat: 0, sug: 1, asug: 0, pro: 0.5, fib: 0.5, tags: 'veg' },
    { id: 'pickles', name: 'Dill pickles', icon: '🥒', serving: '1 spear (35g)', cal: 4, sat: 0, sug: 0.4, asug: 0, pro: 0.2, fib: 0.4, tags: 'veg' },
    { id: 'coleslawplain', name: 'Shredded cabbage & carrot (no dressing)', icon: '🥬', serving: '1 cup (70g)', cal: 22, sat: 0, sug: 2.5, asug: 0, pro: 1, fib: 2, tags: 'veg' },
    { id: 'sidesalad', name: 'Side salad (no dressing)', icon: '🥗', serving: '1 bowl (100g)', cal: 20, sat: 0, sug: 2, asug: 0, pro: 1.2, fib: 1.8, tags: 'veg' },
    { id: 'potato', name: 'Baked potato (plain)', icon: '🥔', serving: '1 medium (173g)', cal: 161, sat: 0, sug: 2, asug: 0, pro: 4.3, fib: 3.8, tags: 'starchy' },
    { id: 'mashedpotato', name: 'Mashed potatoes', icon: '🥔', serving: '1 cup (210g)', cal: 174, sat: 0, sug: 1.6, asug: 0, pro: 4.2, fib: 3.2, tags: 'starchy' },
    { id: 'sweetpotato', name: 'Sweet potato (baked, plain)', icon: '🍠', serving: '1 medium (114g)', cal: 103, sat: 0, sug: 7.4, asug: 0, pro: 2.3, fib: 3.8, tags: 'starchy' },
    { id: 'corn', name: 'Corn on the cob (plain)', icon: '🌽', serving: '1 ear (90g)', cal: 88, sat: 0.2, sug: 5, asug: 0, pro: 3.3, fib: 2, tags: 'starchy' },
    { id: 'cornkernels', name: 'Corn kernels', icon: '🌽', serving: '1/2 cup (82g)', cal: 66, sat: 0.1, sug: 3.7, asug: 0, pro: 2.3, fib: 1.8, tags: 'starchy' },
    { id: 'peas', name: 'Green peas (steamed)', icon: '🟢', serving: '1/2 cup (80g)', cal: 59, sat: 0.1, sug: 4.7, asug: 0, pro: 4.1, fib: 4.4, tags: 'starchy' },
    { id: 'roastedveg', name: 'Roasted vegetables', icon: '🥘', serving: '1 cup (150g)', cal: 70, sat: 0.1, sug: 5, asug: 0, pro: 2.5, fib: 4, tags: 'veg' },
    { id: 'oats', name: 'Plain rolled oats (dry)', icon: '🌾', serving: '1/2 cup (40g)', cal: 150, sat: 0.5, sug: 1, asug: 0, pro: 5, fib: 4, tags: 'grain' },
    { id: 'oatmealcooked', name: 'Plain oatmeal (cooked)', icon: '🥣', serving: '1 cup (234g)', cal: 166, sat: 0.4, sug: 1.1, asug: 0, pro: 5.9, fib: 4, tags: 'grain' },
    { id: 'popcorn-air', name: 'Air-popped plain popcorn', icon: '🍿', serving: '3 cups (24g)', cal: 93, sat: 0.1, sug: 0.2, asug: 0, pro: 3.1, fib: 3.5, tags: 'snack' },
    { id: 'egg', name: 'Egg (hard boiled)', icon: '🥚', serving: '1 large (50g)', cal: 72, sat: 1.6, sug: 0.2, asug: 0, pro: 6.3, fib: 0, tags: 'protein' },
    { id: 'eggwhites', name: 'Egg whites', icon: '🥚', serving: '2 large (66g)', cal: 34, sat: 0, sug: 0.5, asug: 0, pro: 7.2, fib: 0, tags: 'protein' },
    { id: 'scrambledegg', name: 'Scrambled eggs', icon: '🍳', serving: '2 large (100g)', cal: 144, sat: 3.2, sug: 0.4, asug: 0, pro: 12.6, fib: 0, tags: 'protein' },
    { id: 'greekyogurt', name: 'Plain nonfat Greek yogurt', icon: '🥛', serving: '3/4 cup (170g)', cal: 100, sat: 0, sug: 6, asug: 0, pro: 17, fib: 0, tags: 'dairy' },
    { id: 'cottage', name: 'Plain nonfat cottage cheese', icon: '🧀', serving: '1/2 cup (113g)', cal: 80, sat: 0, sug: 4, asug: 0, pro: 12, fib: 0, tags: 'dairy' },
    { id: 'vanillayogurt', name: 'Vanilla low-fat yogurt', icon: '🥛', serving: '6 oz (170g)', cal: 150, sat: 1.2, sug: 22, asug: 16, pro: 6, fib: 0, tags: 'dairy' },
    { id: 'fruityogurt', name: 'Fruit-flavored yogurt', icon: '🥛', serving: '6 oz (170g)', cal: 140, sat: 1, sug: 20, asug: 14, pro: 5, fib: 0, tags: 'dairy' },
    { id: 'skimmilk', name: 'Skim milk', icon: '🥛', serving: '1 cup (245g)', cal: 83, sat: 0.1, sug: 12, asug: null, pro: 8.3, fib: 0, tags: 'dairy' },
    { id: 'milk2', name: '2% milk', icon: '🥛', serving: '1 cup (244g)', cal: 122, sat: 3.1, sug: 12, asug: null, pro: 8.1, fib: 0, tags: 'dairy' },
    { id: 'wholemilk', name: 'Whole milk', icon: '🥛', serving: '1 cup (244g)', cal: 149, sat: 4.6, sug: 12, asug: null, pro: 7.7, fib: 0, tags: 'dairy' },
    { id: 'almondmilk', name: 'Unsweetened almond milk', icon: '🥛', serving: '1 cup (240g)', cal: 39, sat: 0.2, sug: 1, asug: 0, pro: 1.6, fib: 0.7, tags: 'dairy' },
    { id: 'oatmilk', name: 'Oat milk', icon: '🥛', serving: '1 cup (240g)', cal: 120, sat: 0.5, sug: 7, asug: 4, pro: 3, fib: 2, tags: 'dairy' },
    { id: 'cheddar', name: 'Cheddar cheese', icon: '🧀', serving: '1 oz (28g)', cal: 114, sat: 6, sug: 0.1, asug: 0, pro: 6.5, fib: 0, tags: 'dairy' },
    { id: 'mozzarella', name: 'Mozzarella (part-skim)', icon: '🧀', serving: '1 oz (28g)', cal: 85, sat: 3.1, sug: 0.3, asug: 0, pro: 6.3, fib: 0, tags: 'dairy' },
    { id: 'parmesan', name: 'Parmesan (grated)', icon: '🧀', serving: '2 tbsp (10g)', cal: 43, sat: 1.7, sug: 0, asug: 0, pro: 3.8, fib: 0, tags: 'dairy' },
    { id: 'creamcheese', name: 'Cream cheese', icon: '🧀', serving: '1 tbsp (14g)', cal: 51, sat: 2.9, sug: 0.6, asug: 0, pro: 0.9, fib: 0, tags: 'dairy' },
    { id: 'sourcream', name: 'Sour cream', icon: '🥣', serving: '2 tbsp (30g)', cal: 59, sat: 3.5, sug: 0.8, asug: null, pro: 0.7, fib: 0, tags: 'dairy' },
    { id: 'butter', name: 'Butter', icon: '🧈', serving: '1 tbsp (14g)', cal: 102, sat: 7.3, sug: 0, asug: 0, pro: 0.1, fib: 0, tags: 'fat' },
    { id: 'icecream', name: 'Vanilla ice cream', icon: '🍨', serving: '1/2 cup (66g)', cal: 137, sat: 4.5, sug: 14, asug: 12, pro: 2.3, fib: 0.5, tags: 'sweet' },
    { id: 'chickenbreast', name: 'Chicken breast (grilled, skinless)', icon: '🍗', serving: '4 oz (113g)', cal: 187, sat: 1.1, sug: 0, asug: 0, pro: 35, fib: 0, tags: 'protein' },
    { id: 'chickenthighskinless', name: 'Chicken thigh (skinless)', icon: '🍗', serving: '4 oz (113g)', cal: 209, sat: 2.3, sug: 0, asug: 0, pro: 26, fib: 0, tags: 'protein' },
    { id: 'rotisseriechicken', name: 'Rotisserie chicken (with skin)', icon: '🍗', serving: '4 oz (113g)', cal: 230, sat: 3.5, sug: 0, asug: 0, pro: 29, fib: 0, tags: 'protein' },
    { id: 'chickennuggets', name: 'Chicken nuggets', icon: '🍗', serving: '6 pieces (96g)', cal: 280, sat: 4, sug: 0.5, asug: 0, pro: 14, fib: 1, tags: 'protein' },
    { id: 'friedchicken', name: 'Fried chicken (breast)', icon: '🍗', serving: '1 piece (140g)', cal: 364, sat: 4.9, sug: 0, asug: 0, pro: 35, fib: 0.5, tags: 'protein' },
    { id: 'turkeybreast', name: 'Turkey breast (roasted, skinless)', icon: '🦃', serving: '4 oz (113g)', cal: 153, sat: 0.4, sug: 0, asug: 0, pro: 34, fib: 0, tags: 'protein' },
    { id: 'groundturkey', name: 'Ground turkey breast (99% lean)', icon: '🦃', serving: '4 oz (113g)', cal: 132, sat: 0.6, sug: 0, asug: 0, pro: 30, fib: 0, tags: 'protein' },
    { id: 'delidturkey', name: 'Deli turkey slices', icon: '🦃', serving: '2 oz (56g)', cal: 54, sat: 0.2, sug: 1.2, asug: 0, pro: 10, fib: 0, tags: 'protein' },
    { id: 'sirloin', name: 'Sirloin steak (lean, trimmed)', icon: '🥩', serving: '4 oz (113g)', cal: 207, sat: 2.5, sug: 0, asug: 0, pro: 33, fib: 0, tags: 'protein' },
    { id: 'groundbeef93', name: 'Ground beef (93% lean)', icon: '🥩', serving: '4 oz (113g)', cal: 172, sat: 3, sug: 0, asug: 0, pro: 23, fib: 0, tags: 'protein' },
    { id: 'groundbeef80', name: 'Ground beef (80% lean)', icon: '🥩', serving: '4 oz (113g)', cal: 287, sat: 8.1, sug: 0, asug: 0, pro: 19, fib: 0, tags: 'protein' },
    { id: 'ribeye', name: 'Ribeye steak', icon: '🥩', serving: '4 oz (113g)', cal: 291, sat: 10, sug: 0, asug: 0, pro: 24, fib: 0, tags: 'protein' },
    { id: 'porktenderloin', name: 'Pork tenderloin (roasted)', icon: '🥩', serving: '4 oz (113g)', cal: 158, sat: 1.2, sug: 0, asug: 0, pro: 30, fib: 0, tags: 'protein' },
    { id: 'porkchop', name: 'Pork chop', icon: '🥩', serving: '4 oz (113g)', cal: 232, sat: 3.4, sug: 0, asug: 0, pro: 29, fib: 0, tags: 'protein' },
    { id: 'bacon', name: 'Bacon', icon: '🥓', serving: '2 slices (16g)', cal: 86, sat: 2.6, sug: 0, asug: 0, pro: 6, fib: 0, tags: 'protein' },
    { id: 'sausage', name: 'Breakfast sausage', icon: '🌭', serving: '2 links (48g)', cal: 150, sat: 4.5, sug: 0.5, asug: 0, pro: 8, fib: 0, tags: 'protein' },
    { id: 'ham', name: 'Ham (deli)', icon: '🍖', serving: '2 oz (56g)', cal: 73, sat: 0.9, sug: 1.5, asug: 0, pro: 10, fib: 0, tags: 'protein' },
    { id: 'hotdog', name: 'Hot dog', icon: '🌭', serving: '1 frank (57g)', cal: 186, sat: 6.1, sug: 1, asug: 0, pro: 6.4, fib: 0, tags: 'protein' },
    { id: 'salmon', name: 'Salmon (baked)', icon: '🐟', serving: '4 oz (113g)', cal: 233, sat: 2.1, sug: 0, asug: 0, pro: 25, fib: 0, tags: 'protein' },
    { id: 'cod', name: 'Cod (baked)', icon: '🐟', serving: '4 oz (113g)', cal: 96, sat: 0.2, sug: 0, asug: 0, pro: 21, fib: 0, tags: 'protein' },
    { id: 'tilapia', name: 'Tilapia (baked)', icon: '🐟', serving: '4 oz (113g)', cal: 145, sat: 1, sug: 0, asug: 0, pro: 30, fib: 0, tags: 'protein' },
    { id: 'shrimp', name: 'Shrimp (steamed)', icon: '🦐', serving: '4 oz (113g)', cal: 112, sat: 0.1, sug: 0, asug: 0, pro: 23, fib: 0, tags: 'protein' },
    { id: 'tuna', name: 'Tuna (canned in water)', icon: '🐟', serving: '1 can (142g)', cal: 100, sat: 0.2, sug: 0, asug: 0, pro: 22, fib: 0, tags: 'protein' },
    { id: 'tunasalad', name: 'Tuna salad (with mayo)', icon: '🐟', serving: '1/2 cup (102g)', cal: 192, sat: 2.4, sug: 0, asug: 0, pro: 16, fib: 0, tags: 'protein' },
    { id: 'fishsticks', name: 'Fish sticks', icon: '🐟', serving: '5 pieces (100g)', cal: 250, sat: 3.5, sug: 1, asug: 0, pro: 12, fib: 1, tags: 'protein' },
    { id: 'crab', name: 'Crab meat', icon: '🦀', serving: '4 oz (113g)', cal: 98, sat: 0.2, sug: 0, asug: 0, pro: 20, fib: 0, tags: 'protein' },
    { id: 'tofu', name: 'Tofu (firm)', icon: '⬜', serving: '1/2 cup (126g)', cal: 94, sat: 0.7, sug: 0.4, asug: 0, pro: 10, fib: 0.4, tags: 'protein' },
    { id: 'tempeh', name: 'Tempeh', icon: '⬜', serving: '3 oz (85g)', cal: 162, sat: 2, sug: 0, asug: 0, pro: 17, fib: 0, tags: 'protein' },
    { id: 'blackbeans', name: 'Black beans (cooked)', icon: '🫘', serving: '1/2 cup (86g)', cal: 114, sat: 0.1, sug: 0.3, asug: 0, pro: 7.6, fib: 7.5, tags: 'legume' },
    { id: 'chickpeas', name: 'Chickpeas (cooked)', icon: '🫘', serving: '1/2 cup (82g)', cal: 134, sat: 0.2, sug: 3.9, asug: 0, pro: 7.3, fib: 6.2, tags: 'legume' },
    { id: 'lentils', name: 'Lentils (cooked)', icon: '🫘', serving: '1/2 cup (99g)', cal: 115, sat: 0.1, sug: 1.8, asug: 0, pro: 9, fib: 7.8, tags: 'legume' },
    { id: 'kidneybeans', name: 'Kidney beans (cooked)', icon: '🫘', serving: '1/2 cup (89g)', cal: 112, sat: 0.1, sug: 0.3, asug: 0, pro: 7.7, fib: 5.7, tags: 'legume' },
    { id: 'pintobeans', name: 'Pinto beans (cooked)', icon: '🫘', serving: '1/2 cup (86g)', cal: 123, sat: 0.1, sug: 0.3, asug: 0, pro: 7.7, fib: 7.7, tags: 'legume' },
    { id: 'edamame', name: 'Edamame (shelled)', icon: '🫛', serving: '1/2 cup (78g)', cal: 94, sat: 0.6, sug: 1.2, asug: 0, pro: 9.2, fib: 4, tags: 'legume' },
    { id: 'refriedbeans', name: 'Refried beans', icon: '🫘', serving: '1/2 cup (120g)', cal: 110, sat: 0.9, sug: 0.5, asug: 0, pro: 6.5, fib: 4.5, tags: 'legume' },
    { id: 'hummus', name: 'Hummus', icon: '🫘', serving: '2 tbsp (30g)', cal: 70, sat: 0.7, sug: 0.3, asug: 0, pro: 2, fib: 1.5, tags: 'legume' },
    { id: 'wheatbread', name: 'Whole wheat bread', icon: '🍞', serving: '1 slice (43g)', cal: 80, sat: 0.2, sug: 4, asug: 3, pro: 5, fib: 3, tags: 'grain' },
    { id: 'whitebread', name: 'White bread', icon: '🍞', serving: '1 slice (25g)', cal: 75, sat: 0.2, sug: 1.5, asug: 1.5, pro: 2.6, fib: 0.8, tags: 'grain' },
    { id: 'sourdough', name: 'Sourdough bread', icon: '🍞', serving: '1 slice (36g)', cal: 93, sat: 0.2, sug: 0.8, asug: 0, pro: 3.6, fib: 0.8, tags: 'grain' },
    { id: 'bagel', name: 'Bagel (plain)', icon: '🥯', serving: '1 medium (98g)', cal: 270, sat: 0.4, sug: 5, asug: 3, pro: 11, fib: 2.3, tags: 'grain' },
    { id: 'englishmuffin', name: 'English muffin', icon: '🥯', serving: '1 muffin (57g)', cal: 134, sat: 0.2, sug: 1.6, asug: 1, pro: 4.4, fib: 2, tags: 'grain' },
    { id: 'tortilla', name: 'Flour tortilla (8-inch)', icon: '🫓', serving: '1 tortilla (49g)', cal: 140, sat: 1, sug: 1, asug: 1, pro: 4, fib: 1, tags: 'grain' },
    { id: 'corntortilla', name: 'Corn tortilla', icon: '🫓', serving: '2 small (52g)', cal: 104, sat: 0.3, sug: 0.4, asug: 0, pro: 2.7, fib: 2.9, tags: 'grain' },
    { id: 'brownrice', name: 'Brown rice (cooked)', icon: '🍚', serving: '1 cup (195g)', cal: 216, sat: 0.4, sug: 0.7, asug: 0, pro: 5, fib: 3.5, tags: 'grain' },
    { id: 'whiterice', name: 'White rice (cooked)', icon: '🍚', serving: '1 cup (158g)', cal: 205, sat: 0.1, sug: 0.1, asug: 0, pro: 4.3, fib: 0.6, tags: 'grain' },
    { id: 'pasta', name: 'Pasta (cooked)', icon: '🍝', serving: '1 cup (140g)', cal: 220, sat: 0.2, sug: 0.8, asug: 0, pro: 8.1, fib: 2.5, tags: 'grain' },
    { id: 'quinoa', name: 'Quinoa (cooked)', icon: '🌾', serving: '1 cup (185g)', cal: 222, sat: 0.6, sug: 1.6, asug: 0, pro: 8.1, fib: 5.2, tags: 'grain' },
    { id: 'couscous', name: 'Couscous (cooked)', icon: '🌾', serving: '1 cup (157g)', cal: 176, sat: 0.1, sug: 0.2, asug: 0, pro: 6, fib: 2.2, tags: 'grain' },
    { id: 'cereal', name: 'Breakfast cereal (average)', icon: '🥣', serving: '1 cup (40g)', cal: 150, sat: 0.5, sug: 10, asug: 9, pro: 3, fib: 3, tags: 'grain' },
    { id: 'granola', name: 'Granola', icon: '🥣', serving: '1/2 cup (61g)', cal: 298, sat: 3.2, sug: 14, asug: 10, pro: 9, fib: 5.5, tags: 'grain' },
    { id: 'granolabar', name: 'Granola bar (oats & honey)', icon: '🍫', serving: '1 bar (42g)', cal: 190, sat: 1.5, sug: 12, asug: 11, pro: 3, fib: 2, tags: 'snack' },
    { id: 'pancakes', name: 'Pancakes', icon: '🥞', serving: '2 medium (77g)', cal: 175, sat: 1.4, sug: 5, asug: 3, pro: 5, fib: 1, tags: 'grain' },
    { id: 'waffle', name: 'Waffle', icon: '🧇', serving: '1 waffle (75g)', cal: 218, sat: 3.4, sug: 4, asug: 3, pro: 6, fib: 1.5, tags: 'grain' },
    { id: 'croissant', name: 'Croissant', icon: '🥐', serving: '1 medium (57g)', cal: 231, sat: 7, sug: 6, asug: 5, pro: 4.7, fib: 1.5, tags: 'grain' },
    { id: 'muffin', name: 'Blueberry muffin', icon: '🧁', serving: '1 medium (113g)', cal: 426, sat: 5, sug: 38, asug: 30, pro: 6, fib: 2, tags: 'sweet' },
    { id: 'donut', name: 'Glazed donut', icon: '🍩', serving: '1 donut (60g)', cal: 260, sat: 5, sug: 12, asug: 11, pro: 3, fib: 1, tags: 'sweet' },
    { id: 'almonds', name: 'Almonds', icon: '🥜', serving: '1 oz (28g)', cal: 164, sat: 1.1, sug: 1.2, asug: 0, pro: 6, fib: 3.5, tags: 'fat' },
    { id: 'walnuts', name: 'Walnuts', icon: '🥜', serving: '1 oz (28g)', cal: 185, sat: 1.7, sug: 0.7, asug: 0, pro: 4.3, fib: 1.9, tags: 'fat' },
    { id: 'cashews', name: 'Cashews', icon: '🥜', serving: '1 oz (28g)', cal: 157, sat: 2.7, sug: 1.7, asug: 0, pro: 5.2, fib: 0.9, tags: 'fat' },
    { id: 'peanutbutter', name: 'Peanut butter', icon: '🥜', serving: '2 tbsp (32g)', cal: 188, sat: 3.1, sug: 3.4, asug: 2, pro: 8, fib: 1.9, tags: 'fat' },
    { id: 'almondbutter', name: 'Almond butter', icon: '🥜', serving: '2 tbsp (32g)', cal: 196, sat: 1.4, sug: 1.4, asug: 0, pro: 6.7, fib: 3.3, tags: 'fat' },
    { id: 'oliveoil', name: 'Olive oil', icon: '🫒', serving: '1 tbsp (14g)', cal: 119, sat: 1.9, sug: 0, asug: 0, pro: 0, fib: 0, tags: 'fat' },
    { id: 'avocado', name: 'Avocado', icon: '🥑', serving: '1/2 fruit (100g)', cal: 160, sat: 2.1, sug: 0.7, asug: 0, pro: 2, fib: 6.7, tags: 'fat' },
    { id: 'guacamole', name: 'Guacamole', icon: '🥑', serving: '2 tbsp (30g)', cal: 50, sat: 0.7, sug: 0.3, asug: 0, pro: 0.7, fib: 2, tags: 'fat' },
    { id: 'mayo', name: 'Mayonnaise', icon: '🥣', serving: '1 tbsp (14g)', cal: 94, sat: 1.6, sug: 0.1, asug: 0, pro: 0.1, fib: 0, tags: 'fat' },
    { id: 'ranch', name: 'Ranch dressing', icon: '🥣', serving: '2 tbsp (30g)', cal: 129, sat: 2.2, sug: 1.4, asug: 1, pro: 0.4, fib: 0, tags: 'fat' },
    { id: 'vinaigrette', name: 'Balsamic vinaigrette', icon: '🥣', serving: '2 tbsp (32g)', cal: 90, sat: 1, sug: 3, asug: 2, pro: 0, fib: 0, tags: 'fat' },
    { id: 'potatochips', name: 'Potato chips', icon: '🥔', serving: '1 oz (28g)', cal: 152, sat: 1.4, sug: 0.2, asug: 0, pro: 1.8, fib: 1.4, tags: 'snack' },
    { id: 'tortillachips', name: 'Tortilla chips', icon: '🌽', serving: '1 oz (28g)', cal: 140, sat: 1.4, sug: 0.2, asug: 0, pro: 2, fib: 1.5, tags: 'snack' },
    { id: 'pretzels', name: 'Pretzels', icon: '🥨', serving: '1 oz (28g)', cal: 108, sat: 0.2, sug: 0.9, asug: 0, pro: 2.9, fib: 1, tags: 'snack' },
    { id: 'crackers', name: 'Crackers', icon: '🍘', serving: '6 crackers (18g)', cal: 80, sat: 1, sug: 0.8, asug: 0, pro: 1.2, fib: 0.5, tags: 'snack' },
    { id: 'chocolatebar', name: 'Milk chocolate bar', icon: '🍫', serving: '1 bar (43g)', cal: 235, sat: 8, sug: 24, asug: 23, pro: 3.4, fib: 1.4, tags: 'sweet' },
    { id: 'cookie', name: 'Chocolate chip cookie', icon: '🍪', serving: '1 cookie (30g)', cal: 148, sat: 3.5, sug: 10, asug: 9, pro: 1.5, fib: 0.7, tags: 'sweet' },
    { id: 'brownie', name: 'Brownie', icon: '🍫', serving: '1 square (56g)', cal: 227, sat: 3.5, sug: 20, asug: 19, pro: 2.7, fib: 1.2, tags: 'sweet' },
    { id: 'fries', name: 'French fries', icon: '🍟', serving: 'small (85g)', cal: 222, sat: 1.6, sug: 0.3, asug: 0, pro: 2.4, fib: 2.1, tags: 'snack' },
    { id: 'driedcranberries', name: 'Dried cranberries (sweetened)', icon: '🍒', serving: '1/4 cup (40g)', cal: 123, sat: 0, sug: 29, asug: 26, pro: 0, fib: 2.3, tags: 'sweet' },
    { id: 'trailmix', name: 'Trail mix', icon: '🥜', serving: '1/4 cup (37g)', cal: 173, sat: 2.2, sug: 11, asug: 7, pro: 5.1, fib: 2.4, tags: 'snack' },
    { id: 'proteinbar', name: 'Protein bar', icon: '🍫', serving: '1 bar (60g)', cal: 220, sat: 3, sug: 15, asug: 12, pro: 20, fib: 5, tags: 'snack' },
    { id: 'ricecake', name: 'Rice cake', icon: '🍘', serving: '1 cake (9g)', cal: 35, sat: 0, sug: 0.1, asug: 0, pro: 0.7, fib: 0.4, tags: 'snack' },
    { id: 'coffee', name: 'Black coffee', icon: '☕', serving: '1 cup (240g)', cal: 2, sat: 0, sug: 0, asug: 0, pro: 0.3, fib: 0, tags: 'drink' },
    { id: 'tea', name: 'Unsweetened tea', icon: '🍵', serving: '1 cup (240g)', cal: 2, sat: 0, sug: 0, asug: 0, pro: 0, fib: 0, tags: 'drink' },
    { id: 'latte', name: 'Latte (2% milk)', icon: '☕', serving: '12 oz (360g)', cal: 150, sat: 4, sug: 13, asug: null, pro: 10, fib: 0, tags: 'drink' },
    { id: 'oj', name: 'Orange juice', icon: '🧃', serving: '1 cup (248g)', cal: 112, sat: 0, sug: 21, asug: null, pro: 1.7, fib: 0.5, tags: 'drink' },
    { id: 'applejuice', name: 'Apple juice', icon: '🧃', serving: '1 cup (248g)', cal: 114, sat: 0, sug: 24, asug: null, pro: 0.2, fib: 0.5, tags: 'drink' },
    { id: 'soda', name: 'Regular soda', icon: '🥤', serving: '12 oz (368g)', cal: 140, sat: 0, sug: 39, asug: 39, pro: 0, fib: 0, tags: 'drink' },
    { id: 'dietsoda', name: 'Diet soda', icon: '🥤', serving: '12 oz (355g)', cal: 0, sat: 0, sug: 0, asug: 0, pro: 0, fib: 0, tags: 'drink' },
    { id: 'beer', name: 'Beer (regular)', icon: '🍺', serving: '12 oz (356g)', cal: 153, sat: 0, sug: 0, asug: 0, pro: 1.6, fib: 0, tags: 'drink' },
    { id: 'lightbeer', name: 'Light beer', icon: '🍺', serving: '12 oz (354g)', cal: 103, sat: 0, sug: 0.3, asug: 0, pro: 0.9, fib: 0, tags: 'drink' },
    { id: 'wine', name: 'Red wine', icon: '🍷', serving: '5 oz (147g)', cal: 125, sat: 0, sug: 0.9, asug: 0, pro: 0.1, fib: 0, tags: 'drink' },
    { id: 'smoothie', name: 'Fruit smoothie', icon: '🥤', serving: '12 oz (340g)', cal: 220, sat: 0.5, sug: 42, asug: 15, pro: 3, fib: 3, tags: 'drink' },
    { id: 'sportsdrink', name: 'Sports drink', icon: '🥤', serving: '12 oz (360g)', cal: 80, sat: 0, sug: 21, asug: 21, pro: 0, fib: 0, tags: 'drink' },
    { id: 'ketchup', name: 'Ketchup', icon: '🍅', serving: '1 tbsp (17g)', cal: 19, sat: 0, sug: 3.7, asug: 3, pro: 0.2, fib: 0.1, tags: 'condiment' },
    { id: 'mustard', name: 'Mustard', icon: '🌭', serving: '1 tsp (5g)', cal: 3, sat: 0, sug: 0.1, asug: 0, pro: 0.2, fib: 0.1, tags: 'condiment' },
    { id: 'bbqsauce', name: 'BBQ sauce', icon: '🍖', serving: '2 tbsp (35g)', cal: 58, sat: 0, sug: 11, asug: 10, pro: 0.3, fib: 0.3, tags: 'condiment' },
    { id: 'soysauce', name: 'Soy sauce', icon: '🍶', serving: '1 tbsp (16g)', cal: 9, sat: 0, sug: 0.1, asug: 0, pro: 1.3, fib: 0.1, tags: 'condiment' },
    { id: 'hotsauce', name: 'Hot sauce', icon: '🌶️', serving: '1 tsp (5g)', cal: 1, sat: 0, sug: 0, asug: 0, pro: 0, fib: 0, tags: 'condiment' },
    { id: 'honey', name: 'Honey', icon: '🍯', serving: '1 tbsp (21g)', cal: 64, sat: 0, sug: 17, asug: 17, pro: 0.1, fib: 0, tags: 'condiment' },
    { id: 'maplesyrup', name: 'Maple syrup', icon: '🍁', serving: '1 tbsp (20g)', cal: 52, sat: 0, sug: 12, asug: 12, pro: 0, fib: 0, tags: 'condiment' },
    { id: 'jam', name: 'Strawberry jam', icon: '🍓', serving: '1 tbsp (20g)', cal: 56, sat: 0, sug: 10, asug: 9, pro: 0.1, fib: 0.2, tags: 'condiment' },
    { id: 'gravy', name: 'Gravy', icon: '🥣', serving: '1/4 cup (60g)', cal: 30, sat: 0.6, sug: 0.6, asug: 0, pro: 0.7, fib: 0, tags: 'condiment' },
    { id: 'pizza', name: 'Pizza (cheese)', icon: '🍕', serving: '1 slice (107g)', cal: 285, sat: 4.8, sug: 3.8, asug: 1, pro: 12, fib: 2.3, tags: 'prepared' },
    { id: 'cheeseburger', name: 'Cheeseburger', icon: '🍔', serving: '1 burger (154g)', cal: 390, sat: 11, sug: 7, asug: 5, pro: 21, fib: 2, tags: 'prepared' },
    { id: 'burrito', name: 'Bean & cheese burrito', icon: '🌯', serving: '1 burrito (198g)', cal: 380, sat: 6, sug: 3, asug: 1, pro: 15, fib: 7, tags: 'prepared' },
    { id: 'sushi', name: 'Sushi roll (California)', icon: '🍣', serving: '6 pieces (170g)', cal: 255, sat: 1, sug: 7, asug: 3, pro: 9, fib: 3.5, tags: 'prepared' },
    { id: 'macandcheese', name: 'Macaroni and cheese', icon: '🧀', serving: '1 cup (198g)', cal: 310, sat: 6, sug: 7, asug: 2, pro: 13, fib: 2, tags: 'prepared' },
    { id: 'chickencaesar', name: 'Chicken caesar salad', icon: '🥗', serving: '1 bowl (300g)', cal: 470, sat: 8, sug: 4, asug: 1, pro: 30, fib: 4, tags: 'prepared' },
    { id: 'chickensoup', name: 'Chicken noodle soup', icon: '🍲', serving: '1 cup (241g)', cal: 75, sat: 0.6, sug: 0.9, asug: 0, pro: 4, fib: 0.7, tags: 'prepared' },
    { id: 'chili', name: 'Beef chili', icon: '🍲', serving: '1 cup (253g)', cal: 287, sat: 5.5, sug: 5, asug: 1, pro: 22, fib: 9, tags: 'prepared' },
    { id: 'padthai', name: 'Pad thai', icon: '🍜', serving: '1 plate (300g)', cal: 600, sat: 5, sug: 20, asug: 10, pro: 25, fib: 4, tags: 'prepared' },
    { id: 'friedrice', name: 'Fried rice', icon: '🍚', serving: '1 cup (198g)', cal: 330, sat: 2.5, sug: 3, asug: 1, pro: 10, fib: 2, tags: 'prepared' },
    { id: 'eggsandwich', name: 'Egg & cheese sandwich', icon: '🥪', serving: '1 sandwich (150g)', cal: 380, sat: 8, sug: 4, asug: 2, pro: 18, fib: 2, tags: 'prepared' },
    { id: 'turkeysandwich', name: 'Turkey sandwich', icon: '🥪', serving: '1 sandwich (200g)', cal: 330, sat: 3, sug: 6, asug: 3, pro: 22, fib: 4, tags: 'prepared' },
    { id: 'caesarwrap', name: 'Chicken wrap', icon: '🌯', serving: '1 wrap (250g)', cal: 510, sat: 7, sug: 5, asug: 2, pro: 28, fib: 4, tags: 'prepared' },
    { id: 'lasagna', name: 'Lasagna', icon: '🍝', serving: '1 piece (250g)', cal: 400, sat: 10, sug: 8, asug: 2, pro: 24, fib: 3, tags: 'prepared' }
  ];

  // ADD_INS — the things that actually get stirred into an otherwise
  // zero-point food (mashed potatoes, roasted veg, scrambled eggs). Points are
  // computed at runtime by the engine, same as any other food, so a plain
  // potato stays 0 and "potato + 1 tsp olive oil" costs exactly the oil.
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
  var STARTER_MEALS = [
    { id: 'starter-chicken-bowl', name: 'Grilled Chicken Power Bowl', icon: '🍗', starter: true,
      components: [ { foodId: 'chickenbreast', qty: 1 }, { foodId: 'potato', qty: 1 }, { foodId: 'broccoli', qty: 1 } ] },
    { id: 'starter-overnight-oats', name: 'Berry Overnight Oats', icon: '🫐', starter: true,
      components: [ { foodId: 'oats', qty: 1 }, { foodId: 'greekyogurt', qty: 1 }, { foodId: 'blueberries', qty: 0.5 }, { foodId: 'honey', qty: 0.5 } ] },
    { id: 'starter-turkey-tacos', name: 'Turkey Taco Night', icon: '🌮', starter: true,
      components: [ { foodId: 'groundturkey', qty: 1 }, { foodId: 'tortilla', qty: 2 }, { foodId: 'cheddar', qty: 0.5 }, { foodId: 'lettuce', qty: 0.5 }, { foodId: 'salsa', qty: 1 } ] },
    { id: 'starter-pb-toast', name: 'PB Banana Toast', icon: '🥪', starter: true,
      components: [ { foodId: 'wheatbread', qty: 2 }, { foodId: 'peanutbutter', qty: 1 }, { foodId: 'banana', qty: 1 } ] }
  ];

  function byId(id) {
    for (var i = 0; i < FOODS.length; i++) if (FOODS[i].id === id) return FOODS[i];
    for (var j = 0; j < ADD_INS.length; j++) if (ADD_INS[j].id === id) return ADD_INS[j];
    return null;
  }

  /**
   * Ranked search. Scores exact > prefix > word-start > substring so that
   * typing "chicken" surfaces "Chicken breast" before "Chicken noodle soup",
   * and short generic names outrank long prepared dishes.
   */
  var STAPLE_TAGS = ['fruit', 'veg', 'starchy', 'protein', 'legume', 'dairy', 'grain'];

  function search(query, limit) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    var terms = q.split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < FOODS.length; i++) {
      var f = FOODS[i];
      var name = f.name.toLowerCase();
      var score = 0, matchedAll = true;
      for (var t = 0; t < terms.length; t++) {
        var term = terms[t], s = 0;
        if (name === term) s = 100;
        else if (name.indexOf(term) === 0) s = 60;
        else if (new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) s = 40;
        else if (name.indexOf(term) !== -1) s = 20;
        else if ((f.tags || '').indexOf(term) !== -1) s = 10;
        if (s === 0) { matchedAll = false; break; }
        score += s;
      }
      if (!matchedAll) continue;
      // Prefer the plain ingredient over a prepared dish that happens to
      // contain the word: searching "chicken" should surface chicken breast,
      // not a chicken caesar wrap.
      // The bonus must outweigh a prefix match, or a snack whose name merely
      // starts with the word wins: "milk" would return Milk chocolate bar
      // ahead of 2% milk, and "potato" would return Potato chips ahead of a
      // baked potato.
      score += (STAPLE_TAGS.indexOf(f.tags) !== -1) ? 30
             : (f.tags === 'prepared') ? -8 : 4;
      // Length tiebreak, ignoring the "(grilled, skinless)" style suffix so a
      // precise name isn't punished for being descriptive.
      score -= name.replace(/\s*\(.*?\)\s*/g, '').length * 0.06;
      out.push({ food: f, score: score });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit || 25).map(function (r) { return r.food; });
  }

  return { FOODS: FOODS, ADD_INS: ADD_INS, STARTER_MEALS: STARTER_MEALS,
    byId: byId, search: search };
});
