import { ControlBar } from '@/components/weather/ControlBar';
import { AnalysisPanel } from '@/components/weather/AnalysisPanel';
import { WeatherMap } from '@/components/weather/WeatherMap';
import { useWeatherStore } from '@/store/useWeatherStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { BarChart3, Map } from 'lucide-react';

const Index = () => {
  const isMobile = useIsMobile();
  const { mobileTab, setMobileTab } = useWeatherStore();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Control bar */}
      <ControlBar />

      {/* Main content */}
      {isMobile ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Mobile tabs */}
          <div className="flex border-b border-border bg-card">
            <Button
              variant={mobileTab === 'analysis' ? 'default' : 'ghost'}
              className="flex-1 rounded-none gap-1.5 text-xs h-9"
              onClick={() => setMobileTab('analysis')}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analyse
            </Button>
            <Button
              variant={mobileTab === 'map' ? 'default' : 'ghost'}
              className="flex-1 rounded-none gap-1.5 text-xs h-9"
              onClick={() => setMobileTab('map')}
            >
              <Map className="h-3.5 w-3.5" />
              Carte
            </Button>
          </div>

          <div className="flex-1 min-h-0">
            {mobileTab === 'analysis' ? <AnalysisPanel /> : <WeatherMap />}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Analysis panel - left 60% */}
          <div className="w-[60%] min-w-[400px] border-r border-border overflow-hidden">
            <AnalysisPanel />
          </div>
          {/* Map - right 40% */}
          <div className="flex-1 min-h-0">
            <WeatherMap />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
