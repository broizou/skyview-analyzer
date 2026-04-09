import { useWeatherStore } from '@/store/useWeatherStore';
import { useRef, useEffect, useCallback } from 'react';

function WindBarb({ direction, speed, x, y }: { direction: number; speed: number; x: number; y: number }) {
  const kmh = speed * 3.6;
  const barbLength = 25;
  const flagSpacing = 5;
  
  const flags: React.ReactNode[] = [];
  let remaining = kmh;
  let offset = 0;

  while (remaining >= 50) {
    flags.push(
      <polygon
        key={`p-${offset}`}
        points={`0,${-offset} -8,${-offset - flagSpacing / 2} 0,${-offset - flagSpacing}`}
        fill="currentColor"
      />
    );
    remaining -= 50;
    offset += flagSpacing;
  }
  while (remaining >= 10) {
    flags.push(
      <line key={`l-${offset}`} x1="0" y1={-offset} x2="-8" y2={-offset - 3} stroke="currentColor" strokeWidth="1.5" />
    );
    remaining -= 10;
    offset += 3;
  }
  if (remaining >= 5) {
    flags.push(
      <line key={`s-${offset}`} x1="0" y1={-offset} x2="-4" y2={-offset - 2} stroke="currentColor" strokeWidth="1.2" />
    );
  }

  return (
    <g transform={`translate(${x},${y}) rotate(${direction + 180})`}>
      <line x1="0" y1="0" x2="0" y2={-barbLength} stroke="currentColor" strokeWidth="1.5" />
      <g transform={`translate(0,${-barbLength})`}>{flags}</g>
    </g>
  );
}

