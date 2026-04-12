export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
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
  if (!mealText || typeof mealText !== 'string' || mealText.length > 500) {
    return new Response(JSON.stringify({ error: 'Invalid meal text' }), { status: 400 });
  }

  const prompt = `You are a nutrition expert who knows the WW (Weight Watchers) PersonalPoints system for 2024-2025.

ZEROPOINT FOODS (always 0 pts):
- ALL whole fruits (fresh/frozen, NO added sugar — juice/dried fruit NOT zero)
- ALL vegetables including potatoes, sweet potatoes, corn, peas
- Whole eggs (any style)
- Skinless chicken/turkey breast and thighs (plain, not breaded/fried)
- All plain fish and seafood (not breaded/fried)
- Plain rolled oats / steel-cut oats (NOT flavored packets or granola)
- ONLY plain nonfat/fat-free yogurt with no added sugar (Chobani fruit = NOT zero)
- ONLY plain nonfat cottage cheese
- Tofu, tempeh, edamame, all plain beans/lentils/chickpeas

NOT ZERO: flavored yogurt, 2% dairy, juice, dried fruit, granola, bread, rice, pasta, cheese, butter, oil, nuts, peanut butter, alcohol.

WW formula for non-zero: Points = (cal×0.0305)+(sat_fat×0.275)+(sugar×0.12)-(protein×0.098)-(fiber×0.098). Min 0, round to int.

User ate: "${mealText.replace(/"/g, "'")}"

Return ONLY valid JSON:
{"mealLabel":"short name","totalPoints":number,"items":[{"name":"item","isZero":boolean,"calories":number,"protein":number,"saturatedFat":number,"sugar":number,"fiber":number,"points":number,"note":"brief"}]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'AI request failed', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = { path: '/api/ai-meal' };
