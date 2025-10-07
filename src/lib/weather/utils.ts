import { WeatherConditions, ThermalBand } from './types';

/**
 * Compute thermal band based on temperature, humidity, and wind
 */
export function computeThermalBand(conditions: WeatherConditions): ThermalBand {
  let effectiveTemp = conditions.temperature;

  // Heat Index (for temperatures > 20°C)
  if (conditions.temperature > 20) {
    effectiveTemp = calculateHeatIndex(conditions.temperature, conditions.humidity);
  }

  // Wind Chill (for temperatures < 10°C and wind > 5 km/h)
  if (conditions.temperature < 10 && conditions.wind_speed > 5) {
    effectiveTemp = calculateWindChill(conditions.temperature, conditions.wind_speed);
  }

  // Map to CLO (clothing insulation) and warmth scale
  if (effectiveTemp < 0) {
    return {
      clo_target: 2.5,
      min_warmth: 5,
      max_warmth: 5,
      description: 'Heavy winter clothing required',
    };
  } else if (effectiveTemp < 5) {
    return {
      clo_target: 2.0,
      min_warmth: 4,
      max_warmth: 5,
      description: 'Winter jacket, layers, gloves',
    };
  } else if (effectiveTemp < 10) {
    return {
      clo_target: 1.5,
      min_warmth: 3,
      max_warmth: 4,
      description: 'Jacket or heavy sweater',
    };
  } else if (effectiveTemp < 15) {
    return {
      clo_target: 1.0,
      min_warmth: 2,
      max_warmth: 3,
      description: 'Light jacket or long sleeves',
    };
  } else if (effectiveTemp < 20) {
    return {
      clo_target: 0.7,
      min_warmth: 2,
      max_warmth: 3,
      description: 'Long sleeves or light layers',
    };
  } else if (effectiveTemp < 25) {
    return {
      clo_target: 0.5,
      min_warmth: 1,
      max_warmth: 2,
      description: 'T-shirt and light pants',
    };
  } else if (effectiveTemp < 30) {
    return {
      clo_target: 0.35,
      min_warmth: 1,
      max_warmth: 1,
      description: 'Light, breathable clothing',
    };
  } else {
    return {
      clo_target: 0.25,
      min_warmth: 1,
      max_warmth: 1,
      description: 'Minimal, loose clothing',
    };
  }
}

/**
 * Calculate Heat Index (feels like temperature in hot weather)
 * Uses simplified Rothfusz equation
 */
export function calculateHeatIndex(tempC: number, humidity: number): number {
  const T = tempC;
  const RH = humidity;

  // Simplified Rothfusz equation
  const HI =
    -8.78469475556 +
    1.61139411 * T +
    2.33854883889 * RH +
    -0.14611605 * T * RH +
    -0.012308094 * T ** 2 +
    -0.0164248277778 * RH ** 2 +
    0.002211732 * T ** 2 * RH +
    0.00072546 * T * RH ** 2 +
    -0.000003582 * T ** 2 * RH ** 2;

  return HI;
}

/**
 * Calculate Wind Chill (feels like temperature in cold, windy weather)
 */
export function calculateWindChill(tempC: number, windSpeedKmh: number): number {
  const T = tempC;
  const V = windSpeedKmh;

  // Wind Chill formula (metric)
  const WC =
    13.12 + 0.6215 * T - 11.37 * Math.pow(V, 0.16) + 0.3965 * T * Math.pow(V, 0.16);

  return WC;
}

/**
 * Get UV index band
 */
export function getUVBand(uvIndex: number): 'low' | 'moderate' | 'high' | 'very_high' {
  if (uvIndex < 3) return 'low';
  if (uvIndex < 6) return 'moderate';
  if (uvIndex < 8) return 'high';
  return 'very_high';
}

/**
 * Determine daypart based on current time and sunrise/sunset
 */
export function getDaypart(
  now: Date,
  sunrise: string,
  sunset: string
): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = now.getHours();
  const sunriseHour = new Date(sunrise).getHours();
  const sunsetHour = new Date(sunset).getHours();

  if (hour < sunriseHour || hour >= 22) return 'night';
  if (hour < 12) return 'morning';
  if (hour < sunsetHour) return 'afternoon';
  return 'evening';
}

/**
 * Map Open-Meteo weather codes to simple conditions
 */
export function mapWeatherCode(code: number): string {
  const codeMap: Record<number, string> = {
    0: 'clear',
    1: 'mostly_clear',
    2: 'partly_cloudy',
    3: 'cloudy',
    45: 'foggy',
    48: 'foggy',
    51: 'drizzle',
    53: 'drizzle',
    55: 'drizzle',
    61: 'rain',
    63: 'rain',
    65: 'rain',
    71: 'snow',
    73: 'snow',
    75: 'snow',
    77: 'snow',
    80: 'rain',
    81: 'rain',
    82: 'rain',
    85: 'snow',
    86: 'snow',
    95: 'thunderstorm',
    96: 'thunderstorm',
    99: 'thunderstorm',
  };

  return codeMap[code] || 'unknown';
}

