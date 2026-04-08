import { create } from 'zustand';
import type { Position, WeatherData, DaySelection } from '@/types/weather';
import { fetchAromeData } from '@/services/aromeClient';
import { normalizeAromeResponse } from '@/services/normalizer';

interface WeatherState {
  position: Position;
  selectedHour: number;
  daySelection: DaySelection;
  maxAltitude: number;
  weatherData: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  showParcelTrajectory: boolean;
  mobileTab: 'analysis' | 'map';

  setPosition: (pos: Position) => void;
  setSelectedHour: (hour: number) => void;
  setDaySelection: (day: DaySelection) => void;
  setMaxAltitude: (alt: number) => void;
  setShowParcelTrajectory: (show: boolean) => void;
  setMobileTab: (tab: 'analysis' | 'map') => void;
}

const DEFAULT_POSITION: Position = { lat: 45.19, lng: 5.73 }; // Grenoble

async function loadWeather(lat: number, lng: number): Promise<WeatherData> {
  const raw = await fetchAromeData(lat, lng);
  return normalizeAromeResponse(raw, lat, lng);
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  position:            DEFAULT_POSITION,
  selectedHour:        12,
  daySelection:        'today',
  maxAltitude:         3000,
  weatherData:         null,
  isLoading:           true,
  error:               null,
  showParcelTrajectory: false,
  mobileTab:           'analysis',

  setPosition: (pos) => {
    set({ position: pos, isLoading: true, error: null, weatherData: null });
    loadWeather(pos.lat, pos.lng)
      .then((data) => {
        // Ignorer si la position a changé entre-temps
        if (get().position.lat === pos.lat && get().position.lng === pos.lng) {
          set({ weatherData: data, isLoading: false });
        }
      })
      .catch((err: unknown) => {
        if (get().position.lat === pos.lat && get().position.lng === pos.lng) {
          set({ isLoading: false, error: String(err) });
        }
      });
  },

  setSelectedHour:        (hour) => set({ selectedHour: hour }),
  setDaySelection:        (day)  => set({ daySelection: day }),
  setMaxAltitude:         (alt)  => set({ maxAltitude: alt }),
  setShowParcelTrajectory:(show) => set({ showParcelTrajectory: show }),
  setMobileTab:           (tab)  => set({ mobileTab: tab }),
}));

// Chargement initial dès l'import du store
loadWeather(DEFAULT_POSITION.lat, DEFAULT_POSITION.lng)
  .then((data) => useWeatherStore.setState({ weatherData: data, isLoading: false }))
  .catch((err: unknown) => useWeatherStore.setState({ isLoading: false, error: String(err) }));
