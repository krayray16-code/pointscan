// Barcode reader from photo — uses Google Gemini Vision (free tier)
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64
                }
              },
              {
                text: 'Find the barcode in this image. Return ONLY the barcode digits with no spaces, dashes, letters or explanation. Example: 049000028911\n\nIf no barcode is visible, return exactly: NONE'
              }
            ]
          }],
          generationConfig: { maxOutputTokens: 50, temperature: 0 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'Gemini API error', detail: err }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    console.log('Gemini barcode response:', rawText);

    if (!rawText || rawText.toUpperCase() === 'NONE') {
      return new Response(JSON.stringify({ error: 'No barcode found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    const barcode = rawText.replace(/\D/g, '');

    if (barcode.length < 6) {
      return new Response(JSON.stringify({ error: 'No valid barcode found', raw: rawText }), {
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
