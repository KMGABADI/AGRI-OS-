import React, { useState } from 'react';
import { useTemplateStore } from '../store/useTemplateStore';
import { useOrgStore } from '../store/useOrgStore';
import { Save, Trash2, Edit2, FileText, Plus } from 'lucide-react';
import { useBrandingStore } from '../store/useBrandingStore';

export default function MappingTemplates() {
  const { templates, addTemplate, removeTemplate, updateTemplate } = useTemplateStore();
  const { organizations } = useOrgStore();
  const { primaryColor } = useBrandingStore();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    organizationId: '',
    mapping: '' // We will edit this as a JSON string for simplicity, or we can build a UI
  });

  const systemFields = [
    'farmerID', 'firstName', 'lastName', 'phone', 'gender', 'state', 'lga', 'crop', 'farmSize', 'kycComplete', 'experience'
  ];

  const handleEdit = (id: string) => {
    const t = templates.find(t => t.id === id);
    if (t) {
      setFormData({
        name: t.name,
        organizationId: t.organizationId,
        mapping: JSON.stringify(t.mapping, null, 2)
      });
      setEditingId(id);
      setShowForm(true);
    }
  };

  const handleSave = () => {
    try {
      const parsedMapping = JSON.parse(formData.mapping);
      if (editingId) {
        updateTemplate(editingId, {
          name: formData.name,
          organizationId: formData.organizationId,
          mapping: parsedMapping
        });
      } else {
        addTemplate({
          id: Date.now().toString(),
          name: formData.name,
          organizationId: formData.organizationId,
          mapping: parsedMapping,
          createdAt: new Date().toISOString()
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', organizationId: '', mapping: '' });
    } catch (e) {
      alert("Invalid JSON in mapping configuration.");
    }
  };

  const initNew = () => {
    setFormData({
      name: '',
      organizationId: '',
      mapping: JSON.stringify(systemFields.reduce((acc, f) => ({ ...acc, [f]: '' }), {}), null, 2)
    });
    setEditingId(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="text-purple-400" /> Mapping Templates
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Save and manage column-mapping configurations for specific partner organizations.
          </p>
        </div>
        {!showForm && (
          <button 
            onClick={initNew}
            className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 text-sm font-semibold transition-all flex items-center gap-2"
          >
            <Plus size={16} /> New Template
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl">
          <h4 className="text-lg font-bold text-slate-200 mb-4">{editingId ? 'Edit Template' : 'Create Template'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Template Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                placeholder="e.g. World Bank 2026 Format"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Partner Organization</label>
              <select
                value={formData.organizationId}
                onChange={e => setFormData({ ...formData, organizationId: e.target.value })}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
              >
                <option value="">Select Organization (Optional)</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-400 mb-1">Column Mapping (JSON)</label>
            <p className="text-[10px] text-slate-500 mb-2">Map the system field keys (left) to the exact column headers in the partner's CSV (right).</p>
            <textarea
              value={formData.mapping}
              onChange={e => setFormData({ ...formData, mapping: e.target.value })}
              className="w-full h-64 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 text-sm font-medium"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 text-sm font-medium flex items-center gap-2"
            >
              <Save size={16} /> Save Template
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(t => {
            const orgName = organizations.find(o => o.id === t.organizationId)?.name || 'Generic';
            return (
              <div key={t.id} className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 hover:bg-slate-800/60 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-200">{t.name}</h4>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(t.id)} className="text-slate-500 hover:text-blue-400 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => removeTemplate(t.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <span className="inline-block px-2 py-1 bg-white/5 rounded text-[10px] text-slate-400 mb-4">{orgName}</span>
                  <div className="text-xs text-slate-500 font-mono bg-black/20 p-3 rounded-lg overflow-y-auto max-h-24">
                    {Object.entries(t.mapping).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-white/5 last:border-0 py-1">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-300">{v || '-'}</span>
                      </div>
                    ))}
                    {Object.keys(t.mapping).length > 4 && (
                      <div className="text-center text-slate-500 text-[10px] pt-1">+{Object.keys(t.mapping).length - 4} more</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {templates.length === 0 && (
             <div className="col-span-full text-center py-12 border border-dashed border-white/10 rounded-2xl">
               <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
               <p className="text-slate-400">No mapping templates created yet.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
