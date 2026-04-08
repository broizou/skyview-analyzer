export interface Position {
  lat: number;
  lng: number;
}

export interface WindData {
  speed: number; // m/s internally
  direction: number; // degrees 0-360
}

export interface VerticalLevel {
  altitude: number; // meters
  temperature: number; // °C
  dewpoint: number; // °C
  wind: WindData;
  humidity: number; // %
  cloudCover: number; // 0-1
}

export interface HourlyProfile {
  hour: number; // 0-23
  levels: VerticalLevel[];
  precipitation: number; // mm/h
  cloudLow: number; // 0-1
  cloudMid: number; // 0-1
  cloudHigh: number; // 0-1
  surfaceTemp: number;
  boundaryLayerHeight: number; // meters
}

export interface DayForecast {
  date: Date;
  profiles: HourlyProfile[];
}

export interface WeatherData {
  position: Position;
  forecasts: DayForecast[];
}

export type WindUnit = 'km/h' | 'm/s' | 'kt';
export type WeatherLayer = 'wind' | 'temperature' | 'clouds' | 'precipitation';
export type DaySelection = 'today' | 'tomorrow';
