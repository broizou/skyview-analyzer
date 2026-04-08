import { useWeatherStore } from '@/store/useWeatherStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo } from 'react';

// 8h → 21h inclusive
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

/** Wind speed colour scale (km/h) */
function getArrowColor(speedMs: number): string {
  const kmh = speedMs * 3.6;
  if (kmh < 10) return '#60c4e0'; // bleu clair
  if (kmh < 20) return '#4caf50'; // vert
  if (kmh < 30) return '#ff9800'; // orange
  return '#f44336';               // rouge
}

function getArrowScale(speedMs: number): number {
  const kmh = speedMs * 3.6;
  if (kmh < 3)  return 0.55;
  if (kmh < 8)  return 0.65;
  if (kmh < 15) return 0.75;
  if (kmh < 25) return 0.85;
  if (kmh < 35) return 0.95;
  return 1.0;
}

/** Thermal fill intensity: amber, opacity proportional to BLH strength */
function thermalOpacity(blh: number): number {
  // BLH 0 → 2500 m mapped to opacity 0.08 → 0.72
  return Math.min(0.72, 0.08 + (blh / 2500) * 0.64);
}

export function Windgram() {
  const {
    weatherData, daySelection, selectedHour,
    maxAltitude, setMaxAltitude, setSelectedHour,
  } = useWeatherStore();

  const dayIdx = daySelection === 'today' ? 0 : 1;
  const forecast = weatherData?.forecasts[dayIdx];

  const altitudes = useMemo(
    () => Array.from({ length: maxAltitude / 100 + 1 }, (_, i) => i * 100).reverse(),
    [maxAltitude],
  );

  const thermalData = useMemo(() => {
    if (!forecast) return null;
    return HOURS.map((h) => ({ hour: h, blh: forecast.profiles[h].boundaryLayerHeight }));
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

  return (
    <div className="flex flex-col h-full">
      {/* Altitude range selector */}
      <div className="flex items-center gap-2 p-1.5 border-b border-border">
        <span className="text-[11px] text-muted-foreground">Altitude max</span>
        <Select value={String(maxAltitude)} onValueChange={(v) => setMaxAltitude(Number(v))}>
          <SelectTrigger className="h-6 w-[80px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1000, 2000, 3000, 4000, 5000].map((a) => (
              <SelectItem key={a} value={String(a)}>{a} m</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Wind colour legend */}
        <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#60c4e0]" /> &lt;10</span>
          <span className="flex items-center gap-0.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#4caf50]" /> &lt;20</span>
          <span className="flex items-center gap-0.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#ff9800]" /> &lt;30</span>
          <span className="flex items-center gap-0.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#f44336]" /> 30+</span>
          <span className="text-[9px]">km/h</span>
        </div>
      </div>

      {/* SVG grid */}
      <div className="flex-1 overflow-auto min-h-0">
        <svg
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="block select-none"
          style={{ minWidth: totalW }}
        >
          {/* Thermal columns — amber fill, opacity ∝ BLH */}
          {thermalData.map((d, i) => {
            const blhClamped = Math.min(d.blh, maxAltitude);
            const topY = (1 - blhClamped / maxAltitude) * gridH;
            return (
              <rect
                key={`thermal-${i}`}
                x={LEFT_W + i * CELL_W}
                y={topY}
                width={CELL_W}
                height={gridH - topY}
                fill="#f59e0b"
                opacity={thermalOpacity(blhClamped)}
              />
            );
          })}

          {/* Horizontal grid lines at 500 m */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <line
                key={`g-${alt}`}
                x1={LEFT_W} y1={i * CELL_H + CELL_H / 2}
                x2={totalW}  y2={i * CELL_H + CELL_H / 2}
                stroke="#ddd" strokeWidth={0.5}
              />
            ) : null,
          )}

          {/* Selected-hour column highlight */}
          {HOURS.includes(selectedHour) && (
            <rect
              x={LEFT_W + HOURS.indexOf(selectedHour) * CELL_W}
              y={0}
              width={CELL_W}
              height={gridH}
              fill="hsl(var(--primary) / 0.07)"
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
            ) : null,
          )}

          {/* Wind arrows + speed values */}
          {HOURS.map((h, hIdx) => {
            const profile = forecast.profiles[h];
            return altitudes.map((alt, aIdx) => {
              const level = profile.levels.find((l) => l.altitude === alt);
              if (!level) return null;
              const cx = LEFT_W + hIdx * CELL_W + CELL_W / 2;
              const cy = aIdx * CELL_H + CELL_H / 2;
              const color = getArrowColor(level.wind.speed);
              const scale = getArrowScale(level.wind.speed);
              const speedKmh = Math.round(level.wind.speed * 3.6);
              const arrowSize = 14 * scale;

              return (
                <g key={`c-${h}-${alt}`}>
                  <g transform={`translate(${cx - 10}, ${cy - arrowSize / 2})`}>
                    <g transform={`scale(${scale})`}>
                      <g transform={`rotate(${level.wind.direction}, ${arrowSize / scale / 2}, ${arrowSize / scale / 2})`}>
                        <line
                          x1={arrowSize / scale / 2} y1={arrowSize / scale * 0.85}
                          x2={arrowSize / scale / 2} y2={arrowSize / scale * 0.15}
                          stroke={color} strokeWidth={1.6}
                        />
                        <polygon
                          points={`${arrowSize / scale / 2},0 ${arrowSize / scale / 2 - 3.5},${arrowSize / scale * 0.3} ${arrowSize / scale / 2 + 3.5},${arrowSize / scale * 0.3}`}
                          fill={color}
                        />
                      </g>
                    </g>
                  </g>
                  <text
                    x={cx + 6} y={cy + 3.5}
                    fontSize={9} fill={color} fontWeight={500} fontFamily="system-ui"
                  >
                    {speedKmh}
                  </text>
                </g>
              );
            });
          })}

          {/* Hour labels — clickable */}
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

          {/* Invisible click zones on columns */}
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
