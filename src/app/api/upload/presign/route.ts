import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPresignedUploadUrl } from '@/lib/s3';
import { generateId } from '@/lib/utils';
import logger from '@/lib/logger';

const presignSchema = z.object({
  filename: z.string(),
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.number().max(10 * 1024 * 1024), // 10MB max
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, content_type, size_bytes } = presignSchema.parse(body);

    // Generate unique upload ID
    const uploadId = generateId();
    const key = `uploads/raw/${uploadId}.${content_type.split('/')[1]}`;

    // Create presigned URL
    const { url, fields } = await createPresignedUploadUrl(
      key,
      content_type,
      size_bytes
    );

    logger.info({ uploadId, filename, size_bytes }, 'Presigned URL generated');

    return NextResponse.json({
      upload_id: uploadId,
      upload_url: url,
      fields,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    logger.error({ error }, 'Presign request failed');

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

