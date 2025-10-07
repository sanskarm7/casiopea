import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { getWeatherForUser } from '@/lib/weather';
import logger from '@/lib/logger';

const wearSchema = z.object({
  garment_ids: z.array(z.string().uuid()),
  date: z.string().optional(),
  user_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { garment_ids, date, user_id } = wearSchema.parse(body);

    const userId = user_id || '00000000-0000-0000-0000-000000000000';
    const wornDate = date ? new Date(date) : new Date();

    // Get current weather
    const weather = await getWeatherForUser(userId);

    // Create wear history record
    const wearHistory = await prisma.wearHistory.create({
      data: {
        userId,
        garmentIds: garment_ids,
        dateWorn: wornDate,
        weatherTemp: weather?.temperature,
        weatherCondition: weather?.condition,
        weatherJson: weather as any,
      },
    });

    // Update garments: set last_worn and increment wear_count
    await Promise.all(
      garment_ids.map((id) =>
        prisma.garment.update({
          where: { id },
          data: {
            lastWorn: wornDate,
            wearCount: { increment: 1 },
          },
        })
      )
    );

    logger.info({ wearHistoryId: wearHistory.id, garmentCount: garment_ids.length }, 'Wear recorded');

    // Calculate next available dates
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    const recencyDays = settings?.recencyDays || 7;
    const nextAvailableDate = new Date(wornDate);
    nextAvailableDate.setDate(nextAvailableDate.getDate() + recencyDays);

    const nextAvailableDates = garment_ids.reduce((acc, id) => {
      acc[id] = nextAvailableDate.toISOString();
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
      wear_history_id: wearHistory.id,
      garments_updated: garment_ids,
      next_available_dates: nextAvailableDates,
    });
  } catch (error: any) {
    logger.error({ error }, 'Record wear failed');

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

// Get wear history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || '00000000-0000-0000-0000-000000000000';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const history = await prisma.wearHistory.findMany({
      where: { userId },
      orderBy: { dateWorn: 'desc' },
      take: limit,
    });

    return NextResponse.json({ history });
  } catch (error: any) {
    logger.error({ error }, 'Get wear history failed');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

