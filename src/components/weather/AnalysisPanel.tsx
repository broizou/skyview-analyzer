import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Windgram } from './Windgram';
import { Emagram } from './Emagram';
import { useWeatherStore } from '@/store/useWeatherStore';

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <svg className="animate-spin h-7 w-7" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span className="text-xs">Chargement AROME…</span>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
      <span className="text-destructive text-sm font-medium">Erreur de chargement</span>
      <span className="text-[11px] text-muted-foreground break-all">{message}</span>
    </div>
  );
}

export function AnalysisPanel() {
  const { position, isLoading, error } = useWeatherStore();

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold">Analyse</span>
        <span className="text-[10px] text-muted-foreground">
          {position.lat.toFixed(3)}°N, {position.lng.toFixed(3)}°E
        </span>
        {isLoading && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            AROME…
          </span>
        )}
      </div>

      {isLoading && !error ? (
        <Spinner />
      ) : error ? (
        <ErrorPanel message={error} />
      ) : (
        <Tabs defaultValue="windgram" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-2 mt-1 w-fit shrink-0">
            <TabsTrigger value="windgram" className="text-xs">Windgram</TabsTrigger>
            <TabsTrigger value="emagram" className="text-xs">Émagramme</TabsTrigger>
          </TabsList>
          <TabsContent value="windgram" className="flex-1 min-h-0 overflow-hidden">
            <Windgram />
          </TabsContent>
          <TabsContent value="emagram" className="flex-1 min-h-0 overflow-hidden">
            <Emagram />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
