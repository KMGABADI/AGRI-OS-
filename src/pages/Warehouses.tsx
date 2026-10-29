import React, { useState } from 'react';
import { useWarehouseStore } from '../store/useWarehouseStore';
import { useSystemConfigStore } from '../store/useSystemConfigStore';
import { Building2, Plus, Search, X } from 'lucide-react';
import { Warehouse } from '../types';

export default function Warehouses() {
  const config = useSystemConfigStore(state => state.config);
  const primaryColor = config?.branding?.primaryColor || '#16a34a';
  
  const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouseStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Warehouse>>({
    name: '',
    commodity: '',
    capacity: 0,
    currentInventory: 0,
    latitude: 0,
    longitude: 0,
    status: 'Active',
    manager: ''
  });

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.commodity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateWarehouse(editingId, formData as Partial<Warehouse>);
    } else {
      await addWarehouse(formData as Warehouse);
    }
    setShowAddModal(false);
    setEditingId(null);
    setFormData({
      name: '', commodity: '', capacity: 0, currentInventory: 0, latitude: 0, longitude: 0, status: 'Active', manager: '', note: ''
    });
  };

  const handleEdit = (w: Warehouse) => {
    setEditingId(w.id);
    setFormData(w);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Food Bank Warehouses</h2>
          <p className="text-slate-400">Manage storage facilities and inventory.</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-black/20"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus size={18} />
          <span>Add Warehouse</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Warehouses</p>
          <p className="text-3xl font-mono text-emerald-400 font-bold mt-1">{warehouses.length}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Capacity (MT)</p>
          <p className="text-3xl font-mono text-blue-400 font-bold mt-1">{warehouses.reduce((s,w)=>s+(w.capacityMT||0),0).toLocaleString()}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Active Facilities</p>
          <p className="text-3xl font-mono text-amber-400 font-bold mt-1">{warehouses.filter(w=>w.status==='Active').length}</p>
        </div>
      </div>

        

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl relative z-10 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search warehouses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-opacity-50 text-slate-200 placeholder:text-slate-500 w-64"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-400 font-semibold">
                <th className="pb-3 pl-4">Name</th>
                <th className="pb-3">Commodity</th>
                <th className="pb-3">Capacity (MT)</th>
                <th className="pb-3">Inventory (MT)</th>
                <th className="pb-3">Manager</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredWarehouses.map((w) => (
                <tr key={w.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-4 font-medium text-slate-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Building2 size={16} />
                    </div>
                    {w.name}
                  </td>
                  <td className="py-4 text-slate-300">{w.commodity}</td>
                  <td className="py-4 text-slate-300">{w.capacity}</td>
                  <td className="py-4 text-slate-300">{w.currentInventory}</td>
                  <td className="py-4 text-slate-400">{w.manager}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                      w.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      w.status === 'Maintenance' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-right">
                    <button onClick={() => handleEdit(w)} className="text-blue-400 hover:text-blue-300 px-2">Edit</button>
                    <button onClick={() => deleteWarehouse(w.id)} className="text-red-400 hover:text-red-300 px-2">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-bold text-slate-100">{editingId ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="warehouse-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Commodity</label>
                  <input required type="text" value={formData.commodity} onChange={e => setFormData({...formData, commodity: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Capacity (MT)</label>
                    <input required type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Inventory (MT)</label>
                    <input required type="number" value={formData.currentInventory} onChange={e => setFormData({...formData, currentInventory: Number(e.target.value)})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Latitude</label>
                    <input type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: Number(e.target.value)})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Longitude</label>
                    <input type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: Number(e.target.value)})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Manager</label>
                  <input type="text" value={formData.manager} onChange={e => setFormData({...formData, manager: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100">
                    <option value="Active">Active</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Note</label>
                  <textarea rows={3} value={formData.note || ''} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500" placeholder="Add any additional notes here..." />
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl text-slate-300 font-medium hover:bg-white/5 transition-colors">Cancel</button>
              <button form="warehouse-form" type="submit" className="px-4 py-2 rounded-xl text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
                {editingId ? 'Save Changes' : 'Add Warehouse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
