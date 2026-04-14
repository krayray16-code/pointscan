export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
                { text: 'Find the barcode in this image. Return ONLY the digits, nothing else. Example: 049000028911\n\nIf no barcode visible, return: NONE' }
              ]
            }],
            generationConfig: { maxOutputTokens: 50, temperature: 0 }
          }),
          signal: AbortSignal.timeout(20000)
        }
      );

      const data = await response.json();
      if (!response.ok) { continue; }

      const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (!rawText || rawText.toUpperCase() === 'NONE') {
        return res.status(404).json({ error: 'No barcode found' });
      }

      const barcode = rawText.replace(/\D/g, '');
      if (barcode.length < 6) {
        return res.status(404).json({ error: 'No valid barcode', raw: rawText });
      }

      return res.status(200).json({ barcode });

    } catch (e) {
      continue;
    }
  }

  return res.status(500).json({ error: 'Scan failed' });
}
