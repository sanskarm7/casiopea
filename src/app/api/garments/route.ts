import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getPublicUrl } from '@/lib/s3';
import { labToHex } from '@/lib/color/extraction';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || '00000000-0000-0000-0000-000000000000';
    const category = searchParams.get('category');

    const garments = await prisma.garment.findMany({
      where: {
        userId,
        ...(category && { category }),
      },
      include: {
        image: true,
        colors: {
          orderBy: { rank: 'asc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = garments.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      subcategory: g.subcategory,
      image_url: getPublicUrl(g.image.objectKey),
      thumbnail_url: getPublicUrl(g.image.objectKey),
      colors: g.colors.map((c) => ({
        hex: labToHex(c.labL, c.labA, c.labB),
        lab_L: c.labL,
        lab_a: c.labA,
        lab_b: c.labB,
        ratio: c.ratio,
        is_neutral: c.isNeutral,
        is_accent: c.isAccent,
      })),
      warmth_score: g.warmthScore,
      formality_score: g.formalityScore,
      last_worn: g.lastWorn?.toISOString(),
      wear_count: g.wearCount,
      is_available: g.isAvailable,
      auto_detected: g.autoDetected,
    }));

    return NextResponse.json({ garments: formatted });
  } catch (error: any) {
    console.error('Get garments failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

