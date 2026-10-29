import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SettingsState, ThemeConfig } from '../types';

export const THEMES: Record<string, ThemeConfig> = {
  white: {
    id: 'white',
    name: 'Clean White',
    primaryColor: '#000000',
    bgClass: 'bg-white',
    gradient1: 'bg-slate-100',
    gradient2: 'bg-slate-50',
    gradient3: 'bg-gray-100',
    mode: 'light'
  },
  black: {
    id: 'black',
    name: 'Pure Black',
    primaryColor: '#ffffff',
    bgClass: 'bg-black',
    gradient1: 'bg-gray-900',
    gradient2: 'bg-slate-900',
    gradient3: 'bg-zinc-900',
    mode: 'dark'
  },
  frosted: {
    id: 'frosted',
    name: 'Frosted Glass',
    primaryColor: '#2563eb',
    bgClass: 'bg-slate-900',
    gradient1: 'bg-blue-600/30',
    gradient2: 'bg-purple-600/30',
    gradient3: 'bg-pink-500/20'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Forest',
    primaryColor: '#10b981',
    bgClass: 'bg-green-950',
    gradient1: 'bg-emerald-600/30',
    gradient2: 'bg-teal-600/30',
    gradient3: 'bg-green-500/20'
  },
  sunset: {
    id: 'sunset',
    name: 'Desert Sunset',
    primaryColor: '#f97316',
    bgClass: 'bg-orange-950',
    gradient1: 'bg-orange-600/30',
    gradient2: 'bg-red-600/30',
    gradient3: 'bg-yellow-500/20'
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Void',
    primaryColor: '#6366f1',
    bgClass: 'bg-gray-950',
    gradient1: 'bg-indigo-600/20',
    gradient2: 'bg-blue-600/20',
    gradient3: 'bg-violet-500/10'
  }
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dashboard: {
        showStats: true,
        showCropChart: true,
        showScoreChart: true,
        showRecentInterventions: true,
      },
      theme: THEMES.frosted,
      features: {
        enableFoodBank: true,
        enableMonitoring: true,
        enableActivityLog: true,
        enableMap: true,
      },
      updateDashboard: (settings) => set((state) => ({ dashboard: { ...state.dashboard, ...settings } })),
      setTheme: (theme) => set({ theme }),
      updateFeatures: (features) => set((state) => ({ features: { ...state.features, ...features } })),
    }),
    {
      name: 'agri-os-settings',
    }
  )
);
