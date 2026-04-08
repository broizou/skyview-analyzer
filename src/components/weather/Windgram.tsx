import { useWeatherStore } from '@/store/useWeatherStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo } from 'react';

// 8h → 21h inclusive
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

/** Wind colour scale (km/h) */
function getArrowColor(speedMs: number): string {
  const kmh = speedMs * 3.6;
  if (kmh < 10) return '#60c4e0'; // bleu clair
  if (kmh < 20) return '#4caf50'; // vert
  if (kmh < 30) return '#ff9800'; // orange
  return '#f44336';               // rouge
}

/**
 * Arrow drawn in local space: tail at top, tip at bottom, then rotated by wind direction.
 * Size scales noticeably with speed: 5 px (calm) → 17 px (strong).
 */
function WindArrow({
  cx, cy, direction, speedMs, color,
}: {
  cx: number; cy: number; direction: number; speedMs: number; color: string;
}) {
  const kmh = speedMs * 3.6;
  if (kmh < 0.5) return null;                            // calme, rien à dessiner

  const len    = Math.min(4 + Math.sqrt(kmh) * 2.4, 18); // 4 → 18 px
  const headH  = len * 0.38;
  const headW  = len * 0.34;
  const shaft  = Math.min(1.3 + kmh / 28, 2.5);          // épaisseur proportionnelle

  // tip vers le bas en espace local → pointe dans la direction du vent après rotation
  const tipY  =  len / 2;
  const tailY = -len / 2;

  return (
    <g transform={`translate(${cx},${cy}) rotate(${direction})`}>
      <line
        x1={0} y1={tailY}
        x2={0} y2={tipY - headH}
        stroke={color} strokeWidth={shaft} strokeLinecap="round"
      />
      <polygon
        points={`0,${tipY} ${-headW / 2},${tipY - headH} ${headW / 2},${tipY - headH}`}
        fill={color}
      />
    </g>
  );
}

/**
 * Courbe lissée (bezier) passant par les points de hauteur de couche limite.
 * Retourne un path SVG fermé.
 */
function buildThermalPath(
  thermalData: Array<{ blh: number }>,
  leftW: number,
  cellW: number,
  gridH: number,
  maxAltitude: number,
): string {
  const pts = thermalData.map((d, i) => ({
    x: leftW + i * cellW + cellW / 2,
    y: (1 - Math.min(d.blh, maxAltitude) / maxAltitude) * gridH,
  }));
  if (pts.length === 0) return '';

  // Courbe cubique : point de contrôle au milieu horizontal de chaque segment
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  // Fermeture sur le sol
  d += ` L${pts[pts.length - 1].x},${gridH} L${pts[0].x},${gridH} Z`;
  return d;
}

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

  const thermalData = useMemo(() => {
    if (!forecast) return null;
    return HOURS.map((h) => ({ hour: h, blh: forecast.profiles[h].boundaryLayerHeight }));
  }, [forecast]);

  if (!forecast || !thermalData) return null;

  // ── Dimensions ──────────────────────────────────────────────────────────────
  // CELL_W réduit de ~20 % (54 → 43), CELL_H réduit pour tenir sur mobile (20 → 17)
  const CELL_W       = 43;
  const CELL_H       = 17;
  const LEFT_W       = 44;
  const HOUR_LABEL_H = 20;
  const gridW        = HOURS.length * CELL_W;
  const gridH        = altitudes.length * CELL_H;
  const totalW       = LEFT_W + gridW;
  const totalH       = gridH + HOUR_LABEL_H;

  // Intensité thermique : basée sur le pic de la journée → opacité douce 0.12-0.32
  const peakBLH           = Math.max(...thermalData.map((d) => d.blh));
  const thermalFillOpacity = 0.12 + Math.min(peakBLH / 2500, 1) * 0.20;
  const thermalPath        = buildThermalPath(thermalData, LEFT_W, CELL_W, gridH, maxAltitude);

  return (
    <div className="flex flex-col h-full">
      {/* En-tête : altitude max + légende couleurs */}
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

      {/* SVG — taille fixe, scroll horizontal si nécessaire, pas de scroll vertical */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <svg
          width={totalW}
          height="100%"
          viewBox={`0 0 ${totalW} ${totalH}`}
          preserveAspectRatio="xMinYMin meet"
          className="block select-none"
          style={{ minWidth: totalW }}
        >
          {/* Zone thermique — courbe lissée, jaune pâle, intensité ∝ BLH max du jour */}
          <path d={thermalPath} fill="#fde047" opacity={thermalFillOpacity} />

          {/* Lignes de grille horizontales tous les 500 m */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <line
                key={`g-${alt}`}
                x1={LEFT_W}   y1={i * CELL_H + CELL_H / 2}
                x2={totalW}   y2={i * CELL_H + CELL_H / 2}
                stroke="#ddd" strokeWidth={0.5}
              />
            ) : null,
          )}

          {/* Colonne heure sélectionnée */}
          {HOURS.includes(selectedHour) && (
            <rect
              x={LEFT_W + HOURS.indexOf(selectedHour) * CELL_W}
              y={0} width={CELL_W} height={gridH}
              fill="hsl(var(--primary) / 0.07)"
            />
          )}

          {/* Labels altitude */}
          {altitudes.map((alt, i) =>
            alt % 500 === 0 ? (
              <text
                key={`a-${alt}`}
                x={LEFT_W - 5}
                y={i * CELL_H + CELL_H / 2 + 3.5}
                textAnchor="end" fontSize={10} fill="#888" fontFamily="system-ui"
              >
                {alt}
              </text>
            ) : null,
          )}

          {/* Flèches de vent + vitesse */}
          {HOURS.map((h, hIdx) => {
            const profile = forecast.profiles[h];
            return altitudes.map((alt, aIdx) => {
              const level = profile.levels.find((l) => l.altitude === alt);
              if (!level) return null;
              const cx       = LEFT_W + hIdx * CELL_W + CELL_W / 2;
              const cy       = aIdx * CELL_H + CELL_H / 2;
              const color    = getArrowColor(level.wind.speed);
              const speedKmh = Math.round(level.wind.speed * 3.6);

              return (
                <g key={`c-${h}-${alt}`}>
                  {/* Flèche dont la taille est proportionnelle à la vitesse */}
                  <WindArrow
                    cx={cx - 7} cy={cy}
                    direction={level.wind.direction}
                    speedMs={level.wind.speed}
                    color={color}
                  />
                  {/* Valeur numérique */}
                  <text
                    x={cx + 5} y={cy + 3.5}
                    fontSize={8} fill={color} fontWeight={500} fontFamily="system-ui"
                  >
                    {speedKmh}
                  </text>
                </g>
              );
            });
          })}

          {/* Labels heures — cliquables */}
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

          {/* Zones de clic invisibles sur les colonnes */}
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
