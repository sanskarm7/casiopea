import sharp from 'sharp';
import prisma from '../../lib/db';
import logger from '../../lib/logger';
import { downloadFromS3, uploadToS3 } from '../../lib/s3';
import { extractPaletteLAB } from '../../lib/color/extraction';
import { computePHash } from '../utils/phash';
import { removeBackground } from '../utils/background-removal';
import { detectCategory } from '../utils/category-detection';
import { generateCLIPEmbedding } from '../utils/clip-embedding';
import { findSimilarByHash } from '../utils/duplicate-detection';

interface ProcessImageData {
  upload_id: string;
  object_key: string;
  checksum: string;
  user_id: string;
}

export async function processImage(data: ProcessImageData) {
  const { upload_id, object_key, checksum, user_id } = data;
  const jobId = upload_id;

  const log = logger.child({ jobId, userId: user_id });

  try {
    // Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });

    log.info('Starting image processing');

    // 1. Download original
    log.info('Downloading image from S3');
    const buffer = await downloadFromS3(object_key);

    // 2. Strip EXIF and auto-rotate
    log.info('Stripping EXIF data');
    const cleaned = await sharp(buffer)
      .rotate() // auto-rotate based on EXIF orientation
      .withMetadata({ exif: {} }) // strip all EXIF
      .toBuffer();

    // 3. Compute pHash for deduplication
    log.info('Computing perceptual hash');
    const phash = await computePHash(cleaned);

    // 4. Check for duplicates
    log.info('Checking for duplicates');
    const duplicates = await findSimilarByHash(user_id, phash, 5);

    if (duplicates.length > 0) {
      log.info({ duplicateCount: duplicates.length }, 'Potential duplicates found');
      
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'needs_review',
          payloadJson: {
            reason: 'possible_duplicate',
            duplicates: duplicates.map((d) => ({
              garment_id: d.garments[0]?.id,
              image_id: d.id,
              similarity: d.similarity,
            })),
          },
        },
      });

      return {
        status: 'needs_review',
        reason: 'duplicate',
        duplicates,
      };
    }

    // 5. Get metadata
    const metadata = await sharp(cleaned).metadata();
    log.info({ width: metadata.width, height: metadata.height }, 'Image metadata');

    // 6. Background removal
    log.info('Removing background');
    let noBgBuffer: Buffer;
    let backgroundRemoved = true;

    try {
      noBgBuffer = await removeBackground(cleaned);
      
      // Check if background removal failed (>95% transparent)
      const { data: pixelData } = await sharp(noBgBuffer).raw().toBuffer({ resolveWithObject: true });
      let transparentPixels = 0;
      for (let i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] < 10) transparentPixels++;
      }
      const transparencyRatio = transparentPixels / (pixelData.length / 4);
      
      if (transparencyRatio > 0.95) {
        log.warn('Background removal resulted in mostly transparent image, using original');
        noBgBuffer = cleaned;
        backgroundRemoved = false;
      }
    } catch (error) {
      log.error({ error }, 'Background removal failed, using original');
      noBgBuffer = cleaned;
      backgroundRemoved = false;
    }

    // 7. Downscale to max edge 1280px
    log.info('Downscaling image');
    const maxEdge = 1280;
    const scale = Math.min(
      maxEdge / (metadata.width || maxEdge),
      maxEdge / (metadata.height || maxEdge),
      1 // don't upscale
    );

    const processed = await sharp(noBgBuffer)
      .resize({
        width: Math.round((metadata.width || maxEdge) * scale),
        height: Math.round((metadata.height || maxEdge) * scale),
        fit: 'inside',
      })
      .webp({ quality: 85 })
      .toBuffer();

    const processedMetadata = await sharp(processed).metadata();

    // 8. Extract color palette in LAB
    log.info('Extracting color palette');
    const palette = await extractPaletteLAB(processed);
    log.info({ colorCount: palette.length }, 'Color palette extracted');

    // 9. Lightweight category detection
    log.info('Detecting category');
    const category = await detectCategory(processed, metadata);

    // 10. Generate CLIP embedding
    log.info('Generating CLIP embedding');
    let embedding: number[] | null = null;
    try {
      embedding = await generateCLIPEmbedding(processed);
      log.info({ embeddingDim: embedding.length }, 'CLIP embedding generated');
    } catch (error) {
      log.error({ error }, 'CLIP embedding generation failed, continuing without it');
    }

    // 11. Upload processed images
    log.info('Uploading processed image');
    const processedKey = `uploads/processed/${jobId}.webp`;
    await uploadToS3(processedKey, processed, 'image/webp');

    // 12. Store in database
    log.info('Storing in database');
    
    const image = await prisma.image.create({
      data: {
        id: jobId,
        userId: user_id,
        originalKey: object_key,
        objectKey: processedKey,
        width: processedMetadata.width,
        height: processedMetadata.height,
        phash,
        backgroundRemoved,
      },
    });

    const garment = await prisma.garment.create({
      data: {
        id: jobId,
        userId: user_id,
        imageId: image.id,
        name: `${category.subcategory || category.primary}`,
        category: category.primary,
        subcategory: category.subcategory,
        autoDetected: true,
        warmthScore: category.warmth_estimate,
        formalityScore: category.formality_estimate,
        colors: {
          create: palette.map((c, idx) => ({
            labL: c.L,
            labA: c.a,
            labB: c.b,
            ratio: c.ratio,
            chroma: c.chroma,
            hue: c.hue,
            isNeutral: c.isNeutral,
            isAccent: c.isAccent,
            rank: idx,
          })),
        },
      },
      include: {
        colors: true,
      },
    });

    // Store embedding if generated
    if (embedding) {
      // Convert array to pgvector format
      const vectorString = `[${embedding.join(',')}]`;
      
      await prisma.$executeRawUnsafe(
        `INSERT INTO embeddings (id, owner_type, owner_id, vector, created_at) 
         VALUES ($1, $2, $3, $4::vector, NOW())`,
        crypto.randomUUID(),
        'garment',
        garment.id,
        vectorString
      );
    }

    // 13. Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        payloadJson: { garment_id: garment.id },
      },
    });

    log.info({ garmentId: garment.id }, 'Image processing completed successfully');

    return {
      status: 'success',
      garment_id: garment.id,
      garment,
    };
  } catch (error: any) {
    log.error({ error: error.message, stack: error.stack }, 'Image processing failed');

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorJson: {
          message: error.message,
          stack: error.stack,
        },
      },
    });

    throw error; // BullMQ will retry
  }
}

