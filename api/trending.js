export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Search for the most trending AI art and illustration styles right now in 2025-2026.
Look at platforms like Civitai trending, Twitter/X AI art community, Pixiv rankings, and Reddit r/StableDiffusion.

Return ONLY a valid JSON array with exactly 6 styles. No markdown, no explanation, just the JSON array.
Format:
[
  {
    "name": "畫風名稱（繁體中文，最多8字）",
    "desc": "一行描述（繁體中文，最多20字）",
    "prompt": "detailed English prompt for DALL-E image generation in this style, 3-5 sentences describing visual characteristics, mood, technique, color palette, and rendering quality"
  }
]
Include a mix of Eastern (Korean webtoon, Japanese anime, Chinese ink) and Western (fantasy, concept art, painterly) trending styles.`
            }]
          }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            responseMimeType: 'text/plain',
            temperature: 0.7
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err?.error?.message || 'Gemini API error' });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse Gemini response' });

    const styles = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ styles });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
