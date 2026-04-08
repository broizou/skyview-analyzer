import type { Position, WeatherData, HourlyProfile, VerticalLevel, DayForecast } from '@/types/weather';

// Seeded pseudo-random from position
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateLevel(alt: number, hour: number, rand: () => number, baseTemp: number): VerticalLevel {
  const lapseRate = 6.5; // °C per 1000m
  const diurnalAmplitude = 8;
  const diurnalOffset = Math.sin(((hour - 6) / 24) * Math.PI * 2) * diurnalAmplitude;

  const temperature = baseTemp + diurnalOffset - (alt / 1000) * lapseRate + (rand() - 0.5) * 2;
  const dewpointDelta = 2 + (alt / 1000) * 3 + rand() * 4;
  const dewpoint = temperature - dewpointDelta;

  // Wind increases with altitude, veers
  const baseWindSpeed = 2 + (alt / 1000) * 3 + rand() * 4;
  const thermalBoost = (hour >= 10 && hour <= 16 && alt < 2000) ? rand() * 3 : 0;
  const windSpeed = baseWindSpeed + thermalBoost;
  const windDir = (180 + (alt / 1000) * 20 + rand() * 40 + hour * 3) % 360;

  const humidity = Math.max(20, Math.min(100, 80 - (alt / 1000) * 15 + rand() * 20));
  const cloudCover = humidity > 75 ? (humidity - 75) / 25 : 0;

  return { altitude: alt, temperature, dewpoint, wind: { speed: windSpeed, direction: windDir }, humidity, cloudCover };
}

function generateProfile(hour: number, rand: () => number, baseTemp: number): HourlyProfile {
  const altitudes: number[] = [];
  for (let a = 0; a <= 5000; a += 100) altitudes.push(a);

  const levels = altitudes.map((alt) => generateLevel(alt, hour, rand, baseTemp));

  const isDaytime = hour >= 8 && hour <= 18;
  const precipitation = rand() < 0.15 ? rand() * 5 : 0;
  const cloudLow = isDaytime ? rand() * 0.3 : rand() * 0.5;
  const cloudMid = rand() * 0.4;
  const cloudHigh = rand() * 0.6;

  // Boundary layer height: higher during thermals
  const blh = isDaytime
    ? 800 + Math.sin(((hour - 8) / 10) * Math.PI) * 1500 + rand() * 400
    : 300 + rand() * 200;

  return {
    hour,
    levels,
    precipitation,
    cloudLow,
    cloudMid,
    cloudHigh,
    surfaceTemp: levels[0].temperature,
    boundaryLayerHeight: blh,
  };
}

export function generateWeatherData(position: Position): WeatherData {
  const seed = Math.floor((position.lat * 10000 + position.lng * 100) % 2147483647);
  const rand = seededRandom(Math.abs(seed) + 1);

  const baseTemp = 20 - Math.abs(position.lat - 45) * 0.8 + rand() * 4;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayProfiles: HourlyProfile[] = [];
  const tomorrowProfiles: HourlyProfile[] = [];

  for (let h = 0; h < 24; h++) {
    todayProfiles.push(generateProfile(h, rand, baseTemp));
    tomorrowProfiles.push(generateProfile(h, rand, baseTemp + (rand() - 0.5) * 3));
  }

  return {
    position,
    forecasts: [
      { date: today, profiles: todayProfiles },
      { date: tomorrow, profiles: tomorrowProfiles },
    ],
  };
}

export function convertWindSpeed(speedMs: number, unit: 'km/h' | 'm/s' | 'kt'): number {
  switch (unit) {
    case 'km/h': return Math.round(speedMs * 3.6);
    case 'kt': return Math.round(speedMs * 1.944);
    case 'm/s': return Math.round(speedMs * 10) / 10;
  }
}

export function getWindColor(speedMs: number): string {
  const kmh = speedMs * 3.6;
  if (kmh < 5) return 'hsl(200, 70%, 85%)';
  if (kmh < 15) return 'hsl(140, 60%, 70%)';
  if (kmh < 25) return 'hsl(60, 70%, 65%)';
  if (kmh < 35) return 'hsl(30, 80%, 60%)';
  if (kmh < 50) return 'hsl(10, 80%, 55%)';
  return 'hsl(0, 85%, 45%)';
}

export function getTempColor(temp: number): string {
  if (temp < -10) return 'hsl(240, 70%, 40%)';
  if (temp < 0) return 'hsl(220, 60%, 55%)';
  if (temp < 10) return 'hsl(200, 50%, 65%)';
  if (temp < 20) return 'hsl(60, 60%, 65%)';
  if (temp < 30) return 'hsl(30, 70%, 55%)';
  return 'hsl(0, 70%, 50%)';
}
