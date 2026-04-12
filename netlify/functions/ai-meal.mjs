export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Try both Netlify env and process.env for compatibility
  const apiKey = (typeof Netlify !== 'undefined' && Netlify.env)
    ? Netlify.env.get('ANTHROPIC_API_KEY')
    : process.env.ANTHROPIC_API_KEY;

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

  const prompt = `You are a nutrition expert who knows WW PersonalPoints 2024-2025.

ZEROPOINT (0 pts): all whole fruits, all vegetables (including potato/corn/peas), whole eggs, skinless chicken/turkey, plain fish/seafood, plain oats, plain nonfat yogurt (NO flavor), plain nonfat cottage cheese, tofu, tempeh, edamame, plain beans/lentils.

NOT ZERO: flavored yogurt, 2% dairy, juice, dried fruit, granola, bread, rice, pasta, cheese, butter, oil, nuts, peanut butter, alcohol, soda.

WW formula (non-zero): pts = round(max(0, cal*0.0305 + sat_fat*0.275 + sugar*0.12 - protein*0.098 - fiber*0.098))

User ate: "${mealText.replace(/"/g, "'")}"

Reply ONLY with JSON, no markdown:
{"mealLabel":"name","totalPoints":0,"items":[{"name":"item","isZero":true,"calories":0,"protein":0,"saturatedFat":0,"sugar":0,"fiber":0,"points":0,"note":""}]}`;

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: 'Anthropic API error', detail: errText }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/ai-meal' };
