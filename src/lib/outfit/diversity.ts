import { ScoredOutfit, GarmentWithColors } from './types';
import { cosineSimilarity } from '../utils';
import prisma from '../db';

/**
 * Diversify outfit results to avoid near-duplicates
 */
export async function diversifyResults(
  scored: ScoredOutfit[],
  topN: number = 10
): Promise<ScoredOutfit[]> {
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Compute embeddings for all outfits
  for (const outfit of scored) {
    outfit.embedding = await computeOutfitEmbedding(outfit);
  }

  // Greedy diversification
  const selected: ScoredOutfit[] = [scored[0]]; // Always take top

  for (const candidate of scored.slice(1)) {
    if (selected.length >= topN) break;

    // Check similarity to already-selected outfits
    const similarities = selected.map((s) =>
      cosineSimilarity(candidate.embedding!, s.embedding!)
    );
    const minSimilarity = Math.min(...similarities);

    // If sufficiently different (similarity < 0.85), add it
    if (minSimilarity < 0.85 || selected.length < 3) {
      selected.push(candidate);
    }
  }

  return selected;
}

/**
 * Compute outfit-level embedding by pooling garment embeddings
 */
export async function computeOutfitEmbedding(
  outfit: ScoredOutfit
): Promise<number[]> {
  const garments: GarmentWithColors[] = [
    outfit.top,
    outfit.bottom,
    outfit.dress,
    outfit.footwear,
    outfit.outerwear,
  ].filter(Boolean) as GarmentWithColors[];

  // Fetch embeddings for all garments
  const embeddings = await Promise.all(
    garments.map(async (g) => {
      const result = await prisma.$queryRawUnsafe<Array<{ vector: string }>>(
        `SELECT vector::text FROM embeddings WHERE owner_type = 'garment' AND owner_id = $1 LIMIT 1`,
        g.id
      );

      if (result.length === 0) {
        // Return zero vector if no embedding found
        return new Array(512).fill(0);
      }

      // Parse pgvector format: "[0.1,0.2,...]"
      const vectorStr = result[0].vector;
      return JSON.parse(vectorStr) as number[];
    })
  );

  // Mean pooling
  const dim = embeddings[0].length;
  const pooled = new Array(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      pooled[i] += emb[i];
    }
  }

  // Average
  for (let i = 0; i < dim; i++) {
    pooled[i] /= embeddings.length;
  }

  // Normalize to unit length
  const mag = Math.sqrt(pooled.reduce((sum, val) => sum + val ** 2, 0));
  return pooled.map((val) => val / (mag || 1));
}

