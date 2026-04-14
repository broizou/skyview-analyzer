import { useWeatherStore } from '@/store/useWeatherStore';
import { useMemo, useEffect, useRef, useState } from 'react';
import type { DayForecast } from '@/types/weather';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8h → 21h

// Layout constants
const CELL_W        = 43;
const LEFT_W        = 44;
const CLOUD_BAND_H  = 8;   // px per cloud level (high / mid / low)
const CLOUD_H       = CLOUD_BAND_H * 3;
const HOUR_LABEL_H  = 18;
const PRECIP_H      = 13;

// ── Couleurs ──────────────────────────────────────────────────────────────────
function getArrowColor(speedMs: number): string {
  const kmh = speedMs * 3.6;
  if (kmh <  5) return '#60c4e0';
  if (kmh < 15) return '#4caf50';
  if (kmh < 25) return '#ff9800';
  if (kmh < 35) return '#f44336';
  return '#9c27b0';
}

// ── Flèche pleine (polygone unique) — pointe dans la direction du vent ────────
function WindArrow({
  cx, cy, direction, speedMs, color,
}: {
  cx: number; cy: number; direction: number; speedMs: number; color: string;
}) {
  const kmh = speedMs * 3.6;
  if (kmh < 0.5) return null;

  const t      = Math.min(kmh / 40, 1);
  const len    = 7 + t * 5;       // 7 → 12 px
  const headW  = len * 0.58;      // tête large
  const headH  = len * 0.46;
  const shaftW = len * 0.22;

  const tipY  = -len / 2;
  const neckY = tipY + headH;
  const tailY = len / 2;

  const pts = [
    `0,${tipY}`,
    `${headW / 2},${neckY}`,
    `${shaftW / 2},${neckY}`,
    `${shaftW / 2},${tailY}`,
    `${-shaftW / 2},${tailY}`,
    `${-shaftW / 2},${neckY}`,
    `${-headW / 2},${neckY}`,
  ].join(' ');

  return (
    <g transform={`translate(${cx},${cy}) rotate(${direction})`}>
      <polygon points={pts} fill={color} />
    </g>
  );
}

// ── Lissage 2D du vent : noyau 3×3 pondéré ───────────────────────────────────
interface SmoothedWind { speed: number; direction: number }

function buildSmoothedWindMap(
  forecast: DayForecast,
  hours: number[],
  altitudes: number[],
  minAlt: number,
): Map<string, SmoothedWind> {
  const kernel = [
    { dh: -1, da: -1, w: 1 }, { dh: 0, da: -1, w: 2 }, { dh: 1, da: -1, w: 1 },
    { dh: -1, da:  0, w: 2 }, { dh: 0, da:  0, w: 4 }, { dh: 1, da:  0, w: 2 },
    { dh: -1, da:  1, w: 1 }, { dh: 0, da:  1, w: 2 }, { dh: 1, da:  1, w: 1 },
  ];
  const map = new Map<string, SmoothedWind>();
  hours.forEach((h, hi) => {
    altitudes.forEach((alt) => {
      let totalW = 0, sumSpeed = 0, sumSin = 0, sumCos = 0;
      kernel.forEach(({ dh, da, w }) => {
        const nh = hours[hi + dh];
        const na = alt + da * 100;
        if (nh === undefined || na < minAlt) return;
        const level = forecast.profiles[nh]?.levels.find((l) => l.altitude === na);
        if (!level) return;
        totalW   += w;
        sumSpeed += level.wind.speed * w;
        const rad = (level.wind.direction * Math.PI) / 180;
        sumSin   += Math.sin(rad) * w;
        sumCos   += Math.cos(rad) * w;
      });
      if (totalW > 0) {
        map.set(`${h}-${alt}`, {
          speed:     sumSpeed / totalW,
          direction: ((Math.atan2(sumSin / totalW, sumCos / totalW) * 180) / Math.PI + 360) % 360,
        });
      }
    });
  });
  return map;
}

// ── Courbe thermique bezier ───────────────────────────────────────────────────
function buildThermalPath(
  thermalData: Array<{ blh: number }>,
  leftW: number, cellW: number,
  gridH: number, gridY0: number,
  maxAltitude: number, terrainAlt: number,
): string {
  const range = maxAltitude - terrainAlt;
  if (range <= 0) return '';
  const pts = thermalData.map((d, i) => {
    const clamped = Math.min(Math.max(d.blh, terrainAlt), maxAltitude);
    return {
      x: leftW + i * cellW + cellW / 2,
      y: gridY0 + (1 - (clamped - terrainAlt) / range) * gridH,
    };
  });
  if (pts.length === 0) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  d += ` L${pts[pts.length - 1].x},${gridY0 + gridH} L${pts[0].x},${gridY0 + gridH} Z`;
  return d;
}

