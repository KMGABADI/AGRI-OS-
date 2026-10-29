import React, { useState } from 'react';
import { useActivityLogStore } from '../store/useActivityLogStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { Activity, Search, Filter, ShieldAlert, CheckCircle2, FileEdit, Trash2, Upload } from 'lucide-react';
import { format } from 'date-fns';

export default function ActivityLog() {
  const { primaryColor } = useBrandingStore();
  const { logs } = useActivityLogStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter ? log.userRole === roleFilter : true;
    const matchesAction = actionFilter ? log.action === actionFilter : true;
    return matchesSearch && matchesRole && matchesAction;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'UPDATE': return <FileEdit size={16} className="text-blue-400" />;
      case 'DELETE': return <Trash2 size={16} className="text-red-400" />;
      case 'BULK_IMPORT': return <Upload size={16} className="text-purple-400" />;
      case 'EXPORT': return <Upload size={16} className="text-indigo-400 transform rotate-180" />;
      default: return <Activity size={16} className="text-slate-400" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'UPDATE': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DELETE': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'BULK_IMPORT': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'EXPORT': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Manager': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ShieldAlert className="text-amber-400" />
            Security & Activity Audit Log
          </h2>
          <p className="text-slate-400 mt-1">Track system changes and ensure data integrity compliance.</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row items-center gap-4 bg-white/5">
          <div className="flex items-center gap-2 flex-1 w-full bg-slate-900/50 px-4 py-2 rounded-xl border border-white/10">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search activity details or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-slate-100 placeholder-slate-500 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 text-slate-200 [&>option]:bg-slate-800"
            >
              <option value="">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Viewer">Viewer</option>
            </select>
            <select 
              value={actionFilter} 
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 text-slate-200 [&>option]:bg-slate-800"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="BULK_IMPORT">Bulk Import</option>
              <option value="EXPORT">Export</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4 rounded-tr-lg">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No activity logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-xs font-mono">
                      {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{log.userName}</span>
                        <span className={`text-[10px] uppercase font-bold mt-1 inline-block px-2 py-0.5 rounded border w-fit ${getRoleColor(log.userRole)}`}>
                          {log.userRole}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border w-fit text-xs font-bold tracking-wider ${getActionColor(log.action)}`}>
                        {getActionIcon(log.action)}
                        {log.action}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs opacity-70">
                      {log.entityType}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <span>{log.details}</span>
                        {log.changes && log.changes.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {log.changes.map((change, idx) => (
                              <div key={idx} className="text-[10px] bg-slate-900/50 p-2 rounded border border-white/5 font-mono">
                                <span className="text-slate-400 capitalize">{change.field.replace(/([A-Z])/g, ' $1').trim()}:</span> 
                                <span className="text-red-400 ml-1 line-through opacity-70">
                                  {typeof change.oldValue === 'object' ? JSON.stringify(change.oldValue) : String(change.oldValue ?? 'none')}
                                </span> 
                                <span className="text-emerald-400 ml-2">
                                  {typeof change.newValue === 'object' ? JSON.stringify(change.newValue) : String(change.newValue ?? 'none')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
