import { Worker } from 'bullmq';
import redis from '../lib/redis';
import logger from '../lib/logger';
import { processImage } from './processors/image-processor';

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '4', 10);

// Image Processing Worker
const imageWorker = new Worker(
  'image-processing',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing image job');
    return await processImage(job.data);
  },
  {
    connection: redis,
    concurrency,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

imageWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Job completed');
});

imageWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
});

imageWorker.on('error', (err) => {
  logger.error({ error: err }, 'Worker error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await imageWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await imageWorker.close();
  process.exit(0);
});

logger.info({ concurrency }, 'Worker started');

