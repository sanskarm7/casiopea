import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import path from 'path';

let clipSession: ort.InferenceSession | null = null;

/**
 * Generate CLIP embedding for image similarity search
 * Uses CLIP ViT-B/32 ONNX model
 */
export async function generateCLIPEmbedding(buffer: Buffer): Promise<number[]> {
  // Lazy load CLIP model
  if (!clipSession) {
    const modelPath = process.env.CLIP_MODEL_PATH || path.join(process.cwd(), 'models', 'clip-vit-b32.onnx');
    
    try {
      clipSession = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
      });
    } catch (error) {
      throw new Error(`Failed to load CLIP model from ${modelPath}: ${error}`);
    }
  }

  // Preprocess: resize to 224x224, normalize to ImageNet stats
  const preprocessed = await sharp(buffer)
    .resize(224, 224, { fit: 'cover', position: 'center' })
    .removeAlpha()
    .raw()
    .toBuffer();

  // Convert to float32 tensor with normalization
  const float32 = new Float32Array(3 * 224 * 224);
  
  // ImageNet normalization values
  const mean = [0.48145466, 0.4578275, 0.40821073];
  const std = [0.26862954, 0.26130258, 0.27577711];

  for (let i = 0; i < 224 * 224; i++) {
    const r = preprocessed[i * 3 + 0] / 255.0;
    const g = preprocessed[i * 3 + 1] / 255.0;
    const b = preprocessed[i * 3 + 2] / 255.0;

    // Normalize and convert to CHW format (channels first)
    float32[i] = (r - mean[0]) / std[0];
    float32[224 * 224 + i] = (g - mean[1]) / std[1];
    float32[224 * 224 * 2 + i] = (b - mean[2]) / std[2];
  }

  const input = new ort.Tensor('float32', float32, [1, 3, 224, 224]);

  // Run inference
  const results = await clipSession.run({ input });

  // Extract embedding from output
  const embedding = Array.from(results.output.data as Float32Array);

  return embedding;
}

/**
 * Download CLIP model helper (call this during setup)
 */
export function getClipModelDownloadInstructions(): string {
  return `
To use CLIP embeddings, download the ONNX model:

1. Create models directory:
   mkdir -p models

2. Download CLIP ViT-B/32 ONNX model:
   wget https://huggingface.co/rocm/CLIP-ViT-B-32-laion2B-s34B-b79K/resolve/main/open_clip_pytorch_model.bin
   
   Or use a pre-converted ONNX version:
   wget https://github.com/xenova/transformers.js-examples/raw/main/clip-image-classification/onnx/model.onnx -O models/clip-vit-b32.onnx

3. Set environment variable:
   export CLIP_MODEL_PATH=./models/clip-vit-b32.onnx

Note: Model is ~350MB. For faster processing, use quantized version (~90MB).
`;
}

