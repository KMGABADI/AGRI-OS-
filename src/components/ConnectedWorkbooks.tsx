import React, { useState, useEffect } from 'react';
import { useWorkbookStore } from '../store/useWorkbookStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { Database, Plus, RefreshCw, Folder, FileSpreadsheet, Trash2, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { getAccessToken, googleSignIn } from '../lib/AuthContext';

export default function ConnectedWorkbooks() {
  const { connections, addConnection, removeConnection } = useWorkbookStore();
  const { primaryColor } = useBrandingStore();
  const [isCreating, setIsCreating] = useState(false);
  const [folders, setFolders] = useState<{id: string, name: string}[]>([]);
  const [newWorkbookName, setNewWorkbookName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [connectionType, setConnectionType] = useState<'google_sheets' | 'excel_local'>('google_sheets');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleLocalFileConnect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      addConnection({
        id: 'local_' + Date.now(),
        name: f.name,
        url: 'local://' + f.name,
        type: 'excel_local',
        activity: 'General',
        lastSynced: new Date().toISOString()
      });
      setShowForm(false);
      setNewWorkbookName('');
      setSelectedFolder('');
    }
  };

  
  useEffect(() => {
    if (showForm) {
      fetchFolders();
    }
  }, [showForm]);
  
  const fetchFolders = async () => {
    try {
      let token = await getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        if (result) token = result.accessToken;
      }
      if (!token) return;
      
      const res = await fetch('/api/drive/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleCreate = async () => {
    if (!newWorkbookName) return;
    setIsCreating(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        if (result) token = result.accessToken;
      }
      if (!token) throw new Error("Not authenticated");
      
      const res = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newWorkbookName,
          folderId: selectedFolder
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        addConnection({
          id: data.spreadsheetId,
          name: newWorkbookName,
          url: data.url,
          type: 'google_sheets',
          activity: 'General',
          folderId: selectedFolder,
          lastSynced: new Date().toISOString()
        });
        setShowForm(false);
        setNewWorkbookName('');
        setSelectedFolder('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="text-blue-400" /> Connected Workbooks
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Connect online Google Workbooks or manage local Excel tracking files.
          </p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 text-sm font-semibold transition-all"
        >
          <Plus size={16} /> New Connection
        </button>
      </div>
      
      {showForm && (
        <div className="bg-slate-900/50 p-6 rounded-2xl mb-6 border border-white/5">
          
          <div className="flex gap-4 mb-4">
            <button 
              onClick={() => setConnectionType('google_sheets')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${connectionType === 'google_sheets' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              Google Sheets
            </button>
            <button 
              onClick={() => setConnectionType('excel_local')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${connectionType === 'excel_local' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              Local Excel
            </button>
          </div>
          
          {connectionType === 'google_sheets' ? (
            <h4 className="text-sm font-semibold text-slate-300 mb-4">Create New Google Workbook</h4>
          ) : (
            <h4 className="text-sm font-semibold text-slate-300 mb-4">Connect Local Excel File</h4>
          )}

          
          {connectionType === 'google_sheets' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Workbook Name</label>
              <input
                type="text"
                value={newWorkbookName}
                onChange={e => setNewWorkbookName(e.target.value)}
                placeholder="e.g. 2026 Farmer Registrations"
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Save to Drive Folder</label>
              <select
                value={selectedFolder}
                onChange={e => setSelectedFolder(e.target.value)}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Root (My Drive)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            </div>
          )}
          
          {connectionType === 'excel_local' && (
            <div className="mb-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleLocalFileConnect}
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-slate-400 hover:text-slate-300 hover:border-white/40 flex flex-col items-center justify-center gap-2"
              >
                <Database size={24} className="text-green-400/50" />
                <span>Click to select local file</span>
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 text-sm font-medium"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              disabled={isCreating || (!newWorkbookName && connectionType === 'google_sheets') || (connectionType === 'excel_local')}
              className={`px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 text-sm font-medium flex items-center gap-2 ${isCreating || (connectionType === 'excel_local') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isCreating ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Create Workbook
            </button>
          </div>
        </div>
      )}
      
      {connections.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
          <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No workbooks connected yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map(conn => (
            <div key={conn.id} className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 hover:bg-slate-800/60 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200">{conn.name}</h4>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Folder size={12} /> {conn.type === 'google_sheets' ? 'Google Drive' : 'Local'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => removeConnection(conn.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <span className="text-xs text-slate-500">
                  Last synced: {conn.lastSynced ? new Date(conn.lastSynced).toLocaleDateString() : 'Never'}
                </span>
                <a 
                  href={conn.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Open Sheet <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
