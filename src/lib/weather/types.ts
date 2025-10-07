export interface WeatherConditions {
  temperature: number; // °C
  feels_like: number;
  humidity: number; // %
  wind_speed: number; // km/h
  precipitation_probability: number; // %
  uv_index: number;
  condition: string;
  thermal_band: ThermalBand;
  is_rainy: boolean;
  is_windy: boolean;
  uv_band: 'low' | 'moderate' | 'high' | 'very_high';
  daypart: 'morning' | 'afternoon' | 'evening' | 'night';
  _fallback?: boolean;
}

export interface ThermalBand {
  clo_target: number; // Clothing insulation value
  min_warmth: number; // 1-5 scale
  max_warmth: number;
  description: string;
}

export interface WeatherLocation {
  lat: number;
  lon: number;
  name?: string;
}

