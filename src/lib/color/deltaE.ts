import { getDeltaE00 } from 'delta-e';
import { ColorLAB } from './types';

/**
 * Calculate Delta E 2000 (perceptual color difference)
 * Returns a value representing how different two colors appear to the human eye
 * 
 * ΔE < 1.0: Not perceptible by human eyes
 * ΔE 1-2: Perceptible through close observation
 * ΔE 2-10: Perceptible at a glance
 * ΔE 11-49: Colors are more similar than opposite
 * ΔE 50+: Colors are very different
 */
export function computeDeltaE2000(
  c1: { lab_L?: number; L?: number; lab_a?: number; a?: number; lab_b?: number; b?: number },
  c2: { lab_L?: number; L?: number; lab_a?: number; a?: number; lab_b?: number; b?: number }
): number {
  const L1 = c1.lab_L ?? c1.L ?? 0;
  const a1 = c1.lab_a ?? c1.a ?? 0;
  const b1 = c1.lab_b ?? c1.b ?? 0;
  
  const L2 = c2.lab_L ?? c2.L ?? 0;
  const a2 = c2.lab_a ?? c2.a ?? 0;
  const b2 = c2.lab_b ?? c2.b ?? 0;

  return getDeltaE00(
    { L: L1, A: a1, B: b1 },
    { L: L2, A: a2, B: b2 }
  );
}

/**
 * Check if two colors are perceptually similar
 */
export function areColorsSimilar(
  c1: ColorLAB,
  c2: ColorLAB,
  threshold: number = 10
): boolean {
  return computeDeltaE2000(c1, c2) < threshold;
}

/**
 * Find the closest color from a palette
 */
export function findClosestColor(
  target: ColorLAB,
  palette: ColorLAB[]
): { color: ColorLAB; distance: number; index: number } {
  let minDistance = Infinity;
  let closestColor = palette[0];
  let closestIndex = 0;

  palette.forEach((color, idx) => {
    const distance = computeDeltaE2000(target, color);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
      closestIndex = idx;
    }
  });

  return { color: closestColor, distance: minDistance, index: closestIndex };
}

