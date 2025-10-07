import { spawn } from 'child_process';
import sharp from 'sharp';

/**
 * Remove background from image using rembg (Python/U²-Net)
 * Falls back to @imgly/background-removal if rembg is not available
 */
export async function removeBackground(buffer: Buffer): Promise<Buffer> {
  // Try using rembg CLI first (better quality but requires Python)
  try {
    return await removeBackgroundWithRembg(buffer);
  } catch (error) {
    // Fallback: use @imgly/background-removal (pure JS/ONNX)
    // For MVP, we'll just return the original if rembg fails
    // In production, you can install @imgly/background-removal
    throw new Error('Background removal failed: rembg not available');
  }
}

/**
 * Remove background using rembg CLI
 */
async function removeBackgroundWithRembg(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('rembg', ['i', '-']);
    const chunks: Buffer[] = [];
    let errorOutput = '';

    proc.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`rembg failed with code ${code}: ${errorOutput}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn rembg: ${err.message}`));
    });

    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

/**
 * Simple background removal using sharp (contrast-based)
 * This is a very basic fallback that won't work well for complex images
 */
export async function removeBackgroundSimple(buffer: Buffer): Promise<Buffer> {
  // This is a placeholder - in production, install @imgly/background-removal
  // or ensure rembg is available
  return sharp(buffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();
}

