export interface CropAnalysis {
  crop_type: string;
  disease?: string;
  affected_area?: string;
  soil_type: string;
  temperature: string;
  confidence: string;
  // New fields from upgraded analyze API
  scientific_name?: string;
  growth_stage?: string;
  visual_symptoms?: string[];
  nutrient_issues?: string[];
  urgency?: string;
  quick_tip?: string;
  market_impact?: string;
}

export interface DiseasePest {
  name: string;
  severity: string;
  spread_risk: string;
  // New
  scientific_name?: string;
  pathogen_type?: string;
  infection_mechanism?: string;
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
  // New
  stem_health?: number;
  root_health?: number;
  nutrient_score?: number;
}

export interface ZoneAnalysis {
  id: string;
  condition: string;
  issue: string;
  action: string;
  // New
  field_percent?: string;
  infection_type?: string;
  symptoms?: string[];
  root_cause?: string;
  priority?: string;
  estimated_cost_inr?: string;
}

export interface SprayScheduleEntry {
  day: string;
  product: string;
  dose?: string;
  dose_per_acre?: string;
  dilution?: string;
  timing: string;
  weather?: string;
  weather_condition?: string;
  zone?: string;
}

export interface FieldReport {
  crop: string;
  growth_stage?: string;
  field_health: {
    overall_condition: string;
    total_affected_percent: string;
    healthy_percent?: string;
    mild_issue_percent?: string;
    severe_issue_percent?: string;
  };
  minimap: {
    grid: string[][];
    location_desc: string;
  };
  zone_analysis: ZoneAnalysis[];
  priority_plan: {
    high: string;
    medium: string;
    low: string;
  };
  treatment_strategy: {
    type: string;
    area_to_treat_percent: string;
    short_instruction: string;
    estimated_spray_cost_inr?: string;
  };
  savings_insight: {
    chemical_saved_percent: string;
    water_saved_percent: string;
    cost_saved_rupees: string;
    expected_profit_per_sqft: string;
    labor_saved_percent?: string;
    total_cost_saved_inr?: string;
  };
  // New
  spray_schedule?: SprayScheduleEntry[];
  nutrient_zoning?: Array<{ zone: string; deficiency: string; symptom: string; fix: string }>;
  irrigation_plan?: {
    stressed_zones?: string;
    waterlogged_zones?: string;
    method?: string;
    quantity_liters_per_acre?: string;
    frequency?: string;
    schedule?: string;
  };
  financial_projections?: {
    estimated_yield_quintals_per_acre?: string;
    yield_loss_percent?: string;
    current_mandi_price_per_quintal_inr?: string;
    revenue_without_treatment_inr?: string;
    revenue_after_treatment_inr?: string;
    treatment_cost_inr?: string;
    net_gain_from_treatment_inr?: string;
    roi_percent?: string;
    expected_profit_per_sqft?: string;
  };
  soil_health_zoning?: {
    carbon_level?: string;
    compaction_zones?: string;
    drainage_quality?: string;
    amendment_needed?: string;
  };
  risk_propagation?: {
    will_spread?: string;
    spread_direction?: string;
    spread_timeline?: string;
    spread_mechanism?: string;
  };
  sustainability_score?: {
    score?: number;
    soil_conservation?: string;
    water_efficiency?: string;
    chemical_load?: string;
    improvement_tips?: string[];
  };
  farmer_checklist?: string[];
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
    biological?: string[];
  };
  // Can be string (old) or object (new) — handle both in UI with optional chaining
  irrigation_advice: string | {
    method?: string;
    quantity_liters_per_acre_per_day?: string;
    frequency?: string;
    critical_stages?: string;
    avoid?: string;
  };
  early_warning: string;
  risk_meter: {
    level: string;
    probability: string;
  };
  similar_case: string;
  action_plan: {
    today?: string;
    day_1_2: string;
    day_3_5: string;
    day_7_plus: string;
  };
  recovery_time: string;
  cost_benefit: string;
  spray_plan: string;
  // New fields
  scientific_name?: string;
  weather_impact?: string;
  visual_symptoms?: string[];
  nutrient_panel?: {
    nitrogen?: string;
    phosphorus?: string;
    potassium?: string;
    calcium?: string;
    magnesium?: string;
    iron?: string;
    zinc?: string;
    boron?: string;
  };
  yield_loss_forecast?: {
    if_untreated_7days?: string;
    if_untreated_14days?: string;
    if_untreated_30days?: string;
    with_treatment?: string;
  };
  spray_schedule?: SprayScheduleEntry[];
  soil_amendments?: string[];
  companion_plants?: string[];
  harvest_readiness?: {
    days_to_harvest_current?: string;
    days_to_harvest_optimal?: string;
    quality_impact?: string;
  };
  post_harvest_care?: string[];
  financial_impact?: {
    estimated_loss_per_acre_inr?: string;
    potential_recovery_after_treatment_inr?: string;
    treatment_cost_estimate_inr?: string;
    net_benefit_of_treatment_inr?: string;
  };
  market_price_outlook?: {
    expected_price_per_quintal_inr?: string;
    market_trend?: string;
    best_time_to_sell?: string;
  };
  risk_propagation?: {
    spread_to_neighbors?: string;
    spread_speed?: string;
    spread_mechanism?: string;
  };
  farmer_checklist?: string[];
  long_term_prevention?: string[];
}

export type AppStep = 'upload' | 'verifying' | 'confirmed' | 'analyzing' | 'results';
export type AppTab = 'crop' | 'field';
