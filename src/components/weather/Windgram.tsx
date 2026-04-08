import { useWeatherStore } from '@/store/useWeatherStore';
import { convertWindSpeed } from '@/services/mockWeatherData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WindUnit } from '@/types/weather';
import { useMemo } from 'react';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6h to 23h

function getArrowColor(speedMs: number): string {
  const kmh = speedMs * 3.6;
  if (kmh < 5) return '#999';
  if (kmh < 10) return '#6aaa3a';
  if (kmh < 20) return '#3a8a3a';
  if (kmh < 30) return '#2a7a5a';
  if (kmh < 40) return '#2288aa';
  if (kmh < 50) return '#cc8800';
  return '#cc3300';
}

function getArrowScale(speedMs: number): number {
  const kmh = speedMs * 3.6;
  if (kmh < 3) return 0.55;
  if (kmh < 8) return 0.65;
  if (kmh < 15) return 0.75;
  if (kmh < 25) return 0.85;
  if (kmh < 35) return 0.95;
  return 1.0;
}

export function Windgram() {
  const { weatherData, daySelection, selectedHour, maxAltitude, windUnit, setMaxAltitude, setWindUnit, setSelectedHour } = useWeatherStore();

  const dayIdx = daySelection === 'today' ? 0 : 1;
  const forecast = weatherData?.forecasts[dayIdx];

  // Every 100m step
  const altitudes = useMemo(
    () => Array.from({ length: maxAltitude / 100 + 1 }, (_, i) => i * 100).reverse(),
    [maxAltitude]
  );

  // Thermal data per hour
  const thermalData = useMemo(() => {
    if (!forecast) return null;
    return HOURS.map((h) => {
      const profile = forecast.profiles[h];
      return { hour: h, blh: profile.boundaryLayerHeight };
    });
  }, [forecast]);

  if (!forecast || !thermalData) return null;

  const CELL_W = 54;
  const CELL_H = 20;
  const LEFT_W = 44;
  const gridW = HOURS.length * CELL_W;
  const gridH = altitudes.length * CELL_H;
  const HOUR_LABEL_H = 22;
  const totalW = LEFT_W + gridW;
  const totalH = gridH + HOUR_LABEL_H;

  // Compute ground altitude (0m row y position)
  const groundY = altitudes.indexOf(0) * CELL_H;

  // Build thermal layer polygon (yellow zone from ground to BLH)
  const thermalPoints: string[] = [];
  thermalData.forEach((d, i) => {
    const x = LEFT_W + i * CELL_W + CELL_W / 2;
    const blhClamped = Math.min(d.blh, maxAltitude);
    // y for this BLH altitude
    const altIdx = 1 - blhClamped / maxAltitude;
    const y = altIdx * gridH;
    thermalPoints.push(`${x},${y}`);
  });
  // Close polygon along ground
  const lastX = LEFT_W + (HOURS.length - 1) * CELL_W + CELL_W / 2;
  const firstX = LEFT_W + CELL_W / 2;
  const thermalPath = `M${thermalPoints.join(' L')} L${lastX},${groundY + CELL_H / 2} L${firstX},${groundY + CELL_H / 2} Z`;

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 p-1.5 border-b border-border">
        <Select value={String(maxAltitude)} onValueChange={(v) => setMaxAltitude(Number(v))}>
          <SelectTrigger className="h-6 w-[72px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1000, 2000, 3000, 4000, 5000].map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={windUnit} onValueChange={(v) => setWindUnit(v as WindUnit)}>
          <SelectTrigger className="h-6 w-[64px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="km/h">km/h</SelectItem>
            <SelectItem value="m/s">m/s</SelectItem>
            <SelectItem value="kt">kt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SVG Windgram */}
      <div className="flex-1 overflow-auto min-h-0">
        <svg
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="block select-none"
          style={{ minWidth: totalW }}
        >
          {/* Ground fill (gray below 0m, but since 0 is the last row we fill below) */}
          {/* We don't need ground fill if 0 is at bottom — the reference shows gray below terrain.
              For simplicity, no sub-terrain here. */}

          {/* Thermal layer yellow zone */}
          <path d={thermalPath} fill="#fde047" opacity={0.35} />

          {/* Horizontal grid lines at 500m intervals */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <line
                key={`g-${alt}`}
                x1={LEFT_W}
                y1={i * CELL_H + CELL_H / 2}
                x2={totalW}
                y2={i * CELL_H + CELL_H / 2}
                stroke="#ddd"
                strokeWidth={0.5}
              />
            ) : null
          )}

          {/* Selected hour column highlight */}
          {HOURS.includes(selectedHour) && (
            <rect
              x={LEFT_W + HOURS.indexOf(selectedHour) * CELL_W}
              y={0}
              width={CELL_W}
              height={gridH}
              fill="hsl(var(--primary) / 0.06)"
            />
          )}

          {/* Altitude labels */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <text
                key={`a-${alt}`}
                x={LEFT_W - 5}
                y={i * CELL_H + CELL_H / 2 + 3.5}
                textAnchor="end"
                fontSize={11}
                fill="#888"
                fontFamily="system-ui"
              >
                {alt}
              </text>
            ) : null
          )}

          {/* Wind data: arrow + speed for every cell */}
          {HOURS.map((h, hIdx) => {
            const profile = forecast.profiles[h];
            return altitudes.map((alt, aIdx) => {
              const level = profile.levels.find((l) => l.altitude === alt);
              if (!level) return null;
              const cx = LEFT_W + hIdx * CELL_W + CELL_W / 2;
              const cy = aIdx * CELL_H + CELL_H / 2;
              const color = getArrowColor(level.wind.speed);
              const scale = getArrowScale(level.wind.speed);
              const speed = convertWindSpeed(level.wind.speed, windUnit);
              const arrowSize = 14 * scale;

              return (
                <g key={`c-${h}-${alt}`}>
                  {/* Arrow */}
                  <g transform={`translate(${cx - 10}, ${cy - arrowSize / 2})`}>
                    <g transform={`scale(${scale})`}>
                      <g transform={`rotate(${level.wind.direction}, ${arrowSize / scale / 2}, ${arrowSize / scale / 2})`}>
                        <line
                          x1={arrowSize / scale / 2}
                          y1={arrowSize / scale * 0.85}
                          x2={arrowSize / scale / 2}
                          y2={arrowSize / scale * 0.15}
                          stroke={color}
                          strokeWidth={1.6}
                        />
                        <polygon
                          points={`${arrowSize / scale / 2},0 ${arrowSize / scale / 2 - 3.5},${arrowSize / scale * 0.3} ${arrowSize / scale / 2 + 3.5},${arrowSize / scale * 0.3}`}
                          fill={color}
                        />
                      </g>
                    </g>
                  </g>
                  {/* Speed number */}
                  <text
                    x={cx + 6}
                    y={cy + 3.5}
                    fontSize={9}
                    fill={color}
                    fontWeight={500}
                    fontFamily="system-ui"
                  >
                    {speed}
                  </text>
                </g>
              );
            });
          })}

          {/* Hour labels at bottom */}
          {HOURS.map((h, i) => (
            <text
              key={`hl-${h}`}
              x={LEFT_W + i * CELL_W + CELL_W / 2}
              y={gridH + HOUR_LABEL_H - 4}
              textAnchor="middle"
              fontSize={h === selectedHour ? 13 : 11}
              fontWeight={h === selectedHour ? 800 : 400}
              fill={h === selectedHour ? '#111' : '#888'}
              fontFamily="system-ui"
              className="cursor-pointer"
              onClick={() => setSelectedHour(h)}
            >
              {h}h
            </text>
          ))}

          {/* Clickable hour columns (invisible rects for interaction) */}
          {HOURS.map((h, i) => (
            <rect
              key={`click-${h}`}
              x={LEFT_W + i * CELL_W}
              y={0}
              width={CELL_W}
              height={gridH + HOUR_LABEL_H}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setSelectedHour(h)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
