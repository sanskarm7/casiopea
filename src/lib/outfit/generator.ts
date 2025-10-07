import { subDays, differenceInDays } from 'date-fns';
import prisma from '../db';
import logger from '../logger';
import { OutfitRequest, OutfitCandidate, ScoredOutfit, GarmentWithColors } from './types';
import { scoreOutfit } from './scoring';
import { diversifyResults, computeOutfitEmbedding } from './diversity';

/**
 * Generate outfit suggestions based on weather and constraints
 */
export async function generateOutfits(request: OutfitRequest): Promise<ScoredOutfit[]> {
  const log = logger.child({ userId: request.user_id, date: request.date });
  
  log.info('Generating outfits');

  // 1. Generate candidates with hard constraints
  const candidates = await generateCandidates(request);
  log.info({ candidateCount: candidates.length }, 'Generated candidates');

  if (candidates.length === 0) {
    log.warn('No candidates found matching constraints');
    return [];
  }

  // 2. Score all candidates
  const scored: ScoredOutfit[] = [];
  
  for (const candidate of candidates) {
    try {
      const scoredOutfit = await scoreOutfit(candidate, request, scored);
      scored.push(scoredOutfit);
    } catch (error) {
      log.error({ error, candidate }, 'Failed to score outfit');
    }
  }

  log.info({ scoredCount: scored.length }, 'Scored outfits');

  // 3. Diversify and return top N
  const topN = request.count || 10;
  const diversified = await diversifyResults(scored, topN);

  log.info({ resultCount: diversified.length }, 'Outfits generated successfully');

  return diversified;
}

/**
 * Generate candidate outfits with hard constraints
 */
async function generateCandidates(request: OutfitRequest): Promise<OutfitCandidate[]> {
  const { user_id, date, weather, override_recency } = request;
  
  // Get user settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user_id },
  });

  const recencyDays = settings?.recencyDays || 7;
  const cutoffDate = override_recency ? null : subDays(date, recencyDays);

  // Fetch eligible garments
  const eligible = await prisma.garment.findMany({
    where: {
      userId: user_id,
      isAvailable: true, // not in laundry
      ...(cutoffDate && {
        OR: [
          { lastWorn: { lt: cutoffDate } },
          { lastWorn: null },
        ],
      }),
      // Weather gates
      warmthScore: {
        gte: weather.thermal_band.min_warmth,
        lte: weather.thermal_band.max_warmth,
      },
      // Rain gate
      ...(weather.is_rainy && {
        OR: [
          { category: { not: 'outerwear' } },
          { category: 'outerwear', waterResistant: true },
        ],
      }),
    },
    include: {
      colors: {
        orderBy: { rank: 'asc' },
      },
    },
  });

  // Group by category
  const tops = eligible.filter((g) => g.category === 'top');
  const bottoms = eligible.filter((g) => g.category === 'bottom');
  const dresses = eligible.filter((g) => g.category === 'dress');
  const footwear = eligible.filter((g) => g.category === 'footwear');
  const outerwear = eligible.filter((g) => g.category === 'outerwear');
  const accessories = eligible.filter((g) => g.category === 'accessory');

  const candidates: OutfitCandidate[] = [];
  const maxCombinations = 1000; // Cap combinatorial explosion

  // Standard outfit: top + bottom + footwear
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const foot of footwear) {
        if (candidates.length >= maxCombinations) break;
        
        candidates.push({ top, bottom, footwear: foot });

        // With outerwear (if cold or rainy)
        if (weather.thermal_band.min_warmth >= 3 || weather.is_rainy) {
          for (const outer of outerwear) {
            if (candidates.length >= maxCombinations) break;
            candidates.push({ top, bottom, footwear: foot, outerwear: outer });
          }
        }
      }
      if (candidates.length >= maxCombinations) break;
    }
    if (candidates.length >= maxCombinations) break;
  }

  // Dress outfit: dress + footwear
  for (const dress of dresses) {
    for (const foot of footwear) {
      if (candidates.length >= maxCombinations) break;
      
      candidates.push({ dress, footwear: foot });

      // With outerwear
      if (weather.thermal_band.min_warmth >= 3 || weather.is_rainy) {
        for (const outer of outerwear) {
          if (candidates.length >= maxCombinations) break;
          candidates.push({ dress, footwear: foot, outerwear: outer });
        }
      }
    }
    if (candidates.length >= maxCombinations) break;
  }

  return candidates.slice(0, maxCombinations);
}

