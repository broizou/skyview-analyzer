import { useWeatherStore } from '@/store/useWeatherStore';
import { Button } from '@/components/ui/button';
import type { DaySelection } from '@/types/weather';

export function ControlBar() {
  const { daySelection, setDaySelection } = useWeatherStore();

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
    </div>
  );
}
