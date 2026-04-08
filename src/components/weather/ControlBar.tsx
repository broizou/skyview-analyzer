import { useWeatherStore } from '@/store/useWeatherStore';
import { Button } from '@/components/ui/button';
import type { DaySelection } from '@/types/weather';

const sourceLabel: Record<string, string> = {
  arome:   'AROME HD',
  mock:    'Données simulées',
  loading: 'Chargement…',
};
const sourceDot: Record<string, string> = {
  arome:   'bg-green-500',
  mock:    'bg-yellow-400',
  loading: 'bg-gray-400 animate-pulse',
};

export function ControlBar() {
  const { daySelection, setDaySelection, dataSource } = useWeatherStore();

  const today = new Date();
  const displayDate = new Date(today);
  if (daySelection === 'tomorrow') displayDate.setDate(displayDate.getDate() + 1);

  const dateStr = displayDate.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

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
      <span className="text-xs font-medium text-muted-foreground">{dateStr}</span>

      {/* Source indicator */}
      <div className="ml-auto flex items-center gap-1.5">
        <span className={`inline-block w-2 h-2 rounded-full ${sourceDot[dataSource] ?? sourceDot.loading}`} />
        <span className="text-[10px] text-muted-foreground">{sourceLabel[dataSource] ?? dataSource}</span>
      </div>
    </div>
  );
}
