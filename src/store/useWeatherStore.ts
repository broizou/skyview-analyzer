import { create } from 'zustand';
import type { Position, WeatherData, WindUnit, WeatherLayer, DaySelection } from '@/types/weather';
import { generateWeatherData } from '@/services/mockWeatherData';

interface WeatherState {
  position: Position;
  selectedHour: number;
  daySelection: DaySelection;
  windUnit: WindUnit;
  weatherLayer: WeatherLayer;
  maxAltitude: number;
  weatherData: WeatherData | null;
  isPlaying: boolean;
  showParcelTrajectory: boolean;
  mobileTab: 'analysis' | 'map';

  setPosition: (pos: Position) => void;
  setSelectedHour: (hour: number) => void;
  setDaySelection: (day: DaySelection) => void;
  setWindUnit: (unit: WindUnit) => void;
  setWeatherLayer: (layer: WeatherLayer) => void;
  setMaxAltitude: (alt: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setShowParcelTrajectory: (show: boolean) => void;
  setMobileTab: (tab: 'analysis' | 'map') => void;
  nextHour: () => void;
  prevHour: () => void;
}

const DEFAULT_POSITION: Position = { lat: 45.19, lng: 5.73 }; // Grenoble area

export const useWeatherStore = create<WeatherState>((set, get) => ({
  position: DEFAULT_POSITION,
  selectedHour: 12,
  daySelection: 'today',
  windUnit: 'km/h',
  weatherLayer: 'wind',
  maxAltitude: 3000,
  weatherData: generateWeatherData(DEFAULT_POSITION),
  isPlaying: false,
  showParcelTrajectory: false,
  mobileTab: 'analysis',

  setPosition: (pos) => set({ position: pos, weatherData: generateWeatherData(pos) }),
  setSelectedHour: (hour) => set({ selectedHour: hour }),
  setDaySelection: (day) => set({ daySelection: day }),
  setWindUnit: (unit) => set({ windUnit: unit }),
  setWeatherLayer: (layer) => set({ weatherLayer: layer }),
  setMaxAltitude: (alt) => set({ maxAltitude: alt }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setShowParcelTrajectory: (show) => set({ showParcelTrajectory: show }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  nextHour: () => set((s) => ({ selectedHour: Math.min(23, s.selectedHour + 1) })),
  prevHour: () => set((s) => ({ selectedHour: Math.max(0, s.selectedHour - 1) })),
}));
