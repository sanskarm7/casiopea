import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import logger from '@/lib/logger';

const updateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  warmth_score: z.number().min(1).max(5).optional(),
  formality_score: z.number().min(1).max(5).optional(),
  water_resistant: z.boolean().optional(),
  wind_resistant: z.boolean().optional(),
  uv_protective: z.boolean().optional(),
  has_pattern: z.boolean().optional(),
  pattern_type: z.string().optional(),
  pattern_intensity: z.string().optional(),
  season: z.string().optional(),
  is_available: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { garmentId: string } }
) {
  try {
    const { garmentId } = params;
    const body = await request.json();
    const updates = updateSchema.parse(body);

    const garment = await prisma.garment.update({
      where: { id: garmentId },
      data: {
        ...updates,
        autoDetected: false, // User has edited, mark as not auto-detected
      },
      include: {
        image: true,
        colors: { orderBy: { rank: 'asc' } },
      },
    });

    logger.info({ garmentId, updates }, 'Garment updated');

    return NextResponse.json({ garment });
  } catch (error: any) {
    logger.error({ error, garmentId: params.garmentId }, 'Update garment failed');

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { garmentId: string } }
) {
  try {
    const { garmentId } = params;

    await prisma.garment.delete({
      where: { id: garmentId },
    });

    logger.info({ garmentId }, 'Garment deleted');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error({ error, garmentId: params.garmentId }, 'Delete garment failed');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

