import React, { useState } from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { ResourceInventoryItem } from '../types';
import { Package, Plus, Droplets, Sprout, Leaf, Fuel, AlertCircle, Edit2, Check, X, Trash2 } from 'lucide-react';
import { useBrandingStore } from '../store/useBrandingStore';

export const ResourceInventoryTracker = ({ farmerId }: { farmerId: string }) => {
  const { farmers, updateFarmer } = useFarmerStore();
  const { primaryColor } = useBrandingStore();
  
  const farmer = farmers.find(f => f.id === farmerId);
  const inventory = farmer?.inventory || [];

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ResourceInventoryItem>>({});

  if (!farmer) return null;

  const handleSave = () => {
    if (!formData.name || !formData.quantity || !formData.unit || !formData.type) return;
    
    let updatedInventory = [...inventory];
    
    if (editingId) {
      updatedInventory = updatedInventory.map(item => 
        item.id === editingId ? { ...item, ...formData, lastUpdated: new Date().toISOString() } as ResourceInventoryItem : item
      );
    } else {
      updatedInventory.push({
        id: Math.random().toString(36).substring(2, 9),
        type: formData.type as any,
        name: formData.name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        lastUpdated: new Date().toISOString()
      });
    }

    updateFarmer(farmerId, { inventory: updatedInventory });
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    const updatedInventory = inventory.filter(item => item.id !== id);
    updateFarmer(farmerId, { inventory: updatedInventory });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Seed': return <Sprout size={16} className="text-emerald-400" />;
      case 'Fertilizer': return <Leaf size={16} className="text-amber-400" />;
      case 'Pesticide': return <AlertCircle size={16} className="text-red-400" />;
      case 'Water': return <Droplets size={16} className="text-blue-400" />;
      case 'Fuel': return <Fuel size={16} className="text-purple-400" />;
      default: return <Package size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Package size={14} /> Resource Inventory Tracker
        </h4>
        <button 
          onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ type: 'Seed' }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors text-xs font-bold"
        >
          <Plus size={14} /> Add Resource
        </button>
      </div>

      {isAdding && (
        <div className="p-4 bg-black/20 border border-white/10 rounded-xl mb-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 mb-1">Type</label>
              <select 
                value={formData.type || ''}
                onChange={e => setFormData({...formData, type: e.target.value as any})}
                className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="Seed">Seed</option>
                <option value="Fertilizer">Fertilizer</option>
                <option value="Pesticide">Pesticide</option>
                <option value="Water">Water Usage</option>
                <option value="Fuel">Fuel</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 mb-1">Name</label>
              <input 
                type="text" 
                placeholder="e.g. Maize Seeds (Oba Super)"
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 mb-1">Quantity</label>
              <input 
                type="number" 
                placeholder="0"
                value={formData.quantity || ''}
                onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
                className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 mb-1">Unit</label>
              <input 
                type="text" 
                placeholder="e.g. kg, liters"
                value={formData.unit || ''}
                onChange={e => setFormData({...formData, unit: e.target.value})}
                className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => { setIsAdding(false); setEditingId(null); setFormData({}); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors hover:opacity-90 flex items-center gap-1"
              style={{ backgroundColor: primaryColor }}
            >
              <Check size={14} /> Save
            </button>
          </div>
        </div>
      )}

      {inventory.length > 0 ? (
        <div className="space-y-3">
          {inventory.map((item) => (
            <div key={item.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center shrink-0">
                  {getIcon(item.type)}
                </div>
                <div>
                  <h5 className="font-semibold text-slate-200 text-sm">{item.name}</h5>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{item.type}</span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-xs text-slate-500">Updated: {new Date(item.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                <div className="text-right">
                  <span className="text-lg font-bold text-slate-100 font-mono">{item.quantity}</span>
                  <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                </div>
                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setFormData(item); setEditingId(item.id); setIsAdding(true); }}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border border-dashed border-white/10 rounded-xl bg-white/5">
          <Package className="mx-auto text-slate-500 mb-3" size={24} />
          <p className="text-sm text-slate-400">No resources tracked yet.</p>
        </div>
      )}
    </div>
  );
};
