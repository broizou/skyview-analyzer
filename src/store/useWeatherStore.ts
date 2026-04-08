import { create } from 'zustand';
import type { Position, WeatherData, DaySelection } from '@/types/weather';
import { generateWeatherData } from '@/services/mockWeatherData';

interface WeatherState {
  position: Position;
  selectedHour: number;
  daySelection: DaySelection;
  maxAltitude: number;
  weatherData: WeatherData | null;
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

export const useWeatherStore = create<WeatherState>((set) => ({
  position: DEFAULT_POSITION,
  selectedHour: 12,
  daySelection: 'today',
  maxAltitude: 3000,
  weatherData: generateWeatherData(DEFAULT_POSITION),
  showParcelTrajectory: false,
  mobileTab: 'analysis',

  setPosition: (pos) => set({ position: pos, weatherData: generateWeatherData(pos) }),
  setSelectedHour: (hour) => set({ selectedHour: hour }),
  setDaySelection: (day) => set({ daySelection: day }),
  setMaxAltitude: (alt) => set({ maxAltitude: alt }),
  setShowParcelTrajectory: (show) => set({ showParcelTrajectory: show }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
}));
