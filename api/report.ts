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
    const { 
      imageBase64, 
      mimeType, 
      cropData, 
      location, 
      weather, 
      language = 'en' 
    } = req.body;

    if (!imageBase64 || !mimeType || !cropData) {
      return res.status(400).json({ error: 'Required data missing' });
    }

    const weatherContext = weather 
      ? `Current Weather: Temp ${weather.temp}°C, Humidity ${weather.humidity}%, Rainfall ${weather.rainfall}mm.`
      : 'Weather data not available.';

    const prompt = `You are a world-class agricultural scientist and plant pathologist. 
The user has provided a photo of a crop and confirmed/edited initial analysis data.

USER CONTEXT:
- Location/Environment: ${location || 'Unknown'}
- ${weatherContext}

CONFIRMED INITIAL ANALYSIS:
- Crop Type: ${cropData.crop_type}
- Soil: ${cropData.soil_type}
- Temp: ${cropData.temperature}
- Disease Detected: ${cropData.disease}
- Affected Area: ${cropData.affected_area}

YOUR TASK:
Provide a 14-step granular health report. Analyze leaf symptoms, nutrient deficiencies, and environmental stressors based on the visual and textual data.

FINAL OUTPUT FORMAT (STRICT):
Generate a comprehensive JSON report containing EXACTLY these fields:

CRITICAL LANGUAGE RULE: 
You MUST entirely translate ALL string VALUES inside this JSON into the language code "${language}". This is fully mandatory!
Even if the examples below are in English, the final output VALUES must be completely in the "${language}" language. 
DO NOT use English for values if the requested language is not English. ONLY the exact JSON keys must remain in English.

{
  "crop": "Crop Name",
  "stage": "Probable growth stage",
  "health_score": 0-100,
  "farm_score": 0-100 (based on management quality),
  "metrics": {
    "leaf_health": 0-100,
    "soil_health": 0-100,
    "water_score": 0-100,
    "environment_score": 0-100,
    "disease_impact": 0-100
  },
  "issues_detected": ["List of visual issues"],
  "disease_pest": {
    "name": "Correct ID",
    "severity": "High/Med/Low",
    "spread_risk": "High/Med/Low"
  },
  "progress": "Treatment progress or deterioration timeline",
  "risk_meter": {
    "level": "Critical/Warning/Safe",
    "probability": "0-100%"
  },
  "early_warning": "Prediction of what might happen next week",
  "root_cause": "Deep scientific reason for the health status",
  "analysis": {
    "environment": "...",
    "water": "...",
    "soil": "..."
  },
  "smart_solutions": {
    "organic": ["Step-by-step organic remedies"],
    "chemical": ["Exact chemical solutions with dosage"]
  },
  "recommendations": ["General farming advice"],
  "recovery_time": "Estimated days to health",
  "cost_benefit": "Financial impact prediction",
  "spray_plan": "Precision spray instructions per acre",
  "irrigation_advice": "When and how much water",
  "similar_case": "Reference case insight",
  "action_plan": {
    "day_1_2": "Critical immediate actions",
    "day_3_5": "Follow-up treatment",
    "day_7_plus": "Maintenance and monitoring"
  }
}

Keep language simple but scientifically accurate. Return ONLY valid JSON.`;

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
