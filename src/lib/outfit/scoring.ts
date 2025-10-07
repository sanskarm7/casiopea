import { differenceInDays } from 'date-fns';
import { OutfitCandidate, ScoredOutfit, OutfitRequest, DEFAULT_WEIGHTS, GarmentWithColors } from './types';
import { computeColorHarmony } from '../color/harmony';
import { mean, variance } from '../utils';
import prisma from '../db';

/**
 * Score an outfit candidate
 */
export async function scoreOutfit(
  candidate: OutfitCandidate,
  request: OutfitRequest,
  previouslyScored: ScoredOutfit[]
): Promise<ScoredOutfit> {
  // Get user's custom weights or use defaults
  const settings = await prisma.userSettings.findUnique({
    where: { userId: request.user_id },
  });

  const weights =
    (settings?.outfitWeights as typeof DEFAULT_WEIGHTS) || DEFAULT_WEIGHTS;

  // Collect all garments
  const garments: GarmentWithColors[] = [
    candidate.top,
    candidate.bottom,
    candidate.dress,
    candidate.footwear,
    candidate.outerwear,
    ...(candidate.accessories || []),
  ].filter(Boolean) as GarmentWithColors[];

  // 1. COLOR HARMONY
  const colors = garments.flatMap((g) => g.colors);
  const { score: colorScore, harmonyType } = computeColorHarmony(colors);

  // 2. FORMALITY MATCH (low variance = better)
  const formalityLevels = garments.map((g) => g.formalityScore || 3);
  const formalityVariance = variance(formalityLevels);
  const formalityScore = Math.max(0, 1 - formalityVariance / 4);

  // 3. THERMAL FIT
  const avgWarmth = mean(garments.map((g) => g.warmthScore || 3));
  const targetWarmth =
    (request.weather.thermal_band.min_warmth +
      request.weather.thermal_band.max_warmth) /
    2;
  const thermalScore = 1 - Math.min(1, Math.abs(avgWarmth - targetWarmth) / 5);

  // 4. PATTERN MIX (at most one bold pattern)
  const patterns = garments.filter((g) => g.hasPattern);
  const boldPatterns = patterns.filter((g) => g.patternIntensity === 'bold');
  const patternScore =
    boldPatterns.length <= 1 ? 1.0 : boldPatterns.length === 2 ? 0.5 : 0.0;

  // 5. USER PREFERENCES (placeholder - will be learned)
  const prefsScore = 0.5; // Neutral until we have data

  // 6. RECENCY DECAY
  const daysSinceWorn = garments.map((g) => {
    if (!g.lastWorn) return Infinity;
    return differenceInDays(request.date, g.lastWorn);
  });
  const validDays = daysSinceWorn.filter((d) => d !== Infinity);
  const avgDays = validDays.length > 0 ? mean(validDays) : 14;
  const recencyScore = Math.min(1, avgDays / 14); // Normalize to 2 weeks

  // 7. SET DIVERSITY (computed later with outfit embedding)
  const diversityScore = 1.0; // Placeholder

  // Weighted sum
  const total =
    weights.color * colorScore +
    weights.style * formalityScore +
    weights.weather * thermalScore +
    weights.pattern * patternScore +
    weights.prefs * prefsScore +
    weights.recency * recencyScore +
    weights.diversity * diversityScore;

  return {
    ...candidate,
    score: total,
    breakdown: {
      color_harmony: colorScore,
      formality_match: formalityScore,
      thermal_fit: thermalScore,
      pattern_mix: patternScore,
      user_prefs: prefsScore,
      recency_decay: recencyScore,
      set_diversity: diversityScore,
      total,
    },
    colorHarmonyType: harmonyType,
  };
}

