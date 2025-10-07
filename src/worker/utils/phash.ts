import imageHash from 'image-hash';

/**
 * Compute perceptual hash (pHash) for image deduplication
 */
export function computePHash(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    imageHash(buffer, 16, true, (error: Error | null, data: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

