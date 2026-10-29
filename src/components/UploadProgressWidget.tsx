import React from 'react';
import { useUploadTaskStore } from '../store/useUploadTaskStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { Maximize2, Minimize2, Loader2 } from 'lucide-react';

export default function UploadProgressWidget() {
  const { isProcessing, isMinimized, uploadProgress, progressMessage, setMinimized } = useUploadTaskStore();
  const { primaryColor } = useBrandingStore();

  if (!isProcessing) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
        <div className="relative w-10 h-10 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="10" className="text-slate-800" />
            <circle 
              cx="50" cy="50" r="45" fill="transparent" 
              stroke={primaryColor} strokeWidth="10" 
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - uploadProgress / 100)}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{uploadProgress}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-[150px]">
          <h4 className="text-sm font-bold text-white leading-none mb-1">Uploading Data</h4>
          <p className="text-xs text-slate-400 truncate">{progressMessage}</p>
        </div>
        <button 
          onClick={() => setMinimized(false)}
          className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center relative">
        <button 
          onClick={() => setMinimized(true)}
          className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
        >
          <Minimize2 size={18} />
        </button>
        
        <div className="relative w-24 h-24 mb-6 mt-4">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
            <circle 
              cx="50" cy="50" r="45" fill="transparent" 
              stroke={primaryColor} strokeWidth="8" 
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - uploadProgress / 100)}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-white">{uploadProgress}%</span>
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">Processing Data</h3>
        <p className="text-slate-400 text-sm text-center mb-6">{progressMessage}</p>
        
        <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
          <div 
            className="h-2 rounded-full transition-all duration-300" 
            style={{ width: `${uploadProgress}%`, backgroundColor: primaryColor }}
          ></div>
        </div>
        <p className="text-xs text-slate-500 w-full text-center">You can minimize this window and continue working.</p>
      </div>
    </div>
  );
}
