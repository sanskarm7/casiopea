import axios from 'axios';
import NodeCache from 'node-cache';
import { WeatherConditions, WeatherLocation } from './types';
import { computeThermalBand, getUVBand, getDaypart, mapWeatherCode } from './utils';
import logger from '../logger';

const weatherCache = new NodeCache({ stdTTL: 1800 }); // 30 min cache

/**
 * Fetch weather data from Open-Meteo API
 */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherConditions> {
  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = weatherCache.get<WeatherConditions>(cacheKey);
  
  if (cached) {
    logger.info({ lat, lon }, 'Weather cache hit');
    return cached;
  }

  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,relativehumidity_2m,apparent_temperature,precipitation_probability,windspeed_10m,uv_index',
        daily: 'weathercode,sunrise,sunset',
        timezone: 'auto',
        forecast_days: 1,
      },
      timeout: 5000,
    });

    const now = new Date();
    const currentHour = now.getHours();
    const hourly = response.data.hourly;
    const daily = response.data.daily;

    // Find the current hour index
    const idx = hourly.time.findIndex((t: string) => {
      const hourTime = new Date(t);
      return hourTime.getHours() === currentHour;
    });

    if (idx === -1) {
      throw new Error('Could not find current hour in weather data');
    }

    const conditions: WeatherConditions = {
      temperature: hourly.temperature_2m[idx],
      feels_like: hourly.apparent_temperature[idx],
      humidity: hourly.relativehumidity_2m[idx],
      wind_speed: hourly.windspeed_10m[idx],
      precipitation_probability: hourly.precipitation_probability[idx] || 0,
      uv_index: hourly.uv_index[idx] || 0,
      condition: mapWeatherCode(daily.weathercode[0]),
      thermal_band: null as any, // computed below
      is_rainy: false,
      is_windy: false,
      uv_band: 'low',
      daypart: getDaypart(now, daily.sunrise[0], daily.sunset[0]),
    };

    // Compute derived features
    conditions.thermal_band = computeThermalBand(conditions);
    conditions.is_rainy =
      conditions.precipitation_probability > 50 ||
      ['rain', 'drizzle', 'snow'].includes(conditions.condition);
    conditions.is_windy = conditions.wind_speed > 25; // km/h
    conditions.uv_band = getUVBand(conditions.uv_index);

    // Cache the result
    weatherCache.set(cacheKey, conditions);
    
    // Also store as fallback
    weatherCache.set(`fallback:${lat.toFixed(2)}:${lon.toFixed(2)}`, conditions, 86400); // 24h TTL for fallback

    logger.info({ lat, lon, temp: conditions.temperature }, 'Weather fetched successfully');
    return conditions;
  } catch (error) {
    logger.error({ error, lat, lon }, 'Weather fetch failed');

    // Try to use fallback
    const fallback = weatherCache.get<WeatherConditions>(
      `fallback:${lat.toFixed(2)}:${lon.toFixed(2)}`
    );
    
    if (fallback) {
      logger.info({ lat, lon }, 'Using fallback weather data');
      return { ...fallback, _fallback: true };
    }

    // Ultimate fallback: mild weather, prefer layers
    logger.warn({ lat, lon }, 'Using default fallback weather');
    return {
      temperature: 18,
      feels_like: 18,
      humidity: 60,
      wind_speed: 10,
      precipitation_probability: 20,
      uv_index: 3,
      condition: 'cloudy',
      thermal_band: {
        clo_target: 1.0,
        min_warmth: 2,
        max_warmth: 3,
        description: 'Layers recommended',
      },
      is_rainy: false,
      is_windy: false,
      uv_band: 'moderate',
      daypart: 'afternoon',
      _fallback: true,
    };
  }
}

/**
 * Get weather for a user by their stored location
 */
export async function getWeatherForUser(userId: string): Promise<WeatherConditions | null> {
  const { prisma } = await import('../db');
  
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings?.locationLat || !settings?.locationLon) {
    return null;
  }

  return fetchWeather(settings.locationLat, settings.locationLon);
}

/**
 * Clear weather cache
 */
export function clearWeatherCache() {
  weatherCache.flushAll();
}

