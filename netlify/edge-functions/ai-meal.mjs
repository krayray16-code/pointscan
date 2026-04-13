export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = (typeof Netlify !== 'undefined' && Netlify.env)
    ? Netlify.env.get('GEMINI_API_KEY')
    : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { mealText } = body;
  if (!mealText || typeof mealText !== 'string' || mealText.length > 1000) {
    return new Response(JSON.stringify({ error: 'Invalid meal text' }), { status: 400 });
  }

  const prompt = `You are a nutrition expert. Calculate WW PersonalPoints for this meal.

ZERO POINTS (always 0): whole fruits, all vegetables including potatoes, whole eggs, plain skinless chicken/turkey, plain fish/seafood, plain oats, plain nonfat yogurt (no flavor), plain nonfat cottage cheese, tofu, tempeh, beans, lentils.

NOT ZERO: flavored yogurt, 2% dairy, juice, dried fruit, granola, bread, rice, pasta, cheese, butter, oil, nuts, peanut butter, alcohol.

WW formula for non-zero foods: points = round(max(0, calories*0.0305 + saturated_fat*0.275 + sugar*0.12 - protein*0.098 - fiber*0.098))

Meal: ${mealText}

Respond with ONLY this JSON structure, no other text:
{"mealLabel":"short meal name","totalPoints":5,"items":[{"name":"food item","isZero":false,"calories":100,"protein":10,"saturatedFat":1,"sugar":2,"fiber":0,"points":3,"note":"brief note"}]}`;

  try {
    // Try gemini-2.0-flash first, fall back to gemini-1.5-flash
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
          })
        });

        const rawBody = await response.text();
        console.log(`${model} status:`, response.status);

        if (!response.ok) {
          lastError = rawBody;
          console.log(`${model} failed:`, rawBody.substring(0, 200));
          continue; // try next model
        }

        const data = JSON.parse(rawBody);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Extract JSON from response — handle markdown code blocks
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = 'No JSON in response: ' + text.substring(0, 100);
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });

      } catch (e) {
        lastError = e.message;
        console.log(`${model} exception:`, e.message);
        continue;
      }
    }

    return new Response(JSON.stringify({ error: 'All models failed', detail: lastError }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Request failed', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/ai-meal' };
