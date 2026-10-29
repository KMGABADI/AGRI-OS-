import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkbookConnection {
  id: string;
  name: string;
  url: string;
  type: 'google_sheets' | 'excel_local';
  activity: string; // e.g. "Farmers", "Monitoring", "General"
  lastSynced?: string;
  folderId?: string; // If Google Drive folder is saved
}

interface WorkbookState {
  connections: WorkbookConnection[];
  addConnection: (conn: WorkbookConnection) => void;
  updateConnection: (id: string, updates: Partial<WorkbookConnection>) => void;
  removeConnection: (id: string) => void;
}

export const useWorkbookStore = create<WorkbookState>()(
  persist(
    (set) => ({
      connections: [],
      addConnection: (conn) => set((state) => ({ connections: [...state.connections, conn] })),
      updateConnection: (id, updates) => set((state) => ({
        connections: state.connections.map(c => c.id === id ? { ...c, ...updates } : c)
      })),
      removeConnection: (id) => set((state) => ({
        connections: state.connections.filter(c => c.id !== id)
      })),
    }),
    {
      name: 'workbook-storage',
    }
  )
);
