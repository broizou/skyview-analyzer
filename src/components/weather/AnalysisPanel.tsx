import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Windgram } from './Windgram';
import { Emagram } from './Emagram';
import { useWeatherStore } from '@/store/useWeatherStore';

export function AnalysisPanel() {
  const { position } = useWeatherStore();

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
        <span className="text-xs font-semibold">Analyse</span>
        <span className="text-[10px] text-muted-foreground">
          {position.lat.toFixed(3)}°N, {position.lng.toFixed(3)}°E
        </span>
      </div>
      <Tabs defaultValue="windgram" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-2 mt-1 w-fit">
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
    </div>
  );
}
