import pino from 'pino';

// Simplified logger that works with Next.js API routes
// pino-pretty causes issues in serverless/edge environments
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  browser: {
    asObject: true,
  },
  // Only use pino-pretty in worker (not in API routes)
  ...(process.env.WORKER_MODE === 'true' && process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export default logger;

