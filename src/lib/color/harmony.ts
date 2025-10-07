import { ColorLAB, HarmonyThresholds, DEFAULT_HARMONY_THRESHOLDS, HarmonyType } from './types';
import { computeDeltaE2000 } from './deltaE';

/**
 * Compute color harmony score for a set of colors
 * Returns a score between 0 and 1, where higher is better
 */
export function computeColorHarmony(
  colors: ColorLAB[],
  thresholds: HarmonyThresholds = DEFAULT_HARMONY_THRESHOLDS
): { score: number; harmonyType: HarmonyType } {
  if (colors.length === 0) return { score: 0, harmonyType: 'neutral' };
  if (colors.length === 1) return { score: 1, harmonyType: 'monochromatic' };

  let harmonyScore = 0;
  let pairCount = 0;
  const harmonyTypes: HarmonyType[] = [];

  // Compare all pairs of colors
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i];
      const c2 = colors[j];

      const deltaE = computeDeltaE2000(c1, c2);

      // Hard reject if too jarring
      if (deltaE > thresholds.max_delta_e) {
        return { score: 0, harmonyType: 'mixed' };
      }

      // If one is neutral, boost score
      if (c1.isNeutral || c2.isNeutral) {
        harmonyScore += thresholds.neutral_boost;
        harmonyTypes.push('neutral');
        pairCount++;
        continue;
      }

      // Compute hue difference
      const hue1 = c1.hue ?? 0;
      const hue2 = c2.hue ?? 0;
      let hueDiff = Math.abs(hue1 - hue2);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      // Check for monochromatic (similar hue, different lightness)
      if (hueDiff < 15 && Math.abs(c1.L - c2.L) > 20) {
        harmonyScore += 1.0;
        harmonyTypes.push('monochromatic');
      }
      // Analogous harmony
      else if (hueDiff <= thresholds.analogous.max) {
        harmonyScore += 1.0;
        harmonyTypes.push('analogous');
      }
      // Complementary harmony
      else if (hueDiff >= thresholds.complementary.min && hueDiff <= thresholds.complementary.max) {
        harmonyScore += 0.9;
        harmonyTypes.push('complementary');
      }
      // Triadic harmony
      else if (Math.abs(hueDiff - thresholds.triadic.target) <= thresholds.triadic.tolerance) {
        harmonyScore += 0.85;
        harmonyTypes.push('triadic');
      }
      // Weak harmony
      else {
        harmonyScore += 0.3;
        harmonyTypes.push('mixed');
      }

      pairCount++;
    }
  }

  const finalScore = pairCount > 0 ? harmonyScore / pairCount : 0;
  
  // Determine dominant harmony type
  const harmonyCounts = harmonyTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<HarmonyType, number>);

  const dominantHarmony = Object.entries(harmonyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as HarmonyType || 'mixed';

  return {
    score: Math.min(1.0, finalScore), // Cap at 1.0
    harmonyType: dominantHarmony,
  };
}

/**
 * Check if a color is neutral (low chroma)
 */
export function isNeutralColor(color: ColorLAB, chromaThreshold: number = 15): boolean {
  const chroma = color.chroma ?? Math.sqrt(color.a ** 2 + color.b ** 2);
  return chroma < chromaThreshold;
}

/**
 * Get complementary hue (opposite on color wheel)
 */
export function getComplementaryHue(hue: number): number {
  return (hue + 180) % 360;
}

/**
 * Get analogous hues (adjacent on color wheel)
 */
export function getAnalogousHues(hue: number, spread: number = 30): [number, number] {
  return [
    (hue - spread + 360) % 360,
    (hue + spread) % 360,
  ];
}

/**
 * Get triadic hues (evenly spaced on color wheel)
 */
export function getTriadicHues(hue: number): [number, number] {
  return [
    (hue + 120) % 360,
    (hue + 240) % 360,
  ];
}

