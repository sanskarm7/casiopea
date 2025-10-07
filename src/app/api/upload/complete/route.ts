import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { imageQueue } from '@/lib/queue';
import logger from '@/lib/logger';

const completeSchema = z.object({
  upload_id: z.string().uuid(),
  object_key: z.string(),
  checksum_sha256: z.string(),
  user_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { upload_id, object_key, checksum_sha256, user_id } =
      completeSchema.parse(body);

    // For MVP, use a default user if not provided
    // In production, extract from auth session
    const userId = user_id || '00000000-0000-0000-0000-000000000000';

    // Check idempotency: has this checksum been processed before?
    const existing = await prisma.job.findFirst({
      where: {
        checksum: checksum_sha256,
        status: { in: ['completed', 'processing'] },
      },
    });

    if (existing) {
      logger.info({ jobId: existing.id, checksum: checksum_sha256 }, 'Job already exists');

      if (existing.status === 'completed') {
        const payload = existing.payloadJson as any;
        return NextResponse.json({
          job_id: existing.id,
          status: 'completed',
          garment_id: payload?.garment_id,
        });
      }

      return NextResponse.json({
        job_id: existing.id,
        status: 'processing',
        poll_url: `/api/jobs/${existing.id}`,
      });
    }

    // Create new job record
    const job = await prisma.job.create({
      data: {
        id: upload_id,
        userId,
        kind: 'PROCESS_IMAGE',
        status: 'queued',
        checksum: checksum_sha256,
        payloadJson: {
          object_key,
        },
      },
    });

    // Enqueue processing job
    await imageQueue.add('PROCESS_IMAGE', {
      upload_id,
      object_key,
      checksum: checksum_sha256,
      user_id: userId,
    });

    logger.info({ jobId: job.id, userId }, 'Image processing job enqueued');

    return NextResponse.json(
      {
        job_id: job.id,
        status: 'queued',
        poll_url: `/api/jobs/${job.id}`,
        estimated_seconds: 15,
      },
      { status: 202 }
    );
  } catch (error: any) {
    logger.error({ error }, 'Upload complete request failed');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

