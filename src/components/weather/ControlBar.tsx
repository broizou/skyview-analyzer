import { useWeatherStore } from '@/store/useWeatherStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DaySelection } from '@/types/weather';

export function ControlBar() {
  const {
    daySelection, setDaySelection,
    activeTab, setActiveTab,
    maxAltitude, setMaxAltitude,
    position, isLoading,
  } = useWeatherStore();

  const today = new Date();
  const displayDate = new Date(today);
  if (daySelection === 'tomorrow') displayDate.setDate(displayDate.getDate() + 1);

  const dateStr = displayDate.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-card border-b border-border shrink-0">
      {/* Day selector */}
      <div className="flex gap-1">
        {(['today', 'tomorrow'] as DaySelection[]).map((d) => (
          <Button
            key={d}
            variant={daySelection === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDaySelection(d)}
            className="h-6 text-xs px-2"
          >
            {d === 'today' ? "Aujourd'hui" : 'Demain'}
          </Button>
        ))}
      </div>

      <span className="text-xs text-muted-foreground">{dateStr}</span>

      {/* Separator */}
      <div className="w-px h-4 bg-border mx-1" />

      {/* Tab selector */}
      <div className="flex gap-1">
        {(['windgram', 'emagram'] as const).map((t) => (
          <Button
            key={t}
            variant={activeTab === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(t)}
            className="h-6 text-xs px-2"
          >
            {t === 'windgram' ? 'Windgram' : 'Émagramme'}
          </Button>
        ))}
      </div>

      {/* Alt. max — only for windgram */}
      {activeTab === 'windgram' && (
        <>
          <span className="text-[11px] text-muted-foreground">Alt. max</span>
          <Select value={String(maxAltitude)} onValueChange={(v) => setMaxAltitude(Number(v))}>
            <SelectTrigger className="h-6 w-[72px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1000, 2000, 3000, 4000, 5000].map((a) => (
                <SelectItem key={a} value={String(a)}>{a} m</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {/* Coordinates + spinner — pushed right */}
      <span className="ml-auto text-[10px] text-muted-foreground">
        {position.lat.toFixed(3)}°N, {position.lng.toFixed(3)}°E
      </span>
      {isLoading && (
        <svg className="animate-spin h-3 w-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
    </div>
  );
}
