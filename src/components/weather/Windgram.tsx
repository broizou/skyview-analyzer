import { useWeatherStore } from '@/store/useWeatherStore';
import { convertWindSpeed, getWindColor } from '@/services/mockWeatherData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WindUnit } from '@/types/weather';
import { useMemo } from 'react';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8h to 21h

function getArrowSize(speedMs: number): number {
  const kmh = speedMs * 3.6;
  if (kmh < 5) return 8;
  if (kmh < 15) return 11;
  if (kmh < 25) return 14;
  if (kmh < 35) return 17;
  return 20;
}

function getArrowColor(speedMs: number): string {
  const kmh = speedMs * 3.6;
  if (kmh < 5) return 'hsl(200, 30%, 70%)';
  if (kmh < 15) return 'hsl(140, 50%, 45%)';
  if (kmh < 25) return 'hsl(45, 80%, 50%)';
  if (kmh < 35) return 'hsl(25, 85%, 50%)';
  if (kmh < 50) return 'hsl(5, 80%, 50%)';
  return 'hsl(0, 90%, 40%)';
}

function WindArrow({ direction, speedMs }: { direction: number; speedMs: number }) {
  const size = getArrowSize(speedMs);
  const color = getArrowColor(speedMs);
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
      <g transform={`rotate(${direction}, 10, 10)`}>
        <line x1="10" y1="16" x2="10" y2="4" stroke={color} strokeWidth="1.8" />
        <polygon points="10,2 7,7 13,7" fill={color} />
      </g>
    </svg>
  );
}

