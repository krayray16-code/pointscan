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

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || !mimeType) {
    return new Response(JSON.stringify({ error: 'Missing image data' }), { status: 400 });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: 'Look at this image and find the barcode number. Return ONLY the digits, nothing else. Example output: 049000028911\n\nIf no barcode visible, return: NONE' }
          ]
        }],
        generationConfig: { maxOutputTokens: 50, temperature: 0 }
      })
    });

    const rawBody = await response.text();
    console.log('Gemini scan status:', response.status, rawBody.substring(0, 300));

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Gemini API error', detail: rawBody }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = JSON.parse(rawBody);
    const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    if (!rawText || rawText.toUpperCase() === 'NONE') {
      return new Response(JSON.stringify({ error: 'No barcode found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    const barcode = rawText.replace(/\D/g, '');
    if (barcode.length < 6) {
      return new Response(JSON.stringify({ error: 'No valid barcode', raw: rawText }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ barcode }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('scan-barcode error:', e.message);
    return new Response(JSON.stringify({ error: 'Request failed', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/scan-barcode' };