// ── Composant principal ───────────────────────────────────────────────────────
export function Windgram() {
  const {
    weatherData, daySelection, selectedHour,
    maxAltitude, setSelectedHour,
  } = useWeatherStore();

  const dayIdx  = daySelection === 'today' ? 0 : 1;
  const forecast = weatherData?.forecasts[dayIdx];

  const terrainAlt = Math.floor((weatherData?.elevation ?? 0) / 100) * 100;

  const altitudes = useMemo(
    () => Array.from(
      { length: (maxAltitude - terrainAlt) / 100 + 1 },
      (_, i) => terrainAlt + i * 100,
    ).reverse(),
    [maxAltitude, terrainAlt],
  );

  // ── Hauteur dynamique via ResizeObserver ──────────────────────────────────
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(400);
  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const thermalData = useMemo(() => {
    if (!forecast) return null;
    return HOURS.map((h) => ({ hour: h, blh: forecast.profiles[h]?.boundaryLayerHeight ?? 0 }));
  }, [forecast]);

  const cloudData = useMemo(() => {
    if (!forecast) return null;
    return HOURS.map((h) => ({
      hour:   h,
      high:   forecast.profiles[h]?.cloudHigh  ?? 0,
      mid:    forecast.profiles[h]?.cloudMid   ?? 0,
      low:    forecast.profiles[h]?.cloudLow   ?? 0,
      precip: forecast.profiles[h]?.precipitation ?? 0,
    }));
  }, [forecast]);

  const smoothedWind = useMemo(
    () => (forecast ? buildSmoothedWindMap(forecast, HOURS, altitudes, terrainAlt) : null),
    [forecast, altitudes, terrainAlt],
  );

  if (!forecast || !thermalData || !cloudData || !smoothedWind) return null;

  // ── Dimensions ────────────────────────────────────────────────────────────
  const CELL_H  = Math.max(6, Math.floor((containerH - CLOUD_H - HOUR_LABEL_H - PRECIP_H) / altitudes.length));
  const gridH   = altitudes.length * CELL_H;
  const gridY0  = CLOUD_H;                  // main grid starts below cloud strip
  const totalW  = LEFT_W + HOURS.length * CELL_W;
  const totalH  = CLOUD_H + gridH + HOUR_LABEL_H + PRECIP_H;

  const peakBLH           = Math.max(...thermalData.map((d) => d.blh));
  const thermalFillOpacity = 0.18 + Math.min(peakBLH / 2500, 1) * 0.25;
  const thermalPath        = buildThermalPath(thermalData, LEFT_W, CELL_W, gridH, gridY0, maxAltitude, terrainAlt);

  // Thermal outline
  const range = maxAltitude - terrainAlt;
  const thermalLinePts = thermalData.map((d, i) => {
    const clamped = Math.min(Math.max(d.blh, terrainAlt), maxAltitude);
    return {
      x: LEFT_W + i * CELL_W + CELL_W / 2,
      y: gridY0 + (1 - (clamped - terrainAlt) / range) * gridH,
    };
  });
  let thermalLineD = '';
  if (thermalLinePts.length > 0) {
    thermalLineD = `M${thermalLinePts[0].x},${thermalLinePts[0].y}`;
    for (let i = 1; i < thermalLinePts.length; i++) {
      const p = thermalLinePts[i - 1], c = thermalLinePts[i];
      const mx = (p.x + c.x) / 2;
      thermalLineD += ` C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
    }
  }

  const windCells = useMemo(() =>
    HOURS.flatMap((h, hIdx) =>
      altitudes.map((alt, aIdx) => {
        const wind = smoothedWind.get(`${h}-${alt}`);
        if (!wind) return null;
        const cx       = LEFT_W + hIdx * CELL_W + CELL_W / 2;
        const cy       = gridY0 + aIdx * CELL_H + CELL_H / 2;
        const color    = getArrowColor(wind.speed);
        const speedKmh = Math.round(wind.speed * 3.6);
        return (
          <g key={`c-${h}-${alt}`}>
            <WindArrow cx={cx - 8} cy={cy} direction={wind.direction} speedMs={wind.speed} color={color} />
            <text x={cx + 5} y={cy + 3.5} fontSize={8} fill={color} fontWeight={500} fontFamily="system-ui">
              {speedKmh}
            </text>
          </g>
        );
      }),
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [smoothedWind, altitudes, CELL_H, gridY0]);

  return (
    <div className="flex flex-col h-full">
      <div ref={svgContainerRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <svg
          width={totalW}
          height={containerH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          preserveAspectRatio="none"
          className="block select-none"
          style={{ minWidth: totalW }}
        >
          {/* ── Bandes de nébulosité (haut, en 3 niveaux) ─────────────────── */}
          {(['high', 'mid', 'low'] as const).map((level, li) => (
            <g key={`cloud-${level}`}>
              {HOURS.map((h, hIdx) => {
                const frac = cloudData[hIdx][level];
                if (frac < 0.05) return null;
                const fill = level === 'high' ? '#b0c4d8' : level === 'mid' ? '#7890a8' : '#506070';
                return (
                  <rect
                    key={`cl-${level}-${h}`}
                    x={LEFT_W + hIdx * CELL_W} y={li * CLOUD_BAND_H}
                    width={CELL_W} height={CLOUD_BAND_H}
                    fill={fill} opacity={frac * 0.9}
                  />
                );
              })}
              <text
                x={LEFT_W - 3} y={li * CLOUD_BAND_H + CLOUD_BAND_H / 2 + 3}
                textAnchor="end" fontSize={7} fill="#999" fontFamily="system-ui"
              >
                {level === 'high' ? 'Hi' : level === 'mid' ? 'Mi' : 'Lo'}
              </text>
            </g>
          ))}

          {/* Séparateur cloud / grille */}
          <line x1={LEFT_W} y1={gridY0} x2={totalW} y2={gridY0} stroke="#ddd" strokeWidth={0.5} />

          {/* ── Zone thermique ─────────────────────────────────────────────── */}
          <path d={thermalPath} fill="#fde047" opacity={thermalFillOpacity} />
          {thermalLineD && (
            <path d={thermalLineD} fill="none" stroke="#e6a700" strokeWidth={2} strokeLinecap="round" />
          )}

          {/* ── Grille horizontale 500 m ───────────────────────────────────── */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <line
                key={`g-${alt}`}
                x1={LEFT_W} y1={gridY0 + i * CELL_H + CELL_H / 2}
                x2={totalW} y2={gridY0 + i * CELL_H + CELL_H / 2}
                stroke="#ddd" strokeWidth={0.5}
              />
            ) : null,
          )}

          {/* ── Labels altitude ────────────────────────────────────────────── */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <text
                key={`a-${alt}`}
                x={LEFT_W - 5} y={gridY0 + i * CELL_H + CELL_H / 2 + 3.5}
                textAnchor="end" fontSize={10} fill="#888" fontFamily="system-ui"
              >
                {alt}
              </text>
            ) : null,
          )}

          {/* Label élévation terrain */}
          {terrainAlt > 0 && (
            <text
              x={LEFT_W - 5} y={gridY0 + gridH - 2}
              textAnchor="end" fontSize={9} fill="#a0522d" fontWeight={600} fontFamily="system-ui"
            >
              {weatherData!.elevation}m
            </text>
          )}

          {/* ── Flèches vent ───────────────────────────────────────────────── */}
          {windCells}

          {/* ── Labels heures ─────────────────────────────────────────────── */}
          {HOURS.map((h, i) => (
            <text
              key={`hl-${h}`}
              x={LEFT_W + i * CELL_W + CELL_W / 2}
              y={gridY0 + gridH + HOUR_LABEL_H - 3}
              textAnchor="middle"
              fontSize={h === selectedHour ? 12 : 10}
              fontWeight={h === selectedHour ? 800 : 400}
              fill={h === selectedHour ? '#111' : '#888'}
              fontFamily="system-ui"
              className="cursor-pointer"
              onClick={() => setSelectedHour(h)}
            >
              {h}h
            </text>
          ))}

          {/* ── Précipitations ────────────────────────────────────────────── */}
          {cloudData.map((d, hIdx) => {
            if (d.precip < 0.05) return null;
            return (
              <text
                key={`prec-${d.hour}`}
                x={LEFT_W + hIdx * CELL_W + CELL_W / 2}
                y={gridY0 + gridH + HOUR_LABEL_H + PRECIP_H - 2}
                textAnchor="middle" fontSize={8} fill="#4488cc" fontFamily="system-ui"
              >
                {d.precip >= 1 ? d.precip.toFixed(1) : d.precip.toFixed(2).replace('0.', '.')}
              </text>
            );
          })}

          {/* Label "mm" si au moins une valeur de précip */}
          {cloudData.some((d) => d.precip >= 0.05) && (
            <text
              x={LEFT_W - 5} y={gridY0 + gridH + HOUR_LABEL_H + PRECIP_H - 2}
              textAnchor="end" fontSize={7} fill="#4488cc" fontFamily="system-ui"
            >
              mm
            </text>
          )}

          {/* ── Zones de clic colonnes ─────────────────────────────────────── */}
          {HOURS.map((h, i) => (
            <rect
              key={`click-${h}`}
              x={LEFT_W + i * CELL_W} y={0}
              width={CELL_W} height={totalH}
              fill="transparent" className="cursor-pointer"
              onClick={() => setSelectedHour(h)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
