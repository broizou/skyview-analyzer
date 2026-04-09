/**
 * Fetch Open-Meteo → modèle AROME Météo-France.
 *
 * Appelé directement depuis le navigateur (API publique, CORS autorisé).
 *
 * Modèle utilisé : meteofrance_arome_france (2.5 km)
 *   → couvre les niveaux de pression nécessaires au profil vertical complet.
 *
 * Niveaux de pression (0 → ~5500 m) :
 *   1000, 950, 925, 850, 800, 700, 600, 500 hPa
 */

export const PRESSURE_LEVELS = [1000, 950, 925, 850, 800, 700, 600, 500] as const;

const LEVEL_VARS = [
  'temperature',
  'geopotential_height',
  'windspeed',
  'winddirection',
  'relative_humidity',
] as const;

const SURFACE_VARS = [
  'temperature_2m',
  'dewpoint_2m',
  'precipitation',
  'cloudcover_low',
  'cloudcover_mid',
  'cloudcover_high',
  'boundary_layer_height',
].join(',');

function buildPressureVarList(): string {
  return PRESSURE_LEVELS.flatMap((p) =>
    LEVEL_VARS.map((v) => `${v}_${p}hPa`),
  ).join(',');
}

export interface OpenMeteoHourly {
  time: string[];
  [key: string]: (number | null)[] | string[];
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: OpenMeteoHourly;
}

export async function fetchAromeData(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude:        lat.toFixed(4),
    longitude:       lng.toFixed(4),
    hourly:          `${SURFACE_VARS},${buildPressureVarList()}`,
    models:          'meteofrance_arome_france',
    forecast_days:   '2',
    timezone:        'Europe/Paris',
    wind_speed_unit: 'ms',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  // Utilise le signal externe (annulation) ou un timeout de 20 s par défaut
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(20_000) });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Open-Meteo ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}
