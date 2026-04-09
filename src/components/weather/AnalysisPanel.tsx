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
      {isLoading && !error ? (
        <Spinner />
      ) : error ? (
        <ErrorPanel message={error} />
      ) : (
        <Tabs defaultValue="windgram" className="flex flex-col flex-1 min-h-0">
          {/* Barre compacte : onglets + coordonnées + spinner inline */}
          <div className="flex items-center gap-2 px-2 pt-1 pb-0 shrink-0 border-b border-border">
            <TabsList className="h-7">
              <TabsTrigger value="windgram" className="text-xs h-6">Windgram</TabsTrigger>
              <TabsTrigger value="emagram" className="text-xs h-6">Émagramme</TabsTrigger>
            </TabsList>
            <span className="text-[10px] text-muted-foreground">
              {position.lat.toFixed(3)}°N, {position.lng.toFixed(3)}°E
            </span>
            {isLoading && (
              <svg className="animate-spin h-3 w-3 ml-auto text-muted-foreground" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
          </div>
          <TabsContent value="windgram" className="flex-1 min-h-0 overflow-hidden mt-0">
            <Windgram />
          </TabsContent>
          <TabsContent value="emagram" className="flex-1 min-h-0 overflow-hidden mt-0">
            <Emagram />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
