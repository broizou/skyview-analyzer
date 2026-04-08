import { useWeatherStore } from '@/store/useWeatherStore';
import { convertWindSpeed, getWindColor } from '@/services/mockWeatherData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WindUnit } from '@/types/weather';

function WindArrow({ direction, size = 14 }: { direction: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
      <g transform={`rotate(${direction}, 10, 10)`}>
        <line x1="10" y1="16" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="10,2 7,7 13,7" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Windgram() {
  const { weatherData, daySelection, selectedHour, maxAltitude, windUnit, setMaxAltitude, setWindUnit } = useWeatherStore();

  if (!weatherData) return null;

  const dayIdx = daySelection === 'today' ? 0 : 1;
  const forecast = weatherData.forecasts[dayIdx];
  if (!forecast) return null;

  const altitudes = Array.from({ length: maxAltitude / 100 + 1 }, (_, i) => i * 100).reverse();
  const hours = Array.from({ length: 24 }, (_, i) => i);

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

      {/* Cloud/precip header */}
      <div className="flex border-b border-border">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1 overflow-x-auto">
          {hours.map((h) => {
            const profile = forecast.profiles[h];
            return (
              <div
                key={h}
                className={`flex flex-col items-center min-w-[32px] flex-1 py-0.5 text-[9px] ${
                  h === selectedHour ? 'bg-primary/10' : ''
                }`}
              >
                {profile.precipitation > 0.1 && (
                  <span className="text-blue-500 font-medium">{profile.precipitation.toFixed(1)}</span>
                )}
                <div className="flex gap-px">
                  {profile.cloudHigh > 0.3 && <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                  {profile.cloudMid > 0.3 && <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                  {profile.cloudLow > 0.3 && <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wind grid */}
      <div className="flex flex-1 overflow-auto">
        {/* Altitude labels */}
        <div className="w-12 shrink-0 flex flex-col">
          {altitudes.map((alt) => (
            <div key={alt} className="flex items-center justify-end pr-1 text-[9px] text-muted-foreground h-6 shrink-0">
              {alt % 500 === 0 ? `${alt}` : ''}
            </div>
          ))}
        </div>

        {/* Grid cells */}
        <div className="flex flex-1 overflow-x-auto">
          {hours.map((h) => {
            const profile = forecast.profiles[h];
            return (
              <div
                key={h}
                className={`flex flex-col min-w-[32px] flex-1 ${
                  h === selectedHour ? 'ring-2 ring-primary ring-inset' : ''
                }`}
              >
                {altitudes.map((alt) => {
                  const level = profile.levels.find((l) => l.altitude === alt);
                  if (!level) return <div key={alt} className="h-6 shrink-0" />;
                  const speed = convertWindSpeed(level.wind.speed, windUnit);
                  const bgColor = getWindColor(level.wind.speed);
                  return (
                    <div
                      key={alt}
                      className="h-6 shrink-0 flex items-center justify-center gap-px border-b border-border/30"
                      style={{ backgroundColor: bgColor }}
                      title={`${alt}m - ${speed}${windUnit} ${Math.round(level.wind.direction)}°`}
                    >
                      <WindArrow direction={level.wind.direction} size={10} />
                      <span className="text-[8px] font-medium text-foreground/80">{speed}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hour labels */}
      <div className="flex border-t border-border">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1">
          {hours.map((h) => (
            <div
              key={h}
              className={`min-w-[32px] flex-1 text-center text-[9px] py-0.5 ${
                h === selectedHour ? 'font-bold text-primary' : 'text-muted-foreground'
              }`}
            >
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