export function Emagram() {
  const { weatherData, daySelection, selectedHour, showParcelTrajectory, setShowParcelTrajectory } = useWeatherStore();
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!weatherData) return null;

  const dayIdx = daySelection === 'today' ? 0 : 1;
  const forecast = weatherData.forecasts[dayIdx];
  if (!forecast) return null;

  const profile = forecast.profiles[selectedHour];
  if (!profile) return null;
  const levels = profile.levels.filter((l) => l.altitude <= 5000);

  // Diagram dimensions
  const margin = { top: 20, right: 50, bottom: 30, left: 45 };
  const width = 400;
  const height = 500;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Scales
  const tempMin = -30, tempMax = 40;
  const altMin = 0, altMax = 5000;

  const xScale = (temp: number) => margin.left + ((temp - tempMin) / (tempMax - tempMin)) * plotW;
  const yScale = (alt: number) => margin.top + plotH - ((alt - altMin) / (altMax - altMin)) * plotH;

  // Isotherms (oblique lines skewed by altitude)
  const isotherms = [];
  for (let t = tempMin; t <= tempMax; t += 10) {
    const skew = 0.003; // degrees per meter
    const y0 = yScale(altMin);
    const x0 = xScale(t + altMin * skew);
    const y1 = yScale(altMax);
    const x1 = xScale(t + altMax * skew);
    isotherms.push(
      <line key={`iso-${t}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4,4" />
    );
    // Label
    if (t % 10 === 0) {
      isotherms.push(
        <text key={`iso-l-${t}`} x={x0} y={y0 + 12} fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle">{t}°</text>
      );
    }
  }

  // BLH highlight
  const blh = profile.boundaryLayerHeight;
  const blhY = yScale(blh);

  // Temperature and dewpoint curves
  const skew = 0.003;
  const tempPath = levels.map((l, i) => {
    const x = xScale(l.temperature + l.altitude * skew);
    const y = yScale(l.altitude);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const dewPath = levels.map((l, i) => {
    const x = xScale(l.dewpoint + l.altitude * skew);
    const y = yScale(l.altitude);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  // Parcel trajectory (dry adiabatic from surface, simplified)
  let parcelPath = '';
  if (showParcelTrajectory) {
    const surfaceTemp = levels[0].temperature;
    const dryLapseRate = 9.8; // °C per 1000m
    parcelPath = levels.map((l, i) => {
      const parcelTemp = surfaceTemp - (l.altitude / 1000) * dryLapseRate;
      const x = xScale(parcelTemp + l.altitude * skew);
      const y = yScale(l.altitude);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  // Altitude grid lines
  const altGridLines = [];
  for (let a = 0; a <= altMax; a += 500) {
    const y = yScale(a);
    altGridLines.push(
      <g key={`ag-${a}`}>
        <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="hsl(var(--border))" strokeWidth="0.3" />
        <text x={margin.left - 4} y={y + 3} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="end">
          {a}
        </text>
      </g>
    );
  }

  // Wind barbs on the right
  const barbLevels = levels.filter((l) => l.altitude % 500 === 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <span className="text-xs font-medium">Émagramme</span>
        <span className="text-xs text-muted-foreground">— {String(selectedHour).padStart(2, '0')}:00</span>
        <label className="flex items-center gap-1 ml-auto text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={showParcelTrajectory}
            onChange={(e) => setShowParcelTrajectory(e.target.checked)}
            className="w-3 h-3"
          />
          Parcelle
        </label>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[450px] h-auto" style={{ minHeight: 300 }}>
          {/* Background */}
          <rect x={margin.left} y={margin.top} width={plotW} height={plotH} fill="hsl(var(--card))" />

          {/* BLH zone */}
          <rect
            x={margin.left}
            y={blhY}
            width={plotW}
            height={yScale(0) - blhY}
            fill="hsl(var(--primary) / 0.08)"
            stroke="hsl(var(--primary) / 0.3)"
            strokeWidth="1"
            strokeDasharray="6,3"
          />
          <text x={margin.left + 4} y={blhY + 12} fontSize="8" fill="hsl(var(--primary))">
            CL {Math.round(blh)}m
          </text>

          {/* Isotherms */}
          {isotherms}

          {/* Alt grid */}
          {altGridLines}

          {/* Dewpoint */}
          <path d={dewPath} fill="none" stroke="hsl(160, 60%, 45%)" strokeWidth="2" />

          {/* Temperature */}
          <path d={tempPath} fill="none" stroke="hsl(0, 70%, 55%)" strokeWidth="2.5" />

          {/* Parcel */}
          {showParcelTrajectory && parcelPath && (
            <path d={parcelPath} fill="none" stroke="hsl(45, 80%, 50%)" strokeWidth="1.5" strokeDasharray="5,3" />
          )}

          {/* Wind barbs */}
          <g className="text-foreground">
            {barbLevels.map((l) => (
              <WindBarb
                key={l.altitude}
                direction={l.wind.direction}
                speed={l.wind.speed}
                x={width - margin.right + 20}
                y={yScale(l.altitude)}
              />
            ))}
          </g>

          {/* Axes labels */}
          <text x={width / 2} y={height - 4} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">
            Température (°C)
          </text>
          <text x={12} y={height / 2} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle" transform={`rotate(-90, 12, ${height / 2})`}>
            Altitude (m)
          </text>

          {/* Legend */}
          <g transform={`translate(${margin.left + 8}, ${margin.top + 12})`}>
            <line x1="0" y1="0" x2="16" y2="0" stroke="hsl(0, 70%, 55%)" strokeWidth="2" />
            <text x="20" y="3" fontSize="8" fill="hsl(var(--foreground))">T°</text>
            <line x1="0" y1="12" x2="16" y2="12" stroke="hsl(160, 60%, 45%)" strokeWidth="2" />
            <text x="20" y="15" fontSize="8" fill="hsl(var(--foreground))">Td</text>
            {showParcelTrajectory && (
              <>
                <line x1="0" y1="24" x2="16" y2="24" stroke="hsl(45, 80%, 50%)" strokeWidth="1.5" strokeDasharray="4,2" />
                <text x="20" y="27" fontSize="8" fill="hsl(var(--foreground))">Parcelle</text>
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
