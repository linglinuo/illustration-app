export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { base64, mimeType, stylePrompt } = req.body;
  if (!base64 || !stylePrompt) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Step 1: Describe the photo using Gemini Vision
    const describeRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 }
              },
              {
                text: 'Describe this photo in detail for an AI image generator. Focus on: number of people, their approximate ages, hairstyles, clothing colors, poses, expressions, and any notable objects. Be specific and visual. Keep it under 120 words.'
              }
            ]
          }],
          generationConfig: { temperature: 0.4 }
        })
      }
    );

    if (!describeRes.ok) {
      const err = await describeRes.json();
      throw new Error(err?.error?.message || 'Vision API failed');
    }

    const describeData = await describeRes.json();
    const description = describeData?.candidates?.[0]?.content?.parts?.[0]?.text
      || 'group of people smiling and posing together';

    // Step 2: Generate illustration using Gemini Imagen
    const fullPrompt = `${stylePrompt}\n\nSubject to illustrate: ${description}`;

    const generateRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 0.8
          }
        })
      }
    );

    if (!generateRes.ok) {
      const err = await generateRes.json();
      throw new Error(err?.error?.message || 'Image generation failed');
    }

    const generateData = await generateRes.json();

    // Extract image from response
    const parts = generateData?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart) throw new Error('No image returned from Gemini');

    return res.status(200).json({
      imageBase64: imagePart.inlineData.data,
      imageMimeType: imagePart.inlineData.mimeType
    });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
