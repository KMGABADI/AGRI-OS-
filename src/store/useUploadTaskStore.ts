import { create } from 'zustand';

interface UploadTaskState {
  isProcessing: boolean;
  isMinimized: boolean;
  uploadProgress: number;
  progressMessage: string;
  result: { success: number; failed: number; errors?: string[] } | null;
  setResult: (result: { success: number; failed: number; errors?: string[] } | null) => void;
  setProcessing: (isProcessing: boolean) => void;
  setMinimized: (isMinimized: boolean) => void;
  setProgress: (progress: number, message: string) => void;
}

export const useUploadTaskStore = create<UploadTaskState>((set) => ({
  isProcessing: false,
  isMinimized: false,
  uploadProgress: 0,
  progressMessage: '',
  result: null,
  setProcessing: (isProcessing) => set({ isProcessing }),
  setMinimized: (isMinimized) => set({ isMinimized }),
  setProgress: (uploadProgress, progressMessage) => set({ uploadProgress, progressMessage }),
  setResult: (result) => set({ result }),
}));
