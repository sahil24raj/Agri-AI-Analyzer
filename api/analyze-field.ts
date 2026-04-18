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
    const { fieldImageBase64, fieldImageMimeType, language = 'en' } = req.body;

    if (!fieldImageBase64 || !fieldImageMimeType) {
      return res.status(400).json({ error: 'fieldImageBase64 and fieldImageMimeType are required' });
    }

    const prompt = `You are a Precision Agriculture AI. Analyze this field/crop image and return a detailed JSON report.

ANALYZE:
1. Identify the crop and its growth stage.
2. Divide the field into 3-5 zones (A, B, C...) based on visible health variation.
3. For each zone: condition (Healthy/Mild/Severe), the main issue, and exact treatment action.
4. Create a 3x3 emoji minimap: 🟩=Healthy, 🟨=Mild, 🟥=Severe.
5. Assign priority (High/Medium/Low) to each zone.
6. Recommend Spot or Full-field treatment and % area to treat.
7. Estimate resources saved by doing spot treatment vs full-field.
8. Estimate financial projections: yield, revenue, treatment cost, net gain, ROI.
9. Give 5 priority farmer actions to take today.

LANGUAGE RULE: Translate ALL string VALUES to language code "${language}". Keep JSON keys in English only.

Return ONLY this JSON (no markdown, no extra text):

{
  "crop": "Crop name and emoji",
  "growth_stage": "Growth stage",
  "field_health": {
    "overall_condition": "Good/Moderate/Poor",
    "total_affected_percent": "XX%",
    "healthy_percent": "XX%",
    "mild_issue_percent": "XX%",
    "severe_issue_percent": "XX%"
  },
  "minimap": {
    "grid": [["🟩","🟨","🟥"],["🟩","🟩","🟨"],["🟩","🟩","🟩"]],
    "location_desc": "Brief spatial description of where issues are concentrated"
  },
  "zone_analysis": [
    {
      "id": "A",
      "field_percent": "XX%",
      "condition": "Healthy/Mild/Severe",
      "infection_type": "Fungal/Bacterial/Pest/Nutrient/Abiotic/None",
      "priority": "High/Medium/Low",
      "issue": "Main issue detected",
      "action": "Specific treatment action with product and dose"
    }
  ],
  "priority_plan": {
    "high": "Zone IDs that need treatment in 24 hours",
    "medium": "Zone IDs to treat within 3 days",
    "low": "Zone IDs to monitor weekly"
  },
  "treatment_strategy": {
    "type": "Spot Treatment / Full Field",
    "area_to_treat_percent": "XX%",
    "short_instruction": "One clear instruction for the farmer"
  },
  "savings_insight": {
    "chemical_saved_percent": "XX%",
    "water_saved_percent": "XX%",
    "cost_saved_rupees": "₹XXXX",
    "expected_profit_per_sqft": "₹XX.XX",
    "labor_saved_percent": "XX%",
    "total_cost_saved_inr": "₹XXXX"
  },
  "financial_projections": {
    "estimated_yield_quintals_per_acre": "XX",
    "yield_loss_percent": "XX%",
    "current_mandi_price_per_quintal_inr": "₹XXXX",
    "revenue_without_treatment_inr": "₹XXXX",
    "revenue_after_treatment_inr": "₹XXXX",
    "treatment_cost_inr": "₹XXXX",
    "net_gain_from_treatment_inr": "₹XXXX",
    "roi_percent": "XX%",
    "expected_profit_per_sqft": "₹XX.XX"
  },
  "farmer_checklist": [
    "Action 1 — specific and actionable",
    "Action 2",
    "Action 3",
    "Action 4",
    "Action 5"
  ]
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
              image_url: { url: `data:${fieldImageMimeType};base64,${fieldImageBase64}` },
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
        return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
      }
    }
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
}
