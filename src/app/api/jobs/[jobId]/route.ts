import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getPublicUrl } from '@/lib/s3';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const payload = job.payloadJson as any;

    // Processing
    if (job.status === 'processing') {
      return NextResponse.json({
        job_id: job.id,
        status: 'processing',
        started_at: job.startedAt?.toISOString(),
      });
    }

    // Completed
    if (job.status === 'completed') {
      const garment = await prisma.garment.findUnique({
        where: { id: payload.garment_id },
        include: {
          image: true,
          colors: {
            orderBy: { rank: 'asc' },
          },
        },
      });

      return NextResponse.json({
        job_id: job.id,
        status: 'completed',
        result: {
          garment_id: garment?.id,
          garment: garment
            ? {
                id: garment.id,
                name: garment.name,
                category: garment.category,
                subcategory: garment.subcategory,
                image_url: getPublicUrl(garment.image.objectKey),
                colors: garment.colors.map((c) => ({
                  lab_L: c.labL,
                  lab_a: c.labA,
                  lab_b: c.labB,
                  ratio: c.ratio,
                  is_neutral: c.isNeutral,
                  is_accent: c.isAccent,
                })),
                warmth_score: garment.warmthScore,
                auto_detected: garment.autoDetected,
              }
            : null,
        },
        completed_at: job.completedAt?.toISOString(),
      });
    }

    // Needs review (duplicate)
    if (job.status === 'needs_review') {
      return NextResponse.json({
        job_id: job.id,
        status: 'needs_review',
        reason: payload.reason,
        duplicates: payload.duplicates || [],
        actions: {
          merge: '/api/garments/merge',
          keep_both: `/api/jobs/${job.id}/override`,
        },
      });
    }

    // Failed
    if (job.status === 'failed') {
      const error = job.errorJson as any;
      return NextResponse.json(
        {
          job_id: job.id,
          status: 'failed',
          error: error?.message || 'Processing failed',
          attempts: job.attempts,
        },
        { status: 500 }
      );
    }

    // Queued (default)
    return NextResponse.json({
      job_id: job.id,
      status: 'queued',
      created_at: job.createdAt.toISOString(),
    });
  } catch (error: any) {
    logger.error({ error, jobId: params.jobId }, 'Job status request failed');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

