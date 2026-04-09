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

// AbortController du fetch en cours — annule toute requête précédente
// quand l'utilisateur change de position avant la fin du chargement.
let currentAbort: AbortController | null = null;

export const useWeatherStore = create<WeatherState>((set) => ({
  position:             DEFAULT_POSITION,
  selectedHour:         12,
  daySelection:         'today',
  maxAltitude:          3000,
  weatherData:          null,
  isLoading:            true,
  error:                null,
  showParcelTrajectory: false,
  mobileTab:            'analysis',

  setPosition: (pos) => {
    // Annuler le fetch précédent s'il est encore en cours
    currentAbort?.abort();
    currentAbort = new AbortController();
    const { signal } = currentAbort;

    set({ position: pos, isLoading: true, error: null, weatherData: null });

    fetchAromeData(pos.lat, pos.lng, signal)
      .then((raw) => {
        if (signal.aborted) return;
        const data = normalizeAromeResponse(raw, pos.lat, pos.lng);
        set({ weatherData: data, isLoading: false });
      })
      .catch((err: unknown) => {
        // Ignorer les erreurs d'annulation volontaire
        if (signal.aborted) return;
        set({ isLoading: false, error: String(err) });
      });
  },

  setSelectedHour:         (hour) => set({ selectedHour: hour }),
  setDaySelection:         (day)  => set({ daySelection: day }),
  setMaxAltitude:          (alt)  => set({ maxAltitude: alt }),
  setShowParcelTrajectory: (show) => set({ showParcelTrajectory: show }),
  setMobileTab:            (tab)  => set({ mobileTab: tab }),
}));

// Chargement initial — passe par setPosition pour bénéficier de la
// même logique d'annulation que les clics utilisateur.
useWeatherStore.getState().setPosition(DEFAULT_POSITION);
