import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UploadHistoryRecord {
  id: string;
  timestamp: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: 'Success' | 'Partial' | 'Failed';
}

interface UploadHistoryState {
  history: UploadHistoryRecord[];
  addRecord: (record: Omit<UploadHistoryRecord, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

export const useUploadHistoryStore = create<UploadHistoryState>()(
  persist(
    (set) => ({
      history: [],
      addRecord: (record) => set((state) => ({
        history: [
          {
            ...record,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
          },
          ...state.history
        ].slice(0, 50)
      })),
      clearHistory: () => set({ history: [] })
    }),
    {
      name: 'upload-history-storage'
    }
  )
);
