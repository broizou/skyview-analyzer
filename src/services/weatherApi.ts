/**
 * Appelle le backend AROME pour récupérer les données réelles.
 * Repli automatique sur les données mock si le backend n'est pas joignable.
 */

import type { WeatherData } from '@/types/weather';
import { generateWeatherData } from './mockWeatherData';

// En développement : VITE_API_URL=http://localhost:3001
// En production : pointer vers l'URL de déploiement du backend
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function fetchWeatherData(
  lat: number,
  lng: number,
): Promise<WeatherData> {
  const url = `${API_BASE}/api/weather?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);

  // Le backend renvoie un WeatherData dont les dates sont des strings ISO
  // → convertir les dates en objets Date attendus par le frontend
  const json = await res.json();
  return adaptBackendResponse(json);
}

/** Adapter le schéma backend (date = string) → schéma frontend (date = Date) */
function adaptBackendResponse(json: {
  position: { lat: number; lng: number };
  forecasts: Array<{ date: string; profiles: WeatherData['forecasts'][0]['profiles'] }>;
}): WeatherData {
  return {
    position: json.position,
    forecasts: json.forecasts.map((f) => ({
      date: new Date(f.date),
      profiles: f.profiles,
    })),
  };
}

/**
 * Tente le backend, repli silencieux sur le mock.
 * À utiliser dans le store pour ne jamais bloquer l'UI.
 */
export async function fetchWeatherDataWithFallback(
  lat: number,
  lng: number,
): Promise<{ data: WeatherData; source: 'arome' | 'mock' }> {
  try {
    const data = await fetchWeatherData(lat, lng);
    return { data, source: 'arome' };
  } catch (err) {
    console.warn('[weatherApi] Backend indisponible, données mock utilisées :', err);
    return { data: generateWeatherData({ lat, lng }), source: 'mock' };
  }
}
