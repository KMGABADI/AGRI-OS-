import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BrandingState } from '../types';

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      appName: 'Agri-OS',
      logo: '',
      primaryColor: '#16a34a',
      updateBranding: (data) => set((state) => ({ ...state, ...data })),
    }),
    {
      name: 'agri-os-branding',
    }
  )
);
