import { useWeatherStore } from '@/store/useWeatherStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Play, Pause, Wind, Thermometer, Cloud, CloudRain } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { WeatherLayer, DaySelection, WindUnit } from '@/types/weather';

const layerIcons: Record<WeatherLayer, React.ReactNode> = {
  wind: <Wind className="h-3.5 w-3.5" />,
  temperature: <Thermometer className="h-3.5 w-3.5" />,
  clouds: <Cloud className="h-3.5 w-3.5" />,
  precipitation: <CloudRain className="h-3.5 w-3.5" />,
};

const layerLabels: Record<WeatherLayer, string> = {
  wind: 'Vent',
  temperature: 'Temp.',
  clouds: 'Nuages',
  precipitation: 'Pluie',
};

export function ControlBar() {
  const {
    selectedHour, daySelection, weatherLayer, isPlaying,
    setSelectedHour, setDaySelection, setWeatherLayer,
    setIsPlaying, nextHour, prevHour,
  } = useWeatherStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        const current = useWeatherStore.getState().selectedHour;
        if (current >= 23) {
          useWeatherStore.getState().setIsPlaying(false);
        } else {
          useWeatherStore.getState().nextHour();
        }
      }, 800);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying]);

  const today = new Date();
  const displayDate = new Date(today);
  if (daySelection === 'tomorrow') displayDate.setDate(displayDate.getDate() + 1);

  const dateStr = displayDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-card border-b border-border">
      {/* Day selector */}
      <div className="flex gap-1">
        {(['today', 'tomorrow'] as DaySelection[]).map((d) => (
          <Button
            key={d}
            variant={daySelection === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDaySelection(d)}
            className="text-xs"
          >
            {d === 'today' ? "Aujourd'hui" : 'Demain'}
          </Button>
        ))}
      </div>

      {/* Date display */}
      <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
        {dateStr}
      </span>

      {/* Timeline */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={prevHour}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={nextHour}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="flex gap-0.5 overflow-x-auto flex-1 min-w-0">
          {Array.from({ length: 24 }, (_, i) => (
            <button
              key={i}
              onClick={() => setSelectedHour(i)}
              className={`text-[10px] px-1 py-0.5 rounded min-w-[24px] transition-colors ${
                i === selectedHour
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {String(i).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>

      {/* Hour display */}
      <span className="text-sm font-bold tabular-nums min-w-[40px] text-center">
        {String(selectedHour).padStart(2, '0')}:00
      </span>

      {/* Layer selector */}
      <div className="flex gap-0.5">
        {(Object.keys(layerIcons) as WeatherLayer[]).map((l) => (
          <Button
            key={l}
            variant={weatherLayer === l ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setWeatherLayer(l)}
          >
            {layerIcons[l]}
            <span className="hidden md:inline">{layerLabels[l]}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
