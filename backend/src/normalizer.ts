/**
 * Normalise la réponse brute Open-Meteo en WeatherData.
 *
 * Pipeline :
 *  1. Extraire les séries horaires (48 h = aujourd'hui + demain)
 *  2. Pour chaque heure, construire le profil vertical :
 *     a. Lire les valeurs aux niveaux de pression disponibles
 *     b. Convertir en altitude via geopotential_height (m)
 *     c. Interpoler linéairement vers une grille de 100 m en 100 m (0-5000 m)
 *     d. Calculer le point de rosée depuis T + HR (formule Magnus)
 *  3. Grouper par jour (heures 0-23 pour J, 0-23 pour J+1)
 */

import { PRESSURE_LEVELS } from './aromeClient.js';
import type { OpenMeteoResponse, WeatherData, HourlyProfile, VerticalLevel } from './types.js';

const TARGET_ALTITUDES = Array.from({ length: 51 }, (_, i) => i * 100); // 0 → 5000 m

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Dewpoint via formule de Magnus inversée (T en °C, rh en %) */
function dewpoint(tempC: number, rh: number): number {
  const a = 17.625, b = 243.04;
  const alpha = Math.log(Math.max(rh, 1) / 100) + (a * tempC) / (b + tempC);
  return (b * alpha) / (a - alpha);
}

/** Interpolation linéaire scalaire */
function lerp(x0: number, x1: number, y0: number, y1: number, x: number): number {
  if (x1 === x0) return y0;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/** Interpolation circulaire de direction de vent (gère la frontière 0°/360°) */
function lerpDir(d0: number, d1: number, t: number): number {
  let diff = d1 - d0;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (d0 + diff * t + 360) % 360;
}

/**
 * Interpole un tableau de valeurs (altitudes croissantes) vers TARGET_ALTITUDES.
 * Extrapolation plate aux extrémités.
 */
function interpolateToGrid(
  alts: number[],
  vals: number[],
): number[] {
  return TARGET_ALTITUDES.map((target) => {
    if (target <= alts[0]) return vals[0];
    if (target >= alts[alts.length - 1]) return vals[alts.length - 1];
    const hi = alts.findIndex((a) => a >= target);
    const lo = hi - 1;
    return lerp(alts[lo], alts[hi], vals[lo], vals[hi], target);
  });
}

/** Interpolation circulaire pour les directions de vent */
function interpolateDirToGrid(
  alts: number[],
  dirs: number[],
): number[] {
  return TARGET_ALTITUDES.map((target) => {
    if (target <= alts[0]) return dirs[0];
    if (target >= alts[alts.length - 1]) return dirs[alts.length - 1];
    const hi = alts.findIndex((a) => a >= target);
    const lo = hi - 1;
    const t = (target - alts[lo]) / (alts[hi] - alts[lo]);
    return lerpDir(dirs[lo], dirs[hi], t);
  });
}

function getHourly(h: Record<string, (number | null)[]>, key: string, idx: number): number {
  return h[key]?.[idx] ?? 0;
}

// ── Profil vertical pour une heure donnée ────────────────────────────────────

function buildProfile(
  hourlyData: Record<string, (number | null)[]>,
  idx: number, // index dans le tableau (0-47)
  hour: number, // heure locale (0-23)
): HourlyProfile {
  // Récupérer les données par niveau de pression
  // On part du niveau le plus élevé en altitude (500 hPa) vers le plus bas (1000 hPa)
  // mais Open-Meteo ordonne du plus bas (1000 hPa = altitude basse) au plus haut
  // → les altitudes croissent à mesure que la pression décroît

  const levelAlts: number[] = [];
  const levelTemps: number[] = [];
  const levelRH: number[] = [];
  const levelWspd: number[] = [];
  const levelWdir: number[] = [];

  for (const p of [...PRESSURE_LEVELS].reverse()) { // 500 → 1000 hPa, altitude décroissante
    const geopKey = `geopotential_height_${p}hPa`;
    const tKey    = `temperature_${p}hPa`;
    const rhKey   = `relative_humidity_${p}hPa`;
    const wsKey   = `windspeed_${p}hPa`;
    const wdKey   = `winddirection_${p}hPa`;

    const alt = getHourly(hourlyData, geopKey, idx);
    if (alt === 0 && p === 1000) {
      // 1000 hPa peut être sous le sol — on exclut si altitude négative
    }
    levelAlts.push(alt);
    levelTemps.push(getHourly(hourlyData, tKey, idx));
    levelRH.push(getHourly(hourlyData, rhKey, idx));
    levelWspd.push(getHourly(hourlyData, wsKey, idx));
    levelWdir.push(getHourly(hourlyData, wdKey, idx));
  }

  // Trier par altitude croissante (on a inversé, donc on re-trie)
  const order = levelAlts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a - y.a);
  const sortedAlts  = order.map((o) => o.a);
  const sortedTemps = order.map((o) => levelTemps[o.i]);
  const sortedRH    = order.map((o) => levelRH[o.i]);
  const sortedWspd  = order.map((o) => levelWspd[o.i]);
  const sortedWdir  = order.map((o) => levelWdir[o.i]);

  // Interpolation vers grille 100 m
  const gridTemps = interpolateToGrid(sortedAlts, sortedTemps);
  const gridRH    = interpolateToGrid(sortedAlts, sortedRH);
  const gridWspd  = interpolateToGrid(sortedAlts, sortedWspd);
  const gridWdir  = interpolateDirToGrid(sortedAlts, sortedWdir);

  // Construction des niveaux
  const levels: VerticalLevel[] = TARGET_ALTITUDES.map((alt, ai) => {
    const temp = gridTemps[ai];
    const rh   = Math.min(100, Math.max(0, gridRH[ai]));
    return {
      altitude: alt,
      temperature: temp,
      dewpoint: dewpoint(temp, rh),
      wind: { speed: gridWspd[ai], direction: gridWdir[ai] },
      humidity: rh,
      cloudCover: rh > 75 ? (rh - 75) / 25 : 0,
    };
  });

  // Surface
  const surfaceTemp = getHourly(hourlyData, 'temperature_2m', idx);
  const blh         = Math.max(50, getHourly(hourlyData, 'boundary_layer_height', idx));

  return {
    hour,
    levels,
    precipitation: getHourly(hourlyData, 'precipitation', idx),
    cloudLow:  getHourly(hourlyData, 'cloudcover_low',  idx) / 100,
    cloudMid:  getHourly(hourlyData, 'cloudcover_mid',  idx) / 100,
    cloudHigh: getHourly(hourlyData, 'cloudcover_high', idx) / 100,
    surfaceTemp,
    boundaryLayerHeight: blh,
  };
}

