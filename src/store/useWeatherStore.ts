import { create } from 'zustand';
import type { Position, WeatherData, DaySelection } from '@/types/weather';
import { generateWeatherData } from '@/services/mockWeatherData';
import { fetchWeatherDataWithFallback } from '@/services/weatherApi';

type DataSource = 'arome' | 'mock' | 'loading';

interface WeatherState {
  position: Position;
  selectedHour: number;
  daySelection: DaySelection;
  maxAltitude: number;
  weatherData: WeatherData | null;
  showParcelTrajectory: boolean;
  mobileTab: 'analysis' | 'map';
  dataSource: DataSource;

  setPosition: (pos: Position) => void;
  setSelectedHour: (hour: number) => void;
  setDaySelection: (day: DaySelection) => void;
  setMaxAltitude: (alt: number) => void;
  setShowParcelTrajectory: (show: boolean) => void;
  setMobileTab: (tab: 'analysis' | 'map') => void;
}

const DEFAULT_POSITION: Position = { lat: 45.19, lng: 5.73 }; // Grenoble

export const useWeatherStore = create<WeatherState>((set) => ({
  position: DEFAULT_POSITION,
  selectedHour: 12,
  daySelection: 'today',
  maxAltitude: 3000,
  // Données mock immédiates le temps que le backend réponde
  weatherData: generateWeatherData(DEFAULT_POSITION),
  showParcelTrajectory: false,
  mobileTab: 'analysis',
  dataSource: 'loading',

  setPosition: (pos) => {
    // Mise à jour immédiate avec les données mock pour ne pas bloquer l'UI
    set({ position: pos, dataSource: 'loading', weatherData: generateWeatherData(pos) });
    // Fetch asynchrone des vraies données
    fetchWeatherDataWithFallback(pos.lat, pos.lng).then(({ data, source }) => {
      // Vérifier que la position n'a pas changé entre-temps
      const current = useWeatherStore.getState().position;
      if (current.lat === pos.lat && current.lng === pos.lng) {
        set({ weatherData: data, dataSource: source });
      }
    });
  },

  setSelectedHour: (hour) => set({ selectedHour: hour }),
  setDaySelection: (day) => set({ daySelection: day }),
  setMaxAltitude: (alt) => set({ maxAltitude: alt }),
  setShowParcelTrajectory: (show) => set({ showParcelTrajectory: show }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
}));

// Chargement initial des données réelles au démarrage de l'app
fetchWeatherDataWithFallback(DEFAULT_POSITION.lat, DEFAULT_POSITION.lng).then(
  ({ data, source }) => useWeatherStore.setState({ weatherData: data, dataSource: source }),
);
