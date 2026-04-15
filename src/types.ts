export interface CropAnalysis {
  crop_type: string;
  disease?: string;
  affected_area?: string;
  soil_type: string;
  temperature: string;
  confidence: string;
}

export interface DiseasePest {
  name: string;
  severity: string;
  spread_risk: string;
}

export interface DetailedAnalysis {
  environment: string;
  water: string;
  soil: string;
}

export interface HealthMetrics {
  leaf_health: number;
  soil_health: number;
  water_score: number;
  environment_score: number;
  disease_impact: number;
}

export interface FullReport {
  crop: string;
  health_score: number;
  metrics: HealthMetrics;
  issues_detected: string[];
  disease_pest: DiseasePest;
  analysis: DetailedAnalysis;
  recommendations: string[];
}

export type AppStep = 'upload' | 'verifying' | 'confirmed' | 'analyzing' | 'results';
