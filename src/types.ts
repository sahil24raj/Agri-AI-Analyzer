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
  stage: string;
  health_score: number;
  farm_score: number;
  progress: string;
  root_cause: string;
  metrics: HealthMetrics;
  issues_detected: string[];
  disease_pest: DiseasePest;
  analysis: DetailedAnalysis;
  recommendations: string[];
  smart_solutions: {
    organic: string[];
    chemical: string[];
  };
  irrigation_advice: string;
  early_warning: string;
  risk_meter: {
    level: string;
    probability: string;
  };
  similar_case: string;
  action_plan: {
    day_1_2: string;
    day_3_5: string;
    day_7_plus: string;
  };
  recovery_time: string;
  cost_benefit: string;
  spray_plan: string;
}

export type AppStep = 'upload' | 'verifying' | 'confirmed' | 'analyzing' | 'results';
