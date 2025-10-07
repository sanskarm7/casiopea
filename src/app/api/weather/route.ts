import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchWeather } from '@/lib/weather';
import logger from '@/lib/logger';

const weatherSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Missing lat or lon parameters' },
        { status: 400 }
      );
    }

    const { lat: latitude, lon: longitude } = weatherSchema.parse({ lat, lon });

    const weather = await fetchWeather(latitude, longitude);

    return NextResponse.json({
      location: {
        lat: latitude,
        lon: longitude,
      },
      current: {
        temperature: weather.temperature,
        feels_like: weather.feels_like,
        humidity: weather.humidity,
        wind_speed: weather.wind_speed,
        condition: weather.condition,
        uv_index: weather.uv_index,
      },
      derived: {
        thermal_band: weather.thermal_band,
        is_rainy: weather.is_rainy,
        is_windy: weather.is_windy,
        uv_band: weather.uv_band,
        daypart: weather.daypart,
      },
      _fallback: weather._fallback,
    });
  } catch (error: any) {
    logger.error({ error }, 'Weather request failed');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid coordinates', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch weather' },
      { status: 500 }
    );
  }
}

