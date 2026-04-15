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
    const { imageBase64, mimeType, cropData, location, weather } = req.body;

    if (!imageBase64 || !mimeType || !cropData) {
      return res.status(400).json({ error: 'imageBase64, mimeType, and cropData are required' });
    }

    const prompt = `You are an AI-powered Advanced Crop Health Analysis System.
Your task is to intelligently combine all inputs and generate a complete Crop Health Report with reasoning.

INPUT FORMAT:
{
  "crop": "${cropData.crop_type}",
  "disease": "${cropData.disease || 'Unknown'}",
  "confidence": "${cropData.confidence}",
  "affected_area": "${cropData.affected_area || 'Unknown'}",
  "temperature": "${weather?.temp ? weather.temp + '°C' : cropData.temperature}",
  "humidity": "${weather?.humidity ? weather.humidity + '%' : 'Unknown'}",
  "rainfall": "${weather?.rainfall ? weather.rainfall + 'mm' : 'Unknown'}",
  "location": "${location || 'Unknown'}"
}

STEP 1: VALIDATE & ENHANCE IMAGE ANALYSIS
- Confirm crop type (if confidence < 80%, mention uncertainty)
- Analyze severity based on affected_area: 0-20% = Low, 21-50% = Medium, 51-100% = High

STEP 2: ENVIRONMENT ANALYSIS
- Compare temperature, humidity, rainfall with ideal crop conditions
- Detect: Heat stress, Cold stress, Excess humidity / dryness

STEP 3: SOIL & NUTRIENT ANALYSIS
- Estimate soil type based on location if not given
- Predict nutrient deficiencies using: Disease + crop + visual symptoms. Focus on Nitrogen (yellow leaves), Phosphorus (slow growth), Potassium (leaf edge burn)

STEP 4: WATER ANALYSIS
- Use rainfall + temperature: Low rainfall + high temp = Underwatering, High rainfall = Overwatering risk

STEP 5: DISEASE & PEST ANALYSIS
- Provide: Disease name, Severity (Low/Medium/High), Spread risk (Low/Medium/High)
- If no disease: Mention "No major disease detected"

STEP 6: HEALTH SCORE CALCULATION
- Calculate scores (0-100):
  Leaf Health Score (based on affected_area)
  Soil Health Score (based on deficiency)
  Water Score (based on balance)
  Environment Score (based on conditions)
  Disease Impact Score (inverse of severity)
- Then compute Final Health Score = (Leaf * 0.30) + (Soil * 0.20) + (Water * 0.20) + (Environment * 0.15) + (Disease * 0.15)

STEP 7: ISSUE IDENTIFICATION
- List all detected issues clearly (Nutrient deficiency, Stress, Disease/pest)

STEP 8: SMART RECOMMENDATIONS
- Provide: Organic (gharelu) solutions, Fertilizers (specific names like urea, NPK), Irrigation advice, Pest control (neem oil etc.), Preventive steps. Keep simple and practical.

STEP 9: FINAL OUTPUT FORMAT (STRICT)
Generate a comprehensive JSON report containing EXACTLY these fields reflecting your 9-step reasoning:
{
  "crop": "[Name] 🌱",
  "health_score": [0-100 number],
  "metrics": {
    "leaf_health": [0-100 number],
    "soil_health": [0-100 number],
    "water_score": [0-100 number],
    "environment_score": [0-100 number],
    "disease_impact": [0-100 number]
  },
  "issues_detected": ["issue 1", "issue 2"],
  "disease_pest": {
    "name": "...",
    "severity": "...",
    "spread_risk": "..."
  },
  "analysis": {
    "environment": "Short comparison text...",
    "water": "Status + reason text...",
    "soil": "Type + deficiencies text..."
  },
  "recommendations": [
    "📝 Organic: ...",
    "🧪 Fertilizer: ...",
    "💧 Irrigation: ...",
    "🛡️ Pest Control: ...",
    "🛑 Preventive: ..."
  ]
}

Keep language simple and farmer-friendly. Do not hallucinate unknown diseases. Return ONLY valid JSON.`;

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
        max_tokens: 2048,
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
