export interface PrioritizationConfig {
  weights: {
    urgency: number;
    impact: number;
    risk_boost: number;
    effort_penalty: number;
  };
  keywords: {
    urgency: string[];
    impact: string[];
    risk: string[];
    effort_low: string[];
    effort_high: string[];
  };
  bucket_thresholds: {
    P0: number;
    P1: number;
    P2: number;
  };
}
