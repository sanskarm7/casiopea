export interface ColorLAB {
  L: number; // Lightness (0-100)
  a: number; // Green-Red (-128 to 127)
  b: number; // Blue-Yellow (-128 to 127)
  ratio: number; // Coverage ratio (0-1)
  chroma?: number; // Chroma (colorfulness)
  hue?: number; // Hue angle in degrees
  isNeutral: boolean;
  isAccent: boolean;
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface HarmonyThresholds {
  complementary: { min: number; max: number };
  analogous: { max: number };
  triadic: { target: number; tolerance: number };
  neutral_boost: number;
  max_delta_e: number;
}

export const DEFAULT_HARMONY_THRESHOLDS: HarmonyThresholds = {
  complementary: { min: 120, max: 240 },
  analogous: { max: 30 },
  triadic: { target: 120, tolerance: 15 },
  neutral_boost: 1.2,
  max_delta_e: 50,
};

export type HarmonyType = 'complementary' | 'analogous' | 'triadic' | 'monochromatic' | 'neutral' | 'mixed';

