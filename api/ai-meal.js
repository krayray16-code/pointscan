export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { mealText, plan } = req.body;
  if (!mealText || typeof mealText !== 'string' || mealText.length > 1000) {
    return res.status(400).json({ error: 'Invalid meal text' });
  }
  const diabetic = plan === 'diabetic';

  // NOTE: WW's exact Points algorithm is proprietary; the formula below is
  // the closest published approximation. The client re-verifies every item
  // (zero-point status + points) through its own engine, so the numbers the
  // AI returns are advisory — the per-item nutrition estimates are what
  // actually matter.
  const zeroList = diabetic
    ? 'non-starchy vegetables, whole eggs, plain skinless chicken/turkey, lean beef/pork, plain fish/seafood, tofu, tempeh, beans, lentils. On this DIABETIC plan, fruit, corn, potatoes, starchy vegetables, oats, yogurt and cottage cheese are NOT zero.'
    : 'whole fruits, non-starchy vegetables, whole eggs, plain skinless chicken/turkey (incl. skinless dark meat), lean beef/pork, plain fish/seafood, plain oats, plain nonfat yogurt (no flavor), plain nonfat cottage cheese, tofu, tempeh, beans, lentils, corn, potatoes, air-popped plain popcorn.';

  const prompt = `You are a nutrition expert. Estimate nutrition and WW Points (2025/2026 program) for this meal.

ZERO POINTS only in PLAIN, WHOLE, UNPROCESSED form: ${zeroList}

NEVER ZERO (processed derivatives): fried/breaded anything, potato chips/fries/hash browns, flavored or low-fat (not nonfat) yogurt, granola/bars, juice, dried fruit, bread, rice, pasta, cheese, butter, oil, nuts, peanut butter, alcohol, cured/deli meats.

Points formula for non-zero foods (published approximation): points = round(max(0, calories*0.0305 + saturated_fat*0.275 + sugar*0.12 - protein*0.098 - fiber*0.098))

Meal: ${mealText.replace(/"/g, "'")}

Respond with ONLY this JSON structure, no other text:
{"mealLabel":"short meal name","totalPoints":5,"items":[{"name":"food item","isZero":false,"calories":100,"protein":10,"saturatedFat":1,"sugar":2,"fiber":0,"points":3,"note":"brief note"}]}`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
          }),
          signal: AbortSignal.timeout(12000)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.log(`${model} failed:`, JSON.stringify(data).substring(0, 200));
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json(parsed);

    } catch (e) {
      console.log(`${model} error:`, e.message);
      continue;
    }
  }

  return res.status(500).json({ error: 'AI estimation failed' });
}
