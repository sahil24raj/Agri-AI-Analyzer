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
    const { imageBase64, mimeType, cropData, location, weather, language = 'en' } = req.body;

    if (!imageBase64 || !mimeType || !cropData) {
      return res.status(400).json({ error: 'imageBase64, mimeType, and cropData are required' });
    }

    const prompt = `You are an Advanced AI Crop Health Assistant designed to solve real-world farmer problems with complete intelligence, not just detection.
Your goal is to Diagnose + Explain + Predict + Guide + Optimize farmer decisions.

INPUT FORMAT:
{
  "crop": "${cropData.crop_type}",
  "disease": "${cropData.disease || 'Unknown'}",
  "confidence": "${cropData.confidence}",
  "affected_area": "${cropData.affected_area || 'Unknown'}",
  "temperature": "${weather?.temp ? weather.temp + '°C' : cropData.temperature}",
  "humidity": "${weather?.humidity ? weather.humidity + '%' : 'Unknown'}",
  "rainfall": "${weather?.rainfall ? weather.rainfall + 'mm' : 'Unknown'}",
  "location": "${location || 'Unknown'}",
  "images_count": "1",
  "previous_health": "None provided. Assume 0% past infection unless stated otherwise."
}

STEP 1: CONFIDENCE & MULTI-IMAGE VALIDATION
- If confidence < 80% -> mention uncertainty
- If images_count < 2 -> suggest uploading multiple images
- If multiple images -> increase reliability

STEP 2: CROP STAGE DETECTION
- Detect: Seedling, Vegetative, Flowering, or Maturity.
- Also state whether issue is normal or abnormal for this stage.

STEP 3: DISEASE & PEST ANALYSIS
- Disease name
- Severity (based on affected_area): 0-20% = Low, 21-50% = Medium, 51-100% = High
- Spread Risk (Low / Medium / High)
- If none: "No major disease detected"

STEP 4: DISEASE PROGRESSION TRACKING
- If previous_health is given: Compare past vs current. Detect increase/decrease. (e.g. "10% -> 25% infection (increasing)").

STEP 5: ROOT CAUSE ANALYSIS (VERY IMPORTANT)
- Explain WHY problem occurred: Weather, Water imbalance, Nutrient deficiency, Pest conditions.

STEP 6: ENVIRONMENT ANALYSIS
- Compare current vs ideal crop conditions: Detect heat stress / cold stress, Humidity imbalance.

STEP 7: SOIL & NUTRIENT ANALYSIS
- Estimate soil type from location. Detect Nitrogen deficiency (yellow), Phosphorus (slow), Potassium (burn).

STEP 8: WATER ANALYSIS
- Detect Underwatering or Overwatering.

STEP 9: IRRIGATION TIMING
- Recommend best time (morning/evening) and reason based on weather.

STEP 10: EARLY WARNING SYSTEM
- Predict upcoming risks: Disease probability, Weather-based alerts.

STEP 11: RISK METER
- Provide Risk Level (Low / Medium / High) and Probability %.

STEP 12: SIMILAR CASE INSIGHT
- Provide what most farmers did in similar cases and common successful solutions.

STEP 13: SEVERITY ACTION PLAN
- Day 1-2: Immediate action
- Day 3-5: Treatment
- Day 7+: Monitoring

STEP 14: RECOVERY TIME PREDICTION
- Estimate days required for recovery.

STEP 15: COST vs BENEFIT ANALYSIS
- Provide Estimated cost and Expected improvement.

STEP 16: SPRAY / FERTILIZER CALCULATOR
- Based on 1 acre (default): Required fertilizer quantity and Spray amount.

STEP 17: ALTERNATIVE SOLUTIONS
- Provide Chemical (fast) and Organic (low cost).

STEP 18: FARM CONDITION SCORE
- Give overall Farm Score (0-100) combining soil + water + environment.

STEP 19: HEALTH SCORE CALCULATION
- Score 0-100 for Leaf, Soil, Water, Environment, Disease Impact.
- Final Score = (Leaf*0.30) + (Soil*0.20) + (Water*0.20) + (Environment*0.15) + (Disease*0.15).

STEP 20: ISSUE IDENTIFICATION
- Clearly list all detected issues.

STEP 21: FINAL OUTPUT FORMAT (STRICT)
Generate a comprehensive JSON report containing EXACTLY these fields reflecting your massively detailed 21-step reasoning:
IMPORTANT INSTRUCTION: Translate all string VALUES inside the JSON into the language code "${language}". Keep the EXACT JSON keys in English. Do NOT use markdown code blocks, just raw JSON.
{
  "crop": "[Crop Name] 🌱",
  "stage": "[Predicted Stage] + (Normal/Abnormal)",
  "health_score": [0-100 number],
  "farm_score": [0-100 number],
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
  "progress": "...",
  "root_cause": "...",
  "analysis": {
    "environment": "...",
    "water": "...",
    "soil": "..."
  },
  "recommendations": ["General tip 1", "General tip 2"],
  "smart_solutions": {
    "organic": ["Organic step 1", "Organic step 2"],
    "chemical": ["Chemical step 1", "Chemical step 2"]
  },
  "irrigation_advice": "...",
  "early_warning": "...",
  "risk_meter": {
    "level": "Low/Medium/High",
    "probability": "...%"
  },
  "similar_case": "...",
  "action_plan": {
    "day_1_2": "...",
    "day_3_5": "...",
    "day_7_plus": "..."
  },
  "recovery_time": "...",
  "cost_benefit": "...",
  "spray_plan": "..."
}

Keep language simple and farmer-friendly in the target language. Be highly detailed. Return ONLY valid JSON.`;

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
