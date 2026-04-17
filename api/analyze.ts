import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const { imageBase64, mimeType, location, language = 'en' } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    const prompt = `You are an advanced Agri-AI assistant. Analyze this crop image carefully.
${location ? `The user is located at or near: ${location}. Take this local climate, common soil, and geography into account.` : ''}
Detect and predict:
1. Crop Type (e.g., wheat, rice, maize, tomato, etc.)
2. Disease or Pest Name (if any healthy, write "None")
3. Affected Area (visual percentage of the crop damaged, e.g., "30%". If healthy, write "0%")
4. Soil Type (e.g., sandy, clay, loamy, black soil, etc.)
5. Estimated Temperature Range (in °C based on crop/environment)

Return ONLY valid JSON in this exact format. 
CRITICAL LANGUAGE RULE: 
You MUST entirely translate ALL string VALUES inside this JSON into the language code "${language}". This is fully mandatory!
Even if the examples below are in English, the final output VALUES must be completely in the "${language}" language. 
DO NOT use English for values if the requested language is not English. ONLY the exact JSON keys must remain in English.
{
  "crop_type": "...",
  "disease": "...",
  "affected_area": "...",
  "soil_type": "...",
  "temperature": "...",
  "confidence": "0-100%"
}

If unsure, give best possible estimation instead of refusing. Respond only with JSON.`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err?.error?.message || 'Gemini API error' });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Server-side delay of 3 seconds as requested
    await new Promise(resolve => setTimeout(resolve, 3000));

    return res.status(200).json(JSON.parse(content));
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
}
