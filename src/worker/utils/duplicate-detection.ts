import prisma from '../../lib/db';
import { hammingDistance } from '../../lib/utils';

interface DuplicateResult {
  id: string;
  phash: string;
  similarity: number;
  garments: Array<{ id: string; name: string | null }>;
}

/**
 * Find similar images by perceptual hash
 */
export async function findSimilarByHash(
  userId: string,
  hash: string,
  threshold: number = 5
): Promise<DuplicateResult[]> {
  // Get all images for this user
  const images = await prisma.image.findMany({
    where: {
      userId,
      phash: { not: null },
    },
    select: {
      id: true,
      phash: true,
      garments: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const similar: DuplicateResult[] = [];

  for (const img of images) {
    if (!img.phash) continue;

    const distance = hammingDistance(hash, img.phash);

    if (distance <= threshold) {
      similar.push({
        id: img.id,
        phash: img.phash,
        similarity: 1 - distance / hash.length,
        garments: img.garments,
      });
    }
  }

  return similar;
}

/**
 * Find similar images by CLIP embedding
 * Uses cosine similarity via pgvector
 */
export async function findSimilarByEmbedding(
  userId: string,
  embedding: number[],
  threshold: number = 0.9,
  limit: number = 5
): Promise<Array<{ garment_id: string; similarity: number }>> {
  const vectorString = `[${embedding.join(',')}]`;

  const results = await prisma.$queryRawUnsafe<
    Array<{ owner_id: string; similarity: number }>
  >(
    `
    SELECT 
      e.owner_id,
      1 - (e.vector <=> $1::vector) as similarity
    FROM embeddings e
    JOIN garments g ON g.id = e.owner_id
    WHERE e.owner_type = 'garment'
      AND g.user_id = $2
      AND 1 - (e.vector <=> $1::vector) >= $3
    ORDER BY e.vector <=> $1::vector
    LIMIT $4
    `,
    vectorString,
    userId,
    threshold,
    limit
  );

  return results.map((r) => ({
    garment_id: r.owner_id,
    similarity: r.similarity,
  }));
}

