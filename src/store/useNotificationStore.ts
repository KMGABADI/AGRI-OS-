import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Alert {
  id: string;
  farmerId: string;
  type: 'Harvest' | 'SoilHealth' | 'Weather' | 'System';
  message: string;
  status: 'Pending' | 'Sent' | 'Failed';
  createdAt: string;
  sentAt?: string;
  channel?: 'SMS' | 'Email';
}

interface NotificationState {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  markAsSent: (id: string, channel: 'SMS' | 'Email') => void;
  autoSendEnabled: boolean;
  toggleAutoSend: () => void;
  clearAlerts: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      alerts: [],
      autoSendEnabled: false,
      addAlert: (alert) => set((state) => ({
        alerts: [
          {
            ...alert,
            id: Math.random().toString(36).substring(2, 9),
            createdAt: new Date().toISOString()
          },
          ...state.alerts
        ]
      })),
      markAsSent: (id, channel) => set((state) => ({
        alerts: state.alerts.map(a => a.id === id ? { ...a, status: 'Sent', sentAt: new Date().toISOString(), channel } : a)
      })),
      toggleAutoSend: () => set((state) => ({ autoSendEnabled: !state.autoSendEnabled })),
      clearAlerts: () => set({ alerts: [] })
    }),
    {
      name: 'aos-notifications'
    }
  )
);
