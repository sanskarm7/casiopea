import sharp from 'sharp';

interface CategoryResult {
  primary: string;
  subcategory: string | null;
  warmth_estimate: number;
  formality_estimate: number;
}

/**
 * Detect garment category using simple heuristics
 * Future: Replace with ML model (fine-tuned ViT or EfficientNet)
 */
export async function detectCategory(
  buffer: Buffer,
  metadata?: sharp.Metadata
): Promise<CategoryResult> {
  const meta = metadata || (await sharp(buffer).metadata());
  const aspectRatio = (meta.width || 1) / (meta.height || 1);

  // Simple heuristic-based detection
  // This is intentionally basic - users will correct via UI

  // Very wide = likely footwear
  if (aspectRatio > 1.5) {
    return {
      primary: 'footwear',
      subcategory: 'shoes',
      warmth_estimate: 1,
      formality_estimate: 3,
    };
  }

  // Very tall = likely dress or pants
  if (aspectRatio < 0.6) {
    return {
      primary: 'bottom',
      subcategory: 'pants',
      warmth_estimate: 3,
      formality_estimate: 3,
    };
  }

  // Moderately tall = could be dress
  if (aspectRatio < 0.8) {
    return {
      primary: 'dress',
      subcategory: null,
      warmth_estimate: 2,
      formality_estimate: 4,
    };
  }

  // Default to top (most common)
  return {
    primary: 'top',
    subcategory: 'shirt',
    warmth_estimate: 2,
    formality_estimate: 3,
  };
}

