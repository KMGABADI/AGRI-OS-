import React, { useState } from 'react';
import { Upload, FileText, Plus, Save, X } from 'lucide-react';
import { useSystemConfigStore } from '../store/useSystemConfigStore';

export default function FarmerTemplateManager() {
  const [isUploading, setIsUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [templateName, setTemplateName] = useState('Default Farmer Info Template');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      setTimeout(() => {
        setIsUploading(false);
        setTemplateName(e.target.files![0].name);
        alert('Template uploaded successfully!');
      }, 1000);
    }
  };

  const handleCreate = () => {
    setShowForm(false);
    alert('New template created and saved!');
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6">
      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
        <FileText className="text-emerald-400" />
        Farmer Info Template Management
      </h3>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
           <p className="text-sm text-slate-400 mb-2">Current Active Template</p>
           <p className="font-semibold text-emerald-400">{templateName}</p>
        </div>
        
        <div className="flex-1 flex flex-col justify-center gap-3">
          <label className="cursor-pointer bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium">
            <Upload size={18} />
            {isUploading ? 'Uploading...' : 'Upload Template File'}
            <input type="file" className="hidden" accept=".csv,.xlsx,.json" onChange={handleUpload} />
          </label>
          <button 
            onClick={() => setShowForm(true)}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
          >
            <Plus size={18} />
            Create New Template
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-6 bg-slate-900/80 border border-emerald-500/30 p-4 rounded-2xl relative">
          <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
          <h4 className="text-md font-bold text-slate-200 mb-4">Template Builder</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Template Name</label>
              <input 
                type="text" 
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Select Required Fields</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {['First Name', 'Last Name', 'Phone', 'State', 'LGA', 'Crop', 'Farm Size (Ha)', 'NIN'].map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" defaultChecked className="rounded bg-slate-800 border-slate-600 text-emerald-500" />
                    {f}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleCreate} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                <Save size={16} /> Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
