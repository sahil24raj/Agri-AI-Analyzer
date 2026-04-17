# 🌾 Agri AI Analyzer — Smart Farm Intelligence

Professional agricultural AI analysis for crops and fields. Get instant health reports, pest detection, and precision farm zoning using Gemini AI.

**Powered by Google Gemini 2.5 Flash**

---

## ✨ Features

| Step | Feature |
|------|---------|
| 📸 **Image Upload** | Drag-and-drop crop image upload with instant preview |
| 🔍 **AI Detection** | Automatically detects crop type, soil type, and temperature |
| ✅ **User Verification** | Verify or correct AI predictions before generating report |
| 📊 **Health Dashboard** | Visual score gauges for health, nutrition, water, and disease risk |
| ⚗️ **NPK Analysis** | Nitrogen, Phosphorus, Potassium deficiency level bars |
| 💡 **AI Insights** | Simple farmer-friendly explanations of crop condition |
| 🏡 **Gharelu Nuske** | Traditional home remedies for crop issues |
| 🧪 **Fertilizer Advice** | Recommended fertilizers with dosage |
| 💧 **Watering Tips** | Irrigation suggestions based on crop needs |
| 🗺️ **Action Plan** | 5-step improvement plan for better yield |

---

## 🚀 Deploy on Vercel

### 1. Import from GitHub
- Go to [vercel.com/new](https://vercel.com/new)
- Import **`AI-Detector24`** from your GitHub

### 2. Add Environment Variable
In Vercel project settings → **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | Your Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |

### 3. Deploy!
Click **Deploy** — Vercel will build the Vite app and set up the serverless API routes automatically.

---

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Custom CSS (dark theme, nature-inspired palette)
- **AI**: Gemini API with Gemini 2.5 Flash (vision model)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Deployment**: Vercel

## 📁 Project Structure

```
├── api/
│   ├── analyze.ts       # Serverless: crop image analysis
│   └── report.ts        # Serverless: full health report
├── src/
│   ├── App.tsx           # Main React component (all 6 steps)
│   ├── geminiService.ts  # Frontend API client
│   ├── types.ts          # TypeScript interfaces
│   └── index.css         # Premium dark theme styles
├── vercel.json           # Vercel deployment config
└── index.html            # Entry point
```

## 🔑 Getting a Gemini API Key (Free)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign up / Sign in
3. Go to **Get API key** → **Create API key**
4. Copy the key and add it to Vercel env vars

---

## 🌱 Local Development

```bash
npm install
npm run dev
```

> Note: For local development, the `/api/*` serverless functions won't work directly. The app is designed to be deployed on Vercel where the serverless functions run automatically.

---

Made with ❤️ for Indian Farmers
