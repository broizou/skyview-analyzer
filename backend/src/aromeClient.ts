/**
 * Client Open-Meteo → données AROME HD pour un point géographique.
 *
 * Open-Meteo expose le modèle AROME de Météo-France :
 *   - meteofrance_arome_france_hd  (1.3 km, variables de surface)
 *   - meteofrance_arome_france     (2.5 km, niveaux de pression + surface)
 *
 * Pour le profil vertical complet (windgram / émagramme) on a besoin des
 * niveaux de pression → on utilise meteofrance_arome_france (2.5 km) qui
 * couvre aussi les niveaux de pression standard.
 *
 * Niveaux de pression retenus (couvrent 0 → ~5500 m) :
 *   1000, 950, 925, 850, 800, 700, 600, 500 hPa
 */

import type { OpenMeteoResponse } from './types.js';

// Niveaux de pression demandés (hPa), du plus bas au plus haut en altitude
export const PRESSURE_LEVELS = [1000, 950, 925, 850, 800, 700, 600, 500] as const;

const LEVEL_VARS = [
  'temperature',         // °C
  'geopotential_height', // m (altitude géopotentielle ≈ altitude géométrique)
  'windspeed',           // m/s (grâce à wind_speed_unit=ms)
  'winddirection',       // degrés
  'relative_humidity',   // %
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

export async function fetchAromeData(
  lat: number,
  lng: number,
): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    hourly: `${SURFACE_VARS},${buildPressureVarList()}`,
    models: 'meteofrance_arome_france',
    forecast_days: '2',
    timezone: 'Europe/Paris',
    wind_speed_unit: 'ms',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Open-Meteo HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<OpenMeteoResponse>;
}
