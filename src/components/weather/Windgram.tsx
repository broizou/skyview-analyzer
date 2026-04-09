import { useWeatherStore } from '@/store/useWeatherStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo, useEffect, useRef, useState } from 'react';
import type { DayForecast } from '@/types/weather';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8h → 21h

// ── Couleurs ─────────────────────────────────────────────────────────────────
function getArrowColor(speedMs: number): string {
  const kmh = speedMs * 3.6;
  if (kmh < 10) return '#60c4e0';
  if (kmh < 20) return '#4caf50';
  if (kmh < 30) return '#ff9800';
  return '#f44336';
}

// ── Flèche : courte et épaisse, taille ∝ vitesse ─────────────────────────────
function WindArrow({
  cx, cy, direction, speedMs, color,
}: {
  cx: number; cy: number; direction: number; speedMs: number; color: string;
}) {
  const kmh = speedMs * 3.6;
  if (kmh < 0.5) return null;

  // Longueur 3 → 10 px, épaisseur 2.5 → 5 px
  const len   = Math.min(3 + Math.sqrt(kmh) * 1.1, 10);
  const headH = len * 0.40;
  const headW = len * 0.42;
  const shaft = Math.min(2.5 + kmh / 16, 5.0);

  const tipY  =  len / 2;
  const tailY = -len / 2;

  return (
    <g transform={`translate(${cx},${cy}) rotate(${direction})`}>
      <line
        x1={0} y1={tailY} x2={0} y2={tipY - headH}
        stroke={color} strokeWidth={shaft} strokeLinecap="round"
      />
      <polygon
        points={`0,${tipY} ${-headW / 2},${tipY - headH} ${headW / 2},${tipY - headH}`}
        fill={color}
      />
    </g>
  );
}

// ── Lissage 2D du vent : noyau 3×3 pondéré ───────────────────────────────────
interface SmoothedWind { speed: number; direction: number }

