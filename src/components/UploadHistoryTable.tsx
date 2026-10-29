import React from 'react';
import { useUploadHistoryStore } from '../store/useUploadHistoryStore';
import { Clock, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

export default function UploadHistoryTable() {
  const { history, clearHistory } = useUploadHistoryStore();

  if (history.length === 0) return null;

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Clock className="text-blue-400" /> Recent Uploads
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            History of recent bulk uploads and their status.
          </p>
        </div>
        <button 
          onClick={clearHistory}
          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-sm font-semibold transition-colors border border-white/5"
        >
          Clear History
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/50">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-white/5 text-slate-400 border-b border-white/10">
            <tr>
              <th className="px-4 py-3 font-semibold">Date & Time</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold text-right">Total Rows</th>
              <th className="px-4 py-3 font-semibold text-right">Success</th>
              <th className="px-4 py-3 font-semibold text-right">Failed</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {history.map((record) => (
              <tr key={record.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(record.timestamp).toLocaleString(undefined, { 
                    year: 'numeric', month: 'short', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                  })}
                </td>
                <td className="px-4 py-3 font-medium text-slate-200">
                  {record.fileName}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {record.totalRows.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-400">
                  {record.successCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-rose-400">
                  {record.failedCount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {record.status === 'Success' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                      <CheckCircle2 size={14} /> Success
                    </span>
                  )}
                  {record.status === 'Partial' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
                      <AlertTriangle size={14} /> Partial
                    </span>
                  )}
                  {record.status === 'Failed' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20">
                      <AlertCircle size={14} /> Failed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
