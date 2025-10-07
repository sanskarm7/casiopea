import sharp from 'sharp';
import { lab } from 'd3-color';
import { kmeans } from 'ml-kmeans';
import { ColorLAB, ColorRGB } from './types';

/**
 * Extract color palette from image buffer using k-means clustering in LAB color space
 */
export async function extractPaletteLAB(
  buffer: Buffer,
  kMin: number = 5,
  kMax: number = 8,
  minRatio: number = 0.05
): Promise<ColorLAB[]> {
  // Resize image to reduce processing time
  const img = sharp(buffer);
  const { data, info } = await img
    .resize(150, 150, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Sample pixels (skip fully transparent)
  const pixels: ColorRGB[] = [];
  const channels = info.channels;
  
  for (let i = 0; i < data.length; i += channels) {
    if (channels === 4) {
      const alpha = data[i + 3];
      if (alpha < 128) continue; // Skip transparent pixels
    }
    
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    });
  }

  if (pixels.length === 0) {
    throw new Error('No visible pixels found in image');
  }

  // Convert RGB → LAB
  const labPixels = pixels.map(({ r, g, b }) => {
    const color = lab(`rgb(${r},${g},${b})`);
    return [color.l, color.a, color.b];
  });

  // Adaptive k based on number of pixels
  const k = Math.min(kMax, Math.max(kMin, Math.floor(pixels.length / 1000)));

  // k-means clustering
  const result = kmeans(labPixels, k, {
    initialization: 'kmeans++',
    maxIterations: 50,
  });

  // Calculate cluster sizes and filter small ones
  const clusterSizes = new Array(k).fill(0);
  result.clusters.forEach((clusterId) => {
    clusterSizes[clusterId]++;
  });

  const clusters = result.centroids.map((centroid, idx) => {
    const [L, a, b] = centroid;
    const ratio = clusterSizes[idx] / pixels.length;
    const chroma = Math.sqrt(a ** 2 + b ** 2);
    const hue = (Math.atan2(b, a) * 180) / Math.PI;

    return {
      L,
      a,
      b,
      ratio,
      chroma,
      hue: hue < 0 ? hue + 360 : hue,
      isNeutral: chroma < 15, // Low chroma = neutral color
      isAccent: chroma > 40 && ratio > 0.15, // High chroma + significant coverage
    };
  });

  // Filter clusters below minimum ratio
  const filtered = clusters.filter((c) => c.ratio >= minRatio);

  // Normalize ratios after filtering
  const totalRatio = filtered.reduce((sum, c) => sum + c.ratio, 0);
  const normalized = filtered.map((c) => ({
    ...c,
    ratio: c.ratio / totalRatio,
  }));

  // Sort by ratio (dominant first)
  return normalized.sort((a, b) => b.ratio - a.ratio);
}

/**
 * Convert LAB to RGB for display purposes
 */
export function labToRgb(L: number, a: number, b: number): ColorRGB {
  const color = lab(L, a, b);
  const rgbColor = color.rgb();
  return {
    r: Math.round(rgbColor.r),
    g: Math.round(rgbColor.g),
    b: Math.round(rgbColor.b),
  };
}

/**
 * Convert RGB to hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert LAB to hex color string
 */
export function labToHex(L: number, a: number, b: number): string {
  const rgb = labToRgb(L, a, b);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

