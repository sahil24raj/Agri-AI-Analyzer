import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

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
IMPORTANT INSTRUCTION: Translate all string VALUES inside the JSON into the language code "${language}". Keep the JSON EXACT keys in English.
{
  "crop_type": "...",
  "disease": "...",
  "affected_area": "...",
  "soil_type": "...",
  "temperature": "...",
  "confidence": "0-100%"
}

If unsure, give best possible estimation instead of refusing.`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are an advanced Agri-AI assistant. Always respond with valid JSON only, no extra text or markdown.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err?.error?.message || 'Groq API error' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return res.status(200).json(JSON.parse(content));
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
}
