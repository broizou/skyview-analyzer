/**
 * Convertit la réponse Open-Meteo en WeatherData.
 *
 * Pipeline :
 *  1. Extraire les 48 séries horaires (aujourd'hui + demain)
 *  2. Pour chaque heure :
 *     a. Lire les 8 niveaux de pression
 *     b. Convertir via geopotential_height → altitude m
 *     c. Interpoler linéairement vers grille 0-5000 m par 100 m
 *     d. Dewpoint (niveaux) calculé via Magnus(T, RH)
 *  3. Grouper par jour local
 */

import type { WeatherData, HourlyProfile, VerticalLevel } from '@/types/weather';
import { PRESSURE_LEVELS, type OpenMeteoResponse } from './aromeClient';

const TARGET_ALTITUDES = Array.from({ length: 51 }, (_, i) => i * 100); // 0→5000 m

// ── Helpers mathématiques ─────────────────────────────────────────────────────

function dewpointMagnus(tempC: number, rh: number): number {
  const a = 17.625, b = 243.04;
  const alpha = Math.log(Math.max(rh, 0.1) / 100) + (a * tempC) / (b + tempC);
  return (b * alpha) / (a - alpha);
}

function lerp(x0: number, x1: number, y0: number, y1: number, x: number): number {
  if (x1 === x0) return y0;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

function lerpDir(d0: number, d1: number, t: number): number {
  let diff = d1 - d0;
  if (diff >  180) diff -= 360;
  if (diff < -180) diff += 360;
  return (d0 + diff * t + 360) % 360;
}

function interpolateScalar(alts: number[], vals: number[], target: number): number {
  if (target <= alts[0]) return vals[0];
  if (target >= alts[alts.length - 1]) return vals[alts.length - 1];
  const hi = alts.findIndex((a) => a >= target);
  return lerp(alts[hi - 1], alts[hi], vals[hi - 1], vals[hi], target);
}

function interpolateDirection(alts: number[], dirs: number[], target: number): number {
  if (target <= alts[0]) return dirs[0];
  if (target >= alts[alts.length - 1]) return dirs[alts.length - 1];
  const hi = alts.findIndex((a) => a >= target);
  const t = (target - alts[hi - 1]) / (alts[hi] - alts[hi - 1]);
  return lerpDir(dirs[hi - 1], dirs[hi], t);
}

function val(
  hourly: Record<string, (number | null)[] | string[]>,
  key: string,
  idx: number,
): number {
  const arr = hourly[key] as (number | null)[];
  return arr?.[idx] ?? 0;
}

// ── Plafond thermique (méthode sondage + adiabatique sèche) ──────────────────
//
// Altitude où un parcel partant de la surface (T_s à z_sfc) refroidi à 9.8 °C/km
// devient plus froid que l'environnement → il cesse d'être porteur.
// C'est la même méthode que Windy, et elle dépasse souvent la BLH météo.
function calcThermalCeiling(
  levels: VerticalLevel[],
  T_surface: number,
  z_sfc: number,
): number {
  const DALR = 9.8 / 1000; // °C par mètre
  let ceiling = z_sfc;
  for (const level of levels) {
    if (level.altitude <= z_sfc) continue;
    const T_parcel = T_surface - DALR * (level.altitude - z_sfc);
    if (T_parcel <= level.temperature) break;
    ceiling = level.altitude;
  }
  return Math.max(ceiling, z_sfc + 50);
}

// ── Profil vertical pour un index temporel donné ──────────────────────────────

function buildVerticalProfile(
  hourly: Record<string, (number | null)[] | string[]>,
  idx: number,
): VerticalLevel[] {
  // Collecter les valeurs par niveau de pression
  const raw = [...PRESSURE_LEVELS].map((p) => ({
    alt:  val(hourly, `geopotential_height_${p}hPa`, idx),
    temp: val(hourly, `temperature_${p}hPa`, idx),
    rh:   Math.min(100, Math.max(0, val(hourly, `relative_humidity_${p}hPa`, idx))),
    wspd: val(hourly, `windspeed_${p}hPa`, idx),
    wdir: val(hourly, `winddirection_${p}hPa`, idx),
  }));

  // Trier par altitude croissante (les niveaux de pression décroissants donnent des altitudes croissantes)
  const pressureSorted = raw.filter((r) => r.alt > 0).sort((a, b) => a.alt - b.alt);

  // Ancrer le profil avec le vent de surface (10 m) — évite que les basses
  // altitudes soient extrapolées depuis le premier niveau de pression (~500 m
  // pour un terrain à 200 m d'altitude comme Grenoble).
  const surf10m = {
    alt:  10,
    temp: val(hourly, 'temperature_2m', idx),
    rh:   50, // non critique pour le vent
    wspd: val(hourly, 'windspeed_10m', idx),
    wdir: val(hourly, 'winddirection_10m', idx),
  };
  // N'insérer que si aucun niveau de pression n'est déjà sous 50 m
  const sorted = (pressureSorted[0]?.alt ?? Infinity) > 50
    ? [surf10m, ...pressureSorted]
    : pressureSorted;
  if (sorted.length < 2) return TARGET_ALTITUDES.map((altitude) => ({
    altitude, temperature: 15, dewpoint: 5,
    wind: { speed: 0, direction: 0 }, humidity: 50, cloudCover: 0,
  }));

  const alts  = sorted.map((r) => r.alt);
  const temps = sorted.map((r) => r.temp);
  const rhs   = sorted.map((r) => r.rh);
  const wspds = sorted.map((r) => r.wspd);
  const wdirs = sorted.map((r) => r.wdir);

  return TARGET_ALTITUDES.map((altitude) => {
    const temperature = interpolateScalar(alts, temps, altitude);
    const humidity    = Math.min(100, Math.max(0, interpolateScalar(alts, rhs, altitude)));
    const speed       = Math.max(0, interpolateScalar(alts, wspds, altitude));
    const direction   = interpolateDirection(alts, wdirs, altitude);
    return {
      altitude,
      temperature,
      dewpoint: dewpointMagnus(temperature, humidity),
      wind: { speed, direction },
      humidity,
      cloudCover: humidity > 75 ? (humidity - 75) / 25 : 0,
    };
  });
}

function buildHourlyProfile(
  hourly: Record<string, (number | null)[] | string[]>,
  idx: number,
  hour: number,
  z_sfc: number,
): HourlyProfile {
  const T_surface = val(hourly, 'temperature_2m', idx);
  const levels    = buildVerticalProfile(hourly, idx);
  const boundaryLayerHeight = calcThermalCeiling(levels, T_surface, z_sfc);

  return {
    hour,
    levels,
    precipitation: val(hourly, 'precipitation', idx),
    cloudLow:      val(hourly, 'cloudcover_low',  idx) / 100,
    cloudMid:      val(hourly, 'cloudcover_mid',  idx) / 100,
    cloudHigh:     val(hourly, 'cloudcover_high', idx) / 100,
    surfaceTemp:   T_surface,
    boundaryLayerHeight,
  };
}

// ── Point d'entrée public ─────────────────────────────────────────────────────

export function normalizeAromeResponse(
  raw: OpenMeteoResponse,
  lat: number,
  lng: number,
): WeatherData {
  const z_sfc = raw.elevation ?? 0;
  const times = raw.hourly.time as string[];

  // Grouper les indices par date locale "YYYY-MM-DD"
  const byDate = new Map<string, { idx: number; hour: number; timeStr: string }[]>();
  times.forEach((t, idx) => {
    const [date, timePart] = t.split('T');
    const hour = parseInt(timePart.split(':')[0], 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({ idx, hour, timeStr: t });
  });

  const dates = [...byDate.keys()].sort().slice(0, 2);

  const forecasts = dates.map((dateStr) => {
    const entries = byDate.get(dateStr)!;

    // Map heure → profil
    const profileMap = new Map<number, HourlyProfile>();
    entries.forEach(({ idx, hour, timeStr }) => {
      profileMap.set(hour, buildHourlyProfile(raw.hourly, idx, hour, z_sfc));
    });

    // Garantir 24 profils (copie du voisin le plus proche si heure manquante)
    const profiles: HourlyProfile[] = Array.from({ length: 24 }, (_, h) => {
      if (profileMap.has(h)) return profileMap.get(h)!;
      const nearest = [...profileMap.entries()].sort(
        (a, b) => Math.abs(a[0] - h) - Math.abs(b[0] - h),
      )[0];
      return { ...nearest[1], hour: h };
    });

    return { date: new Date(dateStr), profiles };
  });

  return { position: { lat, lng }, elevation: z_sfc, forecasts };
}
