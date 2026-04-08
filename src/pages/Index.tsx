import { useRef, useState, useCallback, useEffect } from 'react';
import { ControlBar } from '@/components/weather/ControlBar';
import { AnalysisPanel } from '@/components/weather/AnalysisPanel';
import { WeatherMap } from '@/components/weather/WeatherMap';
import { useWeatherStore } from '@/store/useWeatherStore';
import { Button } from '@/components/ui/button';
import { BarChart3, Map } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const MIN_PCT = 20;
const MAX_PCT = 80;

const Index = () => {
  const isMobile = useIsMobile();
  const { mobileTab, setMobileTab } = useWeatherStore();

  const [splitPct, setSplitPct] = useState(60);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ControlBar />

      {isMobile ? (
        <div className="flex flex-col flex-1 min-h-0">
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
        <div ref={containerRef} className="flex flex-1 min-h-0">
          {/* Analysis panel */}
          <div className="min-w-[320px] overflow-hidden" style={{ width: `${splitPct}%` }}>
            <AnalysisPanel />
          </div>

          {/* Drag handle */}
          <div
            className="relative w-1 shrink-0 bg-border hover:bg-primary/40 transition-colors cursor-col-resize group"
            onMouseDown={() => {
              isDragging.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
          >
            {/* Visual grip dots */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-primary/60" />
              ))}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 min-h-0 min-w-[200px]">
            <WeatherMap />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
