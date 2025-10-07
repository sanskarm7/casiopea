import { Garment, GarmentColor } from '@prisma/client';
import { WeatherConditions } from '../weather/types';

export interface OutfitRequest {
  user_id: string;
  date: Date;
  weather: WeatherConditions;
  override_recency?: boolean;
  count?: number;
}

export interface OutfitCandidate {
  top?: GarmentWithColors;
  bottom?: GarmentWithColors;
  dress?: GarmentWithColors;
  footwear: GarmentWithColors;
  outerwear?: GarmentWithColors;
  accessories?: GarmentWithColors[];
}

export interface ScoredOutfit extends OutfitCandidate {
  score: number;
  breakdown: ScoreBreakdown;
  embedding?: number[];
  colorHarmonyType: string;
}

export interface ScoreBreakdown {
  color_harmony: number;
  formality_match: number;
  thermal_fit: number;
  pattern_mix: number;
  user_prefs: number;
  recency_decay: number;
  set_diversity: number;
  total: number;
}

export interface ScoringWeights {
  color: number;
  style: number;
  weather: number;
  pattern: number;
  prefs: number;
  recency: number;
  diversity: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  color: 0.30,
  style: 0.15,
  weather: 0.20,
  pattern: 0.10,
  prefs: 0.10,
  recency: 0.10,
  diversity: 0.05,
};

export type GarmentWithColors = Garment & {
  colors: GarmentColor[];
};

