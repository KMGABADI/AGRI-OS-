import React, { useState } from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function DataExport() {
  const { primaryColor } = useBrandingStore();
  const { farmers, isLoading } = useFarmerStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const csv = Papa.unparse(farmers);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('url');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `farmers_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(farmers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Farmers");
      XLSX.writeFile(wb, `farmers_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
          <Download size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Bulk Data Export</h2>
          <p className="text-slate-400 text-sm mt-1">Download your full dataset for external auditing and reporting.</p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6 mb-8 flex items-center justify-between">
        <div>
          <h3 className="text-slate-200 font-semibold mb-1">Total Records Available</h3>
          {isLoading ? (
            <div className="h-8 w-24 bg-white/10 animate-pulse rounded"></div>
          ) : (
            <p className="text-3xl font-mono text-emerald-400">{farmers.length}</p>
          )}
        </div>
        <div className="text-right text-sm text-slate-400">
          <p>Dataset: Farmers Database</p>
          <p>Last Updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={handleExportCSV}
          disabled={isExporting || isLoading || farmers.length === 0}
          className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="p-4 bg-blue-500/20 text-blue-400 rounded-full group-hover:scale-110 transition-transform">
            <FileText size={32} />
          </div>
          <div className="text-center">
            <h3 className="text-slate-200 font-semibold">Export as CSV</h3>
            <p className="text-slate-400 text-xs mt-2">Standard comma-separated format for generic tools</p>
          </div>
        </button>

        <button
          onClick={handleExportExcel}
          disabled={isExporting || isLoading || farmers.length === 0}
          className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-full group-hover:scale-110 transition-transform">
            <FileSpreadsheet size={32} />
          </div>
          <div className="text-center">
            <h3 className="text-slate-200 font-semibold">Export as Excel (.xlsx)</h3>
            <p className="text-slate-400 text-xs mt-2">Formatted spreadsheet for Excel or Google Sheets</p>
          </div>
        </button>
      </div>
    </div>
  );
}
