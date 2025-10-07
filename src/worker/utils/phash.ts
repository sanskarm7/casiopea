import { imageHash } from 'image-hash';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * Compute perceptual hash (pHash) for image deduplication
 */
export async function computePHash(buffer: Buffer): Promise<string> {
  // image-hash requires a file path, so write to temp file
  const tempPath = join(tmpdir(), `phash-${randomUUID()}.jpg`);
  
  try {
    await writeFile(tempPath, buffer);
    
    return new Promise((resolve, reject) => {
      imageHash(tempPath, 16, true, async (error: Error | null, data: string) => {
        // Clean up temp file
        try {
          await unlink(tempPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  } catch (error) {
    // Clean up on error
    try {
      await unlink(tempPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

