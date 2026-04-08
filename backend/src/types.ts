/** Schéma partagé frontend ↔ backend */

export interface WindData {
  speed: number;      // m/s
  direction: number;  // degrés 0-360
}

export interface VerticalLevel {
  altitude: number;   // m
  temperature: number; // °C
  dewpoint: number;   // °C
  wind: WindData;
  humidity: number;   // %
  cloudCover: number; // 0-1
}

export interface HourlyProfile {
  hour: number;
  levels: VerticalLevel[];
  precipitation: number;      // mm/h
  cloudLow: number;           // 0-1
  cloudMid: number;
  cloudHigh: number;
  surfaceTemp: number;        // °C
  boundaryLayerHeight: number; // m
}

export interface DayForecast {
  date: string; // ISO date string
  profiles: HourlyProfile[]; // index = hour 0-23
}

export interface WeatherData {
  position: { lat: number; lng: number };
  fetchedAt: string; // ISO datetime
  source: string;    // 'arome' | 'mock'
  forecasts: DayForecast[]; // [0]=today, [1]=tomorrow
}

/** Réponse brute Open-Meteo */
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly_units: Record<string, string>;
  hourly: Record<string, (number | null)[]>;
}
