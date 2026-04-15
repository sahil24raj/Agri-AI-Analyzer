import type { CropAnalysis, FullReport } from './types';

export async function analyzeImage(imageBase64: string, mimeType: string, location: string): Promise<CropAnalysis> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, location }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error || 'Analysis failed');
  }

  return response.json();
}

export async function generateFullReport(imageBase64: string, mimeType: string, cropData: CropAnalysis, location: string, weather: any): Promise<FullReport> {
  const response = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, cropData, location, weather }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error || 'Report generation failed');
  }

  return response.json();
}
