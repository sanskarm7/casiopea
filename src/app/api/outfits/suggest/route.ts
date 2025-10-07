import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOutfits } from '@/lib/outfit';
import { getWeatherForUser, fetchWeather } from '@/lib/weather';
import { getPublicUrl } from '@/lib/s3';
import logger from '@/lib/logger';
import prisma from '@/lib/db';

const suggestSchema = z.object({
  date: z.string().optional(),
  override_recency: z.boolean().optional(),
  count: z.number().min(1).max(20).optional(),
  user_id: z.string().uuid().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, override_recency, count, user_id, lat, lon } =
      suggestSchema.parse(body);

    // For MVP, use default user if not provided
    const userId = user_id || '00000000-0000-0000-0000-000000000000';
    const requestDate = date ? new Date(date) : new Date();

    // Get weather
    let weather;
    if (lat && lon) {
      weather = await fetchWeather(lat, lon);
    } else {
      weather = await getWeatherForUser(userId);
      if (!weather) {
        return NextResponse.json(
          { error: 'No location set for user' },
          { status: 400 }
        );
      }
    }

    // Generate outfits
    const outfits = await generateOutfits({
      user_id: userId,
      date: requestDate,
      weather,
      override_recency: override_recency || false,
      count: count || 10,
    });

    // Format response
    const formatted = outfits.map((outfit) => {
      const garments: any = {};
      
      if (outfit.top) {
        garments.top = {
          id: outfit.top.id,
          name: outfit.top.name,
          image_url: outfit.top.imageId ? getPublicUrl((outfit.top as any).image?.objectKey || `uploads/processed/${outfit.top.id}.webp`) : null,
          category: outfit.top.category,
        };
      }

      if (outfit.bottom) {
        garments.bottom = {
          id: outfit.bottom.id,
          name: outfit.bottom.name,
          image_url: outfit.bottom.imageId ? getPublicUrl((outfit.bottom as any).image?.objectKey || `uploads/processed/${outfit.bottom.id}.webp`) : null,
          category: outfit.bottom.category,
        };
      }

      if (outfit.dress) {
        garments.dress = {
          id: outfit.dress.id,
          name: outfit.dress.name,
          image_url: outfit.dress.imageId ? getPublicUrl((outfit.dress as any).image?.objectKey || `uploads/processed/${outfit.dress.id}.webp`) : null,
          category: outfit.dress.category,
        };
      }

      if (outfit.footwear) {
        garments.footwear = {
          id: outfit.footwear.id,
          name: outfit.footwear.name,
          image_url: outfit.footwear.imageId ? getPublicUrl((outfit.footwear as any).image?.objectKey || `uploads/processed/${outfit.footwear.id}.webp`) : null,
          category: outfit.footwear.category,
        };
      }

      if (outfit.outerwear) {
        garments.outerwear = {
          id: outfit.outerwear.id,
          name: outfit.outerwear.name,
          image_url: outfit.outerwear.imageId ? getPublicUrl((outfit.outerwear as any).image?.objectKey || `uploads/processed/${outfit.outerwear.id}.webp`) : null,
          category: outfit.outerwear.category,
        };
      }

      return {
        id: `temp-${Math.random().toString(36).substr(2, 9)}`,
        score: outfit.score,
        score_breakdown: outfit.breakdown,
        color_harmony_type: outfit.colorHarmonyType,
        ...garments,
      };
    });

    return NextResponse.json({
      weather: {
        temperature: weather.temperature,
        feels_like: weather.feels_like,
        condition: weather.condition,
        is_rainy: weather.is_rainy,
        thermal_band: weather.thermal_band,
      },
      outfits: formatted,
    });
  } catch (error: any) {
    logger.error({ error }, 'Outfit suggestion request failed');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

