import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  const MODELS = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ];

  try {
    const {
      imageBase64,
      mimeType,
      cropData,
      location,
      weather,
      language = 'en',
    } = req.body;

    if (!imageBase64 || !mimeType || !cropData) {
      return res.status(400).json({ error: 'Required data missing' });
    }

    const weatherContext = weather
      ? `Temperature: ${weather.temp}°C | Humidity: ${weather.humidity}% | Rainfall: ${weather.rainfall}mm`
      : 'Weather data unavailable — use best estimate based on region and crop stress signals.';

    const prompt = `You are a world-class agricultural scientist, plant pathologist, and agronomist with expertise in Indian farming systems.
The farmer has submitted a crop image with confirmed field data. Perform the most comprehensive, expert-level crop health analysis possible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FARM CONTEXT PROVIDED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Location: ${location || 'Unknown — estimate from visual cues'}
• Weather: ${weatherContext}
• Crop Type: ${cropData.crop_type}
• Soil Type: ${cropData.soil_type}
• Temperature: ${cropData.temperature}
• Disease Detected: ${cropData.disease}
• Affected Area: ${cropData.affected_area}
• Growth Stage: ${cropData.growth_stage || 'Unknown'}
• Nutrient Issues: ${cropData.nutrient_issues?.join(', ') || 'Not specified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR EXPERT ANALYSIS TASK (20+ data points):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. DISEASE DEEP DIVE — Full pathogen lifecycle, spread vectors, and infection mechanism.
2. SYMPTOM BREAKDOWN — Classify every visible symptom (leaf, stem, root, fruit).
3. NUTRIENT PANEL — Soil nutrient status (N, P, K, Ca, Mg, Fe, Mn, Zn, B) and recommended corrections.
4. HEALTH SCORING — Score per category out of 100.
5. WEATHER IMPACT ANALYSIS — How current temp/humidity/rainfall accelerates or slows disease.
6. YIELD LOSS PREDICTION — Estimated yield loss % if untreated for 7 / 14 / 30 days.
7. ORGANIC REMEDIES — Specific organic treatments with dilution ratios and timing.
8. CHEMICAL TREATMENT — Product name, active ingredient, dosage per acre, frequency, safety precautions.
9. BIOLOGICAL CONTROL — Beneficial microorganisms or bioagents (e.g., Trichoderma, Pseudomonas).
10. SPRAY SCHEDULE — Full calendar (Day 1, Day 3, Day 7, Day 14) with timing (morning/evening) and weather conditions.
11. IRRIGATION GUIDE — Exact schedule: method (drip/flood/sprinkler), quantity (liters/acre/day), and critical stages to avoid overwatering.
12. SOIL AMENDMENT — Compost, lime, gypsum, biofertilizer recommendations with quantities.
13. COMPANION PLANTING — Suggest 2-3 companion plants to repel pests or enrich soil.
14. HARVEST READINESS — Days to harvest under current conditions vs optimal conditions.
15. POST-HARVEST CARE — Storage tips to protect yield quality.
16. FINANCIAL IMPACT — Estimated revenue loss in INR (₹) per acre at current damage vs potential after treatment.
17. MARKET PRICE OUTLOOK — Expected mandi price per quintal for this crop in current season.
18. RISK PROPAGATION — Will this disease spread to neighboring crops? How fast?
19. EARLY WARNING SIGNALS — What symptoms to watch for in the next 5-7 days.
20. SIMILAR CASE STUDY — Reference a real documented case from India/South Asia with outcome.
21. FARMER CHECKLIST — 5 immediate action items the farmer must do today.
22. LONG-TERM PREVENTION — Season-level prevention strategy (rotation, resistant varieties, soil health).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL LANGUAGE RULE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Translate ALL string VALUES into language code: "${language}".
ONLY keep JSON keys in English. Return ONLY valid JSON. No markdown. No extra text.

{
  "crop": "Crop name",
  "scientific_name": "Latin name",
  "stage": "Growth stage",
  "health_score": 0,
  "farm_score": 0,
  "metrics": {
    "leaf_health": 0,
    "stem_health": 0,
    "root_health": 0,
    "soil_health": 0,
    "water_score": 0,
    "environment_score": 0,
    "disease_impact": 0,
    "nutrient_score": 0
  },
  "disease_pest": {
    "name": "Disease/pest name",
    "scientific_name": "Latin name",
    "severity": "High/Medium/Low",
    "spread_risk": "High/Medium/Low",
    "pathogen_type": "Fungal/Bacterial/Viral/Pest/None",
    "infection_mechanism": "How it spreads and infects"
  },
  "visual_symptoms": ["symptom 1", "symptom 2"],
  "nutrient_panel": {
    "nitrogen": "Status and recommendation",
    "phosphorus": "Status and recommendation",
    "potassium": "Status and recommendation",
    "calcium": "Status and recommendation",
    "magnesium": "Status and recommendation",
    "iron": "Status and recommendation",
    "zinc": "Status and recommendation",
    "boron": "Status and recommendation"
  },
  "weather_impact": "How current weather is affecting disease progression",
  "yield_loss_forecast": {
    "if_untreated_7days": "XX%",
    "if_untreated_14days": "XX%",
    "if_untreated_30days": "XX%",
    "with_treatment": "XX%"
  },
  "issues_detected": ["issue 1", "issue 2"],
  "risk_meter": {
    "level": "Critical/Warning/Safe",
    "probability": "XX%"
  },
  "early_warning": "Signs to watch for in the next 5-7 days",
  "root_cause": "Deep scientific explanation of the health problem",
  "analysis": {
    "environment": "Detailed environmental analysis",
    "water": "Water stress or excess analysis",
    "soil": "Full soil condition analysis"
  },
  "smart_solutions": {
    "organic": ["Remedy 1 with dilution and timing", "Remedy 2", "Remedy 3"],
    "chemical": ["Product name + active ingredient + dose/acre + frequency + precaution"],
    "biological": ["Bioagent name + application method + dose"]
  },
  "spray_schedule": [
    { "day": "Day 1", "product": "...", "dose": "...", "timing": "Morning/Evening", "weather_condition": "..." },
    { "day": "Day 3", "product": "...", "dose": "...", "timing": "...", "weather_condition": "..." },
    { "day": "Day 7", "product": "...", "dose": "...", "timing": "...", "weather_condition": "..." },
    { "day": "Day 14", "product": "...", "dose": "...", "timing": "...", "weather_condition": "..." }
  ],
  "irrigation_advice": {
    "method": "Drip/Flood/Sprinkler",
    "quantity_liters_per_acre_per_day": "...",
    "frequency": "...",
    "critical_stages": "...",
    "avoid": "..."
  },
  "soil_amendments": ["Amendment 1 with quantity per acre", "Amendment 2"],
  "companion_plants": ["Plant 1 - benefit", "Plant 2 - benefit"],
  "harvest_readiness": {
    "days_to_harvest_current": "XX days",
    "days_to_harvest_optimal": "XX days",
    "quality_impact": "..."
  },
  "post_harvest_care": ["Storage tip 1", "Storage tip 2"],
  "financial_impact": {
    "estimated_loss_per_acre_inr": "₹XXXX",
    "potential_recovery_after_treatment_inr": "₹XXXX",
    "treatment_cost_estimate_inr": "₹XXXX",
    "net_benefit_of_treatment_inr": "₹XXXX"
  },
  "market_price_outlook": {
    "expected_price_per_quintal_inr": "₹XXXX",
    "market_trend": "Rising/Stable/Falling",
    "best_time_to_sell": "..."
  },
  "risk_propagation": {
    "spread_to_neighbors": "Yes/No",
    "spread_speed": "Fast/Moderate/Slow",
    "spread_mechanism": "Wind/Water/Contact/Insects"
  },
  "similar_case": "Real documented case from India/South Asia with outcome",
  "farmer_checklist": ["Action 1", "Action 2", "Action 3", "Action 4", "Action 5"],
  "long_term_prevention": ["Season-level strategy 1", "Strategy 2", "Strategy 3"],
  "recovery_time": "X-Y days",
  "progress": "Current disease stage and treatment timeline",
  "recommendations": ["General advice 1", "Advice 2", "Advice 3"],
  "cost_benefit": "Financial summary — expected return vs treatment cost",
  "spray_plan": "One-line spray instruction summary",
  "action_plan": {
    "today": "Immediate steps to take today",
    "day_1_2": "Critical actions in first 48 hours",
    "day_3_5": "Follow-up treatment",
    "day_7_plus": "Maintenance, monitoring, and next steps"
  }
}`;

    const requestBody = {
      model: MODELS[0],
      messages: [
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
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    };

    let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ ...requestBody, model: MODELS[1] }),
      });
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: (err as any)?.error?.message || `Groq API error (${response.status})`,
      });
    }

    const data = await response.json() as any;
    const rawContent = data.choices?.[0]?.message?.content || '{}';

    let cleanContent = rawContent.trim();
    if (cleanContent.includes('```json')) {
      cleanContent = cleanContent.split('```json')[1].split('```')[0].trim();
    } else if (cleanContent.includes('```')) {
      cleanContent = cleanContent.split('```')[1].split('```')[0].trim();
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      return res.status(200).json(JSON.parse(cleanContent));
    } catch {
      try {
        return res.status(200).json(JSON.parse(rawContent.replace(/```json/g, '').replace(/```/g, '').trim()));
      } catch {
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
}
