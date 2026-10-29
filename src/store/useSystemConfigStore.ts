import { create } from 'zustand';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SystemConfig, ThemeConfig, SystemFeatures, DashboardSettings, BrandingData } from '../types';
import { useActivityLogStore } from './useActivityLogStore';

interface FullSystemConfig {
  features: SystemFeatures;
  dashboard: DashboardSettings;
  theme: ThemeConfig;
  branding: BrandingData;
}

interface SystemConfigState {
  config: FullSystemConfig | null;
  updateFeatures: (features: Partial<SystemFeatures>) => Promise<void>;
  updateDashboard: (settings: Partial<DashboardSettings>) => Promise<void>;
  setTheme: (theme: ThemeConfig) => Promise<void>;
  updateBranding: (data: Partial<BrandingData>) => Promise<void>;
}

const DEFAULT_CONFIG: FullSystemConfig = {
  features: { enableFoodBank: true, enableMonitoring: true, enableActivityLog: true, enableMap: true, enableFarmerTemplate: true },
  dashboard: { showStats: true, showCropChart: true, showScoreChart: true, showRecentInterventions: true },
  theme: { id: 'frosted', name: 'Frosted Glass', primaryColor: '#2563eb', bgClass: 'bg-slate-900', gradient1: 'bg-blue-600/30', gradient2: 'bg-purple-600/30', gradient3: 'bg-pink-500/20' },
  branding: { appName: 'Agri-OS', logo: '', primaryColor: '#16a34a' }
};

export const useSystemConfigStore = create<SystemConfigState>((set, get) => {
  onSnapshot(doc(db, 'systemConfig', 'main'), (docSnap) => {
    if (docSnap.exists()) {
      set({ config: { ...DEFAULT_CONFIG, ...docSnap.data() } as FullSystemConfig });
    } else {
      set({ config: DEFAULT_CONFIG });
    }
  });

  const updateConfig = async (key: keyof FullSystemConfig, value: any) => {
    const current = get().config || DEFAULT_CONFIG;
    const newConfig = { ...current, [key]: typeof value === 'object' && !Array.isArray(value) ? { ...(current[key] as any), ...value } : value };
    await setDoc(doc(db, 'systemConfig', 'main'), newConfig, { merge: true });
    
    useActivityLogStore.getState().logActivity({
      action: 'UPDATE',
      entityType: 'ORGANIZATION',
      entityId: 'SYSTEM',
      details: `Updated system config: ${key}`
    });
  };

  return {
    config: DEFAULT_CONFIG,
    updateFeatures: async (features) => updateConfig('features', features),
    updateDashboard: async (settings) => updateConfig('dashboard', settings),
    setTheme: async (theme) => updateConfig('theme', theme),
    updateBranding: async (data) => updateConfig('branding', data),
  };
});