// ── Entrée publique ───────────────────────────────────────────────────────────

export function normalize(
  raw: OpenMeteoResponse,
  lat: number,
  lng: number,
): WeatherData {
  const times = raw.hourly['time'] as unknown as string[];

  // Grouper les indices par date locale (YYYY-MM-DD)
  const byDate = new Map<string, number[]>();
  times.forEach((t, idx) => {
    const date = t.split('T')[0]; // "2024-06-15"
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(idx);
  });

  const dates = [...byDate.keys()].sort().slice(0, 2); // today + tomorrow

  const forecasts = dates.map((date) => {
    const indices = byDate.get(date)!;
    // Construire 24 profils (un par heure 0-23)
    // Les indices peuvent ne pas couvrir toutes les heures si le modèle démarre en cours de journée
    const profilesByHour = new Map<number, HourlyProfile>();
    indices.forEach((idx) => {
      const timeStr = times[idx]; // "2024-06-15T14:00"
      const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
      profilesByHour.set(hour, buildProfile(raw.hourly, idx, hour));
    });

    // S'assurer qu'on a bien 24 profils (copier le voisin si manquant)
    const profiles: HourlyProfile[] = [];
    for (let h = 0; h < 24; h++) {
      if (profilesByHour.has(h)) {
        profiles.push(profilesByHour.get(h)!);
      } else {
        // Copier le profil le plus proche disponible
        const nearest = [...profilesByHour.entries()].sort(
          (a, b) => Math.abs(a[0] - h) - Math.abs(b[0] - h),
        )[0];
        profiles.push({ ...nearest[1], hour: h });
      }
    }

    return { date, profiles };
  });

  return {
    position: { lat, lng },
    fetchedAt: new Date().toISOString(),
    source: 'arome',
    forecasts,
  };
}
