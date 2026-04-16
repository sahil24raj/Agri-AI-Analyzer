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
    const { fieldImageBase64, fieldImageMimeType, language = 'en' } = req.body;

    if (!fieldImageBase64 || !fieldImageMimeType) {
      return res.status(400).json({ error: 'fieldImageBase64 and fieldImageMimeType are required' });
    }

    const prompt = `You are an Advanced Precision Farming AI. Your task is to analyze a wide-field view of a farm/crop area.

FIELD IMAGE ANALYSIS & PRECISION FARMING:
- Generate a 3x3 Minimap grid representing the farm. Use 🟩 for healthy zones and 🟥 for infected/damaged zones based on visual field patterns in the image.
- Decide if "Spot Treatment" is possible (e.g., only spraying 🟥 zones to save cost) vs "Full Field" treatment.
- Estimate % of chemical/money saved.

FINAL OUTPUT FORMAT (STRICT)
Generate a comprehensive JSON report containing EXACTLY these fields:

CRITICAL LANGUAGE RULE: 
You MUST entirely translate ALL string VALUES inside this JSON into the language code "${language}". This is fully mandatory!
DO NOT use English for values if the requested language is not English. ONLY the exact JSON keys must remain in English.

{
  "total_affected_percent": "e.g., 30%",
  "infection_pattern": "e.g., Localized in the North-East",
  "risk_level": "e.g., Medium Spread Risk",
  "minimap": {
    "grid": [["🟩", "🟩", "🟥"], ["🟩", "🟩", "🟩"], ["🟩", "🟩", "🟩"]],
    "location_desc": "Infection localized to top right corner"
  },
  "spot_treatment": {
    "is_spot_treatment": true,
    "cost_saved_percent": "35%",
    "money_saved_per_acre": "$40",
    "instruction": "Only spray the upper right sector...",
    "reason": "Because infection has not spread to left or bottom..."
  }
}

Keep language simple and farmer-friendly in the target language. Be highly detailed. Return ONLY valid JSON.`;

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
                  mime_type: fieldImageMimeType,
                  data: fieldImageBase64,
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