export function Windgram() {
  const { weatherData, daySelection, selectedHour, maxAltitude, windUnit, setMaxAltitude, setWindUnit } = useWeatherStore();

  const dayIdx = daySelection === 'today' ? 0 : 1;
  const forecast = weatherData?.forecasts[dayIdx];

  const altitudes = useMemo(
    () => Array.from({ length: maxAltitude / 100 + 1 }, (_, i) => i * 100).reverse(),
    [maxAltitude]
  );

  // Compute thermal layer top (BLH) and cumulus base per hour
  const thermalData = useMemo(() => {
    if (!forecast) return null;
    return HOURS.map((h) => {
      const profile = forecast.profiles[h];
      const blh = profile.boundaryLayerHeight;
      // Cumulus base: find altitude where T - Td < 2°C within BLH
      let cumulusBase: number | null = null;
      for (const level of profile.levels) {
        if (level.altitude > blh) break;
        if (level.temperature - level.dewpoint < 2) {
          cumulusBase = level.altitude;
          break;
        }
      }
      return { hour: h, blh, cumulusBase, precipitation: profile.precipitation };
    });
  }, [forecast]);

  if (!forecast || !thermalData) return null;

  const CELL_W = 44;
  const CELL_H = 22;
  const LEFT_W = 42;
  const gridW = HOURS.length * CELL_W;
  const gridH = altitudes.length * CELL_H;

  // SVG coordinates helpers
  const xForHour = (idx: number) => LEFT_W + idx * CELL_W + CELL_W / 2;
  const yForAlt = (alt: number) => {
    const idx = altitudes.indexOf(alt);
    if (idx === -1) {
      // Interpolate
      const ratio = 1 - alt / maxAltitude;
      return ratio * gridH;
    }
    return idx * CELL_H + CELL_H / 2;
  };

  // Build thermal layer path (area from ground to BLH)
  const thermalAreaPath = thermalData
    .map((d, i) => {
      const x = xForHour(i);
      const y = yForAlt(Math.min(d.blh, maxAltitude));
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const thermalAreaFull = `${thermalAreaPath} L${xForHour(HOURS.length - 1)},${yForAlt(0)} L${xForHour(0)},${yForAlt(0)} Z`;

  // BLH curve
  const blhCurve = thermalData
    .map((d, i) => {
      const x = xForHour(i);
      const y = yForAlt(Math.min(d.blh, maxAltitude));
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  // Cumulus base line (only segments where it exists)
  const cumulusSegments: string[] = [];
  let currentSegment = '';
  thermalData.forEach((d, i) => {
    if (d.cumulusBase !== null && d.cumulusBase <= maxAltitude) {
      const x = xForHour(i);
      const y = yForAlt(d.cumulusBase);
      currentSegment += `${currentSegment === '' ? 'M' : 'L'}${x},${y} `;
    } else if (currentSegment) {
      cumulusSegments.push(currentSegment.trim());
      currentSegment = '';
    }
  });
  if (currentSegment) cumulusSegments.push(currentSegment.trim());

  const totalW = LEFT_W + gridW;
  const PRECIP_H = 20;
  const HOUR_LABEL_H = 18;
  const totalH = gridH + PRECIP_H + HOUR_LABEL_H;

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <span className="text-xs text-muted-foreground">Alt. max:</span>
        <Select value={String(maxAltitude)} onValueChange={(v) => setMaxAltitude(Number(v))}>
          <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1000, 2000, 3000, 4000, 5000].map((a) => (
              <SelectItem key={a} value={String(a)}>{a}m</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-2">Unité:</span>
        <Select value={windUnit} onValueChange={(v) => setWindUnit(v as WindUnit)}>
          <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="km/h">km/h</SelectItem>
            <SelectItem value="m/s">m/s</SelectItem>
            <SelectItem value="kt">kt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Windgram SVG */}
      <div className="flex-1 overflow-auto min-h-0">
        <svg
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="block"
          style={{ minWidth: totalW }}
        >
          {/* Altitude labels */}
          {altitudes.map((alt, i) => (
            alt % 500 === 0 && (
              <text
                key={alt}
                x={LEFT_W - 4}
                y={i * CELL_H + CELL_H / 2 + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {alt}
              </text>
            )
          ))}

          {/* Horizontal grid lines */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 && (
              <line
                key={`gl-${alt}`}
                x1={LEFT_W}
                y1={i * CELL_H + CELL_H / 2}
                x2={totalW}
                y2={i * CELL_H + CELL_H / 2}
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
              />
            )
          )}

          {/* Selected hour highlight */}
          {HOURS.includes(selectedHour) && (
            <rect
              x={LEFT_W + HOURS.indexOf(selectedHour) * CELL_W}
              y={0}
              width={CELL_W}
              height={gridH}
              fill="hsl(var(--primary) / 0.08)"
            />
          )}

          {/* Thermal layer area */}
          <path d={thermalAreaFull} fill="hsl(45, 80%, 60%)" opacity={0.12} />

          {/* BLH curve */}
          <path d={blhCurve} fill="none" stroke="hsl(35, 85%, 50%)" strokeWidth={2.5} strokeLinejoin="round" />

          {/* Cumulus base lines */}
          {cumulusSegments.map((seg, i) => (
            <path key={`cu-${i}`} d={seg} fill="none" stroke="hsl(200, 60%, 55%)" strokeWidth={1.5} strokeDasharray="4 3" />
          ))}

          {/* Wind arrows */}
          {HOURS.map((h, hIdx) => {
            const profile = forecast.profiles[h];
            return altitudes.map((alt) => {
              const level = profile.levels.find((l) => l.altitude === alt);
              if (!level) return null;
              // Only show every 200m to avoid clutter
              if (alt % 200 !== 0) return null;
              const x = LEFT_W + hIdx * CELL_W + CELL_W / 2;
              const y = altitudes.indexOf(alt) * CELL_H + CELL_H / 2;
              const size = getArrowSize(level.wind.speed);
              const color = getArrowColor(level.wind.speed);
              return (
                <g key={`w-${h}-${alt}`} transform={`translate(${x - size / 2}, ${y - size / 2})`}>
                  <svg width={size} height={size} viewBox="0 0 20 20">
                    <g transform={`rotate(${level.wind.direction}, 10, 10)`}>
                      <line x1="10" y1="16" x2="10" y2="4" stroke={color} strokeWidth="1.8" />
                      <polygon points="10,2 7,7 13,7" fill={color} />
                    </g>
                  </svg>
                </g>
              );
            });
          })}

          {/* Vertical separators between hours */}
          {HOURS.map((_, i) => (
            <line
              key={`vs-${i}`}
              x1={LEFT_W + i * CELL_W}
              y1={0}
              x2={LEFT_W + i * CELL_W}
              y2={gridH}
              stroke="hsl(var(--border))"
              strokeWidth={0.3}
            />
          ))}

          {/* Precipitation row below grid */}
          {HOURS.map((h, i) => {
            const profile = forecast.profiles[h];
            if (profile.precipitation < 0.1) return null;
            const x = LEFT_W + i * CELL_W + CELL_W / 2;
            const y = gridH + PRECIP_H / 2 + 3;
            return (
              <text key={`p-${h}`} x={x} y={y} textAnchor="middle" fontSize={9} fill="hsl(210, 70%, 55%)" fontWeight={600}>
                {profile.precipitation.toFixed(1)}
              </text>
            );
          })}
          {/* Precip label */}
          <text x={LEFT_W - 4} y={gridH + PRECIP_H / 2 + 3} textAnchor="end" fontSize={8} className="fill-muted-foreground">
            mm
          </text>

          {/* Separator line */}
          <line x1={LEFT_W} y1={gridH} x2={totalW} y2={gridH} stroke="hsl(var(--border))" strokeWidth={0.5} />

          {/* Hour labels */}
          {HOURS.map((h, i) => (
            <text
              key={`h-${h}`}
              x={LEFT_W + i * CELL_W + CELL_W / 2}
              y={gridH + PRECIP_H + HOUR_LABEL_H - 3}
              textAnchor="middle"
              fontSize={10}
              fontWeight={h === selectedHour ? 700 : 400}
              fill={h === selectedHour ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
            >
              {String(h).padStart(2, '0')}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-border text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[hsl(35,85%,50%)] inline-block rounded" /> Couche thermique
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 border-t border-dashed border-[hsl(200,60%,55%)] inline-block" /> Base cumulus
        </span>
      </div>
    </div>
  );
}
