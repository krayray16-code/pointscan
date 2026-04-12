export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

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

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || !mimeType) {
    return new Response(JSON.stringify({ error: 'Missing image data' }), { status: 400 });
  }

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
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              }
            },
            {
              type: 'text',
              text: 'Look at this image and find the barcode (EAN-13, UPC-A, EAN-8, UPC-E, or similar). Return ONLY the numeric barcode digits with no other text, spaces, or explanation. If you cannot find a barcode, return exactly: NONE'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'Vision API error', detail: err }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const text = (data.content?.find(b => b.type === 'text')?.text || '').trim();

    if (!text || text === 'NONE' || text.toLowerCase().includes('none')) {
      return new Response(JSON.stringify({ error: 'No barcode found in image' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clean up — keep only digits
    const barcode = text.replace(/\D/g, '');
    if (barcode.length < 6) {
      return new Response(JSON.stringify({ error: 'No barcode found in image' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ barcode }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Request failed', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/scan-barcode' };