function buildSmoothedWindMap(
  forecast: DayForecast,
  hours: number[],
  altitudes: number[],
): Map<string, SmoothedWind> {
  // Poids : centre=4, voisins orthogonaux=2, diagonales=1
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
        if (nh === undefined || na < 0) return;
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

// ── Courbe thermique lissée (bezier) ─────────────────────────────────────────
function buildThermalPath(
  thermalData: Array<{ blh: number }>,
  leftW: number, cellW: number, gridH: number, maxAltitude: number,
): string {
  const pts = thermalData.map((d, i) => ({
    x: leftW + i * cellW + cellW / 2,
    y: (1 - Math.min(d.blh, maxAltitude) / maxAltitude) * gridH,
  }));
  if (pts.length === 0) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  d += ` L${pts[pts.length - 1].x},${gridH} L${pts[0].x},${gridH} Z`;
  return d;
}

// ── Composant principal ───────────────────────────────────────────────────────
export function Windgram() {
  const {
    weatherData, daySelection, selectedHour,
    maxAltitude, setMaxAltitude, setSelectedHour,
  } = useWeatherStore();

  const dayIdx  = daySelection === 'today' ? 0 : 1;
  const forecast = weatherData?.forecasts[dayIdx];

  const altitudes = useMemo(
    () => Array.from({ length: maxAltitude / 100 + 1 }, (_, i) => i * 100).reverse(),
    [maxAltitude],
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
    return HOURS.map((h) => ({ hour: h, blh: forecast.profiles[h].boundaryLayerHeight }));
  }, [forecast]);

  // Vent lissé
  const smoothedWind = useMemo(
    () => (forecast ? buildSmoothedWindMap(forecast, HOURS, altitudes) : null),
    [forecast, altitudes],
  );

  if (!forecast || !thermalData || !smoothedWind) return null;

  // ── Dimensions : CELL_H calculé pour remplir exactement l'espace disponible ─
  const CELL_W       = 43;
  const LEFT_W       = 44;
  const HOUR_LABEL_H = 20;
  const CELL_H       = Math.max(8, Math.floor((containerH - HOUR_LABEL_H) / altitudes.length));
  const gridH        = altitudes.length * CELL_H;
  const totalW       = LEFT_W + HOURS.length * CELL_W;
  const totalH       = gridH + HOUR_LABEL_H;

  // Intensité thermique
  const peakBLH           = Math.max(...thermalData.map((d) => d.blh));
  const thermalFillOpacity = 0.18 + Math.min(peakBLH / 2500, 1) * 0.25;
  const thermalPath        = buildThermalPath(thermalData, LEFT_W, CELL_W, gridH, maxAltitude);

  // Courbe du sommet thermique (juste la ligne, pas la zone remplie)
  const thermalLinePts = thermalData.map((d, i) => ({
    x: LEFT_W + i * CELL_W + CELL_W / 2,
    y: (1 - Math.min(d.blh, maxAltitude) / maxAltitude) * gridH,
  }));
  let thermalLineD = '';
  if (thermalLinePts.length > 0) {
    thermalLineD = `M${thermalLinePts[0].x},${thermalLinePts[0].y}`;
    for (let i = 1; i < thermalLinePts.length; i++) {
      const p = thermalLinePts[i - 1], c = thermalLinePts[i];
      const mx = (p.x + c.x) / 2;
      thermalLineD += ` C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
    }
  }
  return (
    <div className="flex flex-col h-full">
      {/* En-tête */}
      <div className="flex items-center gap-2 p-1.5 border-b border-border shrink-0">
        <span className="text-[11px] text-muted-foreground">Alt. max</span>
        <Select value={String(maxAltitude)} onValueChange={(v) => setMaxAltitude(Number(v))}>
          <SelectTrigger className="h-6 w-[76px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1000, 2000, 3000, 4000, 5000].map((a) => (
              <SelectItem key={a} value={String(a)}>{a} m</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
          {[
            { color: '#60c4e0', label: '<10' },
            { color: '#4caf50', label: '<20' },
            { color: '#ff9800', label: '<30' },
            { color: '#f44336', label: '30+' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-0.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </span>
          ))}
          <span className="text-[9px]">km/h</span>
        </div>
      </div>

      {/* Conteneur SVG : prend tout l'espace restant, scroll horizontal seulement */}
      <div ref={svgContainerRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <svg
          width={totalW}
          height={containerH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          preserveAspectRatio="none"
          className="block select-none"
          style={{ minWidth: totalW }}
        >
          {/* Zone thermique */}
          <path d={thermalPath} fill="#fde047" opacity={thermalFillOpacity} />
          {/* Courbe sommet thermique */}
          {thermalLineD && (
            <path d={thermalLineD} fill="none" stroke="#e6a700" strokeWidth={2} strokeLinecap="round" />
          )}

          {/* Grille 500 m */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <line
                key={`g-${alt}`}
                x1={LEFT_W} y1={i * CELL_H + CELL_H / 2}
                x2={totalW} y2={i * CELL_H + CELL_H / 2}
                stroke="#ddd" strokeWidth={0.5}
              />
            ) : null,
          )}

          {/* Colonne heure active */}
          {HOURS.includes(selectedHour) && (
            <rect
              x={LEFT_W + HOURS.indexOf(selectedHour) * CELL_W} y={0}
              width={CELL_W} height={gridH}
              fill="hsl(var(--primary) / 0.07)"
            />
          )}

          {/* Labels altitude */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <text
                key={`a-${alt}`}
                x={LEFT_W - 5} y={i * CELL_H + CELL_H / 2 + 3.5}
                textAnchor="end" fontSize={10} fill="#888" fontFamily="system-ui"
              >
                {alt}
              </text>
            ) : null,
          )}

          {/* Flèches + valeurs lissées */}
          {HOURS.map((h, hIdx) =>
            altitudes.map((alt, aIdx) => {
              const wind = smoothedWind.get(`${h}-${alt}`);
              if (!wind) return null;
              const cx       = LEFT_W + hIdx * CELL_W + CELL_W / 2;
              const cy       = aIdx * CELL_H + CELL_H / 2;
              const color    = getArrowColor(wind.speed);
              const speedKmh = Math.round(wind.speed * 3.6);

              return (
                <g key={`c-${h}-${alt}`}>
                  <WindArrow
                    cx={cx - 7} cy={cy}
                    direction={wind.direction}
                    speedMs={wind.speed}
                    color={color}
                  />
                  <text
                    x={cx + 4} y={cy + 3.5}
                    fontSize={8} fill={color} fontWeight={500} fontFamily="system-ui"
                  >
                    {speedKmh}
                  </text>
                </g>
              );
            }),
          )}

          {/* Labels heures */}
          {HOURS.map((h, i) => (
            <text
              key={`hl-${h}`}
              x={LEFT_W + i * CELL_W + CELL_W / 2}
              y={gridH + HOUR_LABEL_H - 3}
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

          {/* Zones de clic colonnes */}
          {HOURS.map((h, i) => (
            <rect
              key={`click-${h}`}
              x={LEFT_W + i * CELL_W} y={0}
              width={CELL_W} height={gridH + HOUR_LABEL_H}
              fill="transparent" className="cursor-pointer"
              onClick={() => setSelectedHour(h)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
