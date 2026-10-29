import React, { useState } from 'react';
import { useDashboardStore, WidgetConfig } from '../store/useDashboardStore';
import { Settings2, Plus, Edit3, Trash2, Power, Eye, Layout, BarChart, PieChart, Activity, Map, ArrowRight } from 'lucide-react';

export default function DashboardEditor() {
  const { widgets, dashboards, updateWidget, removeWidget, addWidget, addDashboard, removeDashboard } = useDashboardStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<WidgetConfig>>({});
  const [newDashboardName, setNewDashboardName] = useState('');

  const widgetTypes = [
    { id: 'kpi_card', label: 'KPI Card', icon: Activity },
    { id: 'bar_chart', label: 'Bar/Column Chart', icon: BarChart },
    { id: 'line_graph', label: 'Line Graph', icon: Activity },
    { id: 'pie_chart', label: 'Pie/Donut Chart', icon: PieChart },
    { id: 'geo_chart', label: 'Geo Map', icon: Map },
    { id: 'bullet_graph', label: 'Bullet Graph', icon: BarChart },
    { id: 'radar_chart', label: 'Radar Chart', icon: PieChart },
  ];

  const handleEdit = (widget: WidgetConfig) => {
    setFormData({ ...widget });
    setEditingId(widget.id);
  };

  const handleSave = () => {
    if (editingId) {
      if (editingId === 'new') {
        addWidget({
          ...formData,
          id: 'w_' + Date.now().toString(),
          assignedDashboards: formData.assignedDashboards || [],
          permissions: formData.permissions || ['Super Admin', 'Admin', 'Viewer'],
          exportPermissions: formData.exportPermissions || ['Super Admin'],
        } as WidgetConfig);
      } else {
        updateWidget(editingId, formData);
      }
      setEditingId(null);
    }
  };

  const handleAddWidget = () => {
    setFormData({
      name: 'New Widget',
      description: '',
      type: 'kpi_card',
      dataSource: 'Farmers DB',
      dataFunction: 'countAll',
      refreshInterval: 300,
      permissions: ['Super Admin', 'Admin', 'Viewer'],
      visibilityStatus: true,
      defaultPosition: { x: 0, y: 0, w: 4, h: 2 },
      colorTheme: 'primary',
      exportPermissions: ['Super Admin'],
      assignedDashboards: ['Dashboard'],
    });
    setEditingId('new');
  };

  const handleToggleAssigned = (dbName: string) => {
    const current = formData.assignedDashboards || [];
    if (current.includes(dbName)) {
      setFormData({ ...formData, assignedDashboards: current.filter(n => n !== dbName) });
    } else {
      setFormData({ ...formData, assignedDashboards: [...current, dbName] });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <h3 className="text-slate-100 font-bold flex items-center gap-2 mb-2"><Layout size={20} className="text-blue-400" /> Managed Dashboards</h3>
          <p className="text-slate-400 text-sm mb-4">You have {(dashboards || []).length} dashboards available for widget assignment.</p>
          <div className="flex flex-wrap gap-2">
            {(dashboards || []).map(d => (
              <span key={d} className="px-3 py-1 bg-white/10 rounded-full text-xs text-slate-300 flex items-center gap-1">
                {d}
                <button onClick={() => removeDashboard(d)} className="text-slate-500 hover:text-red-400 ml-1">&times;</button>
              </span>
            ))}
            <div className="flex items-center gap-2 mt-2 w-full">
              <input 
                type="text" 
                value={newDashboardName}
                onChange={e => setNewDashboardName(e.target.value)}
                placeholder="New Dashboard Name..."
                className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 flex-1"
              />
              <button 
                onClick={() => { if(newDashboardName) { addDashboard(newDashboardName); setNewDashboardName(''); } }}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
           <h3 className="text-slate-100 font-bold flex items-center gap-2 mb-2"><BarChart size={20} className="text-purple-400" /> Configured Widgets</h3>
           <p className="text-slate-400 text-sm mb-4">You have {widgets.length} configurable widgets spanning across all dashboards.</p>
           <button onClick={handleAddWidget} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
              <Plus size={16} /> Create New Widget
           </button>
        </div>
      </div>

      {editingId && (
        <div className="bg-slate-800/80 border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative">
          <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
            <Settings2 className="text-purple-400" /> {editingId === 'new' ? 'Create New Widget' : 'Edit Widget Settings'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Widget Name</label>
                <input 
                  type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description</label>
                <textarea 
                  value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 outline-none h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
                  <select 
                    value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 outline-none"
                  >
                    {widgetTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Data Source</label>
                  <select 
                    value={formData.dataSource || ''} onChange={e => setFormData({...formData, dataSource: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 outline-none"
                  >
                    <option value="Farmers DB">Farmers DB</option>
                    <option value="Projects DB">Projects DB</option>
                    <option value="Finance DB">Finance DB</option>
                    <option value="Beneficiaries DB">Beneficiaries DB</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Function Mapping</label>
                  <input 
                    type="text" value={formData.dataFunction || ''} onChange={e => setFormData({...formData, dataFunction: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Refresh (Sec)</label>
                  <input 
                    type="number" value={formData.refreshInterval || 300} onChange={e => setFormData({...formData, refreshInterval: Number(e.target.value)})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">View Permissions (Roles)</label>
                <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3 h-40 overflow-y-auto space-y-1">
                  {['Super Admin', 'Admin', 'Programme Manager', 'State Coordinator', 'Project Officer', 'M&E Officer', 'Finance Officer', 'GIS Officer', 'Viewer', 'Guest'].map(role => (
                    <label key={role} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.permissions?.includes(role) || false}
                        onChange={(e) => {
                          const current = formData.permissions || [];
                          setFormData({ 
                            ...formData, 
                            permissions: e.target.checked ? [...current, role] : current.filter(r => r !== role) 
                          });
                        }}
                        className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-slate-900"
                      />
                      <span className="text-sm text-slate-300">{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Assign to Dashboards</label>
                <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3 h-48 overflow-y-auto space-y-1">
                  {(dashboards || []).map(db => (
                    <label key={db} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.assignedDashboards?.includes(db) || false}
                        onChange={() => handleToggleAssigned(db)}
                        className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-slate-900"
                      />
                      <span className="text-sm text-slate-300">{db}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Default Size (Grid Units)</label>
                <div className="flex gap-4 items-center bg-slate-900/50 p-3 rounded-xl border border-white/10">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Width</label>
                    <input 
                      type="number" value={formData.defaultPosition?.w || 4} onChange={e => setFormData({...formData, defaultPosition: {...formData.defaultPosition!, w: Number(e.target.value)}})}
                      className="w-full bg-white/5 border border-white/10 rounded text-center py-1 text-sm text-slate-200 outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Height</label>
                    <input 
                      type="number" value={formData.defaultPosition?.h || 3} onChange={e => setFormData({...formData, defaultPosition: {...formData.defaultPosition!, h: Number(e.target.value)}})}
                      className="w-full bg-white/5 border border-white/10 rounded text-center py-1 text-sm text-slate-200 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 border-t border-white/10 pt-6">
            <button onClick={() => setEditingId(null)} className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl transition-colors">Save Widget Configuration</button>
          </div>
        </div>
      )}

      {/* Widget List */}
      {!editingId && (
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h3 className="text-lg font-bold text-slate-100">Widget Registry</h3>
          </div>
          <div className="divide-y divide-white/5">
            {widgets.map(widget => {
              const TypeIcon = widgetTypes.find(t => t.id === widget.type)?.icon || Activity;
              return (
                <div key={widget.id} className={`p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between ${!widget.visibilityStatus ? 'opacity-60 bg-black/20' : 'hover:bg-white/5'} transition-all`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${widget.visibilityStatus ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                      <TypeIcon size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-lg flex items-center gap-2">
                        {widget.name} 
                        {!widget.visibilityStatus && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] uppercase rounded font-bold tracking-widest">Disabled</span>}
                      </h4>
                      <p className="text-sm text-slate-400 mt-1 max-w-xl">{widget.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(widget.assignedDashboards || []).map(db => (
                          <span key={db} className="px-2 py-1 bg-white/10 rounded text-xs text-slate-300">
                            {db}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden lg:block">
                      <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Source</div>
                      <div className="text-sm text-slate-300 font-mono">{widget.dataSource}</div>
                    </div>
                    
                    <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                      <label className="relative inline-flex items-center cursor-pointer" title="Toggle Widget Visibility">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={widget.visibilityStatus} 
                          onChange={(e) => updateWidget(widget.id, { visibilityStatus: e.target.checked })} 
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      </label>

                      <button onClick={() => handleEdit(widget)} className="p-2 text-slate-400 hover:text-blue-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                        <Edit3 size={18} />
                      </button>
                      <button onClick={() => removeWidget(widget.id)} className="p-2 text-slate-400 hover:text-red-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {widgets.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Layout size={48} className="mx-auto mb-4 opacity-50" />
                <p>No widgets configured.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
