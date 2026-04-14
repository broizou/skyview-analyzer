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
  const { isLoading, error, activeTab } = useWeatherStore();

  if (isLoading && !error) return <div className="flex flex-col h-full bg-card"><Spinner /></div>;
  if (error)               return <div className="flex flex-col h-full bg-card"><ErrorPanel message={error} /></div>;

  return (
    <div className="flex flex-col h-full bg-card">
      {activeTab === 'windgram' ? <Windgram /> : <Emagram />}
    </div>
  );
}
