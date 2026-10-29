import React, { useState } from 'react';
import { useOrgStore } from '../store/useOrgStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { Building, Plus, Search, X } from 'lucide-react';
import { Organization } from '../types';
import { v4 as uuidv4 } from 'uuid';

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export default function Organizations() {
  const { primaryColor } = useBrandingStore();
  const { organizations, addOrganization } = useOrgStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newOrg, setNewOrg] = useState<Partial<Organization>>({
    name: '',
    type: 'NGO',
    region: 'National',
    states: [],
    lgas: [],
    contactPerson: '',
    contactPhone: '',
    status: 'Active'
  });

  const filteredOrgs = organizations.filter(org => {
    const searchString = `${org.name} ${org.type} ${org.states?.join(' ') || ''} ${org.lgas?.join(' ') || ''} ${org.contactPerson || ''} ${org.status || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const handleStateToggle = (state: string) => {
    const currentStates = newOrg.states || [];
    if (currentStates.includes(state)) {
      setNewOrg({ ...newOrg, states: currentStates.filter(s => s !== state) });
    } else {
      setNewOrg({ ...newOrg, states: [...currentStates, state] });
    }
  };

  const handleLgaToggle = (lgaInput: string) => {
    const currentLgas = newOrg.lgas || [];
    const lgas = lgaInput.split(',').map(l => l.trim()).filter(l => l);
    // Overwrite for simplicity in this demo, usually would have a proper tag input
    setNewOrg({ ...newOrg, lgas });
  };

  const handleSelectAllStates = () => {
    if (newOrg.states?.length === NIGERIAN_STATES.length) {
      setNewOrg({ ...newOrg, states: [] });
    } else {
      setNewOrg({ ...newOrg, states: [...NIGERIAN_STATES] });
    }
  };

  const handleSave = () => {
    if (!newOrg.name) return;
    addOrganization({
      id: uuidv4(),
      name: newOrg.name!,
      type: newOrg.type as any,
      region: newOrg.region || 'National',
      states: newOrg.states,
      lgas: newOrg.lgas,
      contactPerson: newOrg.contactPerson || '',
      contactPhone: newOrg.contactPhone || '',
      status: newOrg.status as any || 'Active'
    });
    setShowAddModal(false);
    setNewOrg({ name: '', type: 'NGO', region: 'National', states: [], lgas: [], contactPerson: '', contactPhone: '', status: 'Active' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Organisations / Programmes</h2>
          <p className="text-slate-400">Manage cooperatives, NGOs, anchor institutions, and programmes.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-2 text-white font-semibold rounded-full shadow-lg transition-all hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus size={18} />
          Add Organisation
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Organisations</p>
          <p className="text-3xl font-mono text-emerald-400 font-bold mt-1">{organizations.length}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Programmes</p>
          <p className="text-3xl font-mono text-blue-400 font-bold mt-1">{organizations.reduce((acc, org) => acc + (org.programs?.length || 0), 0)}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Active Entities</p>
          <p className="text-3xl font-mono text-purple-400 font-bold mt-1">{organizations.filter(o => o.status === 'Active').length}</p>
        </div>
      </div>

        

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-white/5">
          <Search size={20} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search organisations by name, location, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none focus:outline-none text-slate-100 placeholder-slate-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-widest text-[10px] border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Coverage</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredOrgs.map(org => (
                <tr key={org.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Building size={14} />
                    </div>
                    {org.name}
                  </td>
                  <td className="px-6 py-4 opacity-80">{org.type}</td>
                  <td className="px-6 py-4 opacity-80">
                    {org.region}
                    {org.states && org.states.length > 0 && (
                      <div className="text-xs mt-1 text-slate-500">
                        {org.states.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 opacity-80">{org.contactPerson} <br/><span className="text-xs opacity-60 font-mono">{org.contactPhone}</span></td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase
                      ${org.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                      {org.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredOrgs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No organisations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-100">Add Organisation / Programme</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={newOrg.name}
                    onChange={e => setNewOrg({ ...newOrg, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Anchor Borrowers Programme"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                  <select
                    value={newOrg.type}
                    onChange={e => setNewOrg({ ...newOrg, type: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Cooperative">Cooperative</option>
                    <option value="Anchor">Anchor</option>
                    <option value="NGO">NGO</option>
                    <option value="Government">Government</option>
                    <option value="Programme">Programme</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-400">Geofencing: Select States</label>
                  <button 
                    type="button" 
                    onClick={handleSelectAllStates}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {newOrg.states?.length === NIGERIAN_STATES.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-800/50 rounded-lg border border-slate-700">
                  {NIGERIAN_STATES.map(state => (
                    <label key={state} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={(newOrg.states || []).includes(state)}
                        onChange={() => handleStateToggle(state)}
                        className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                      />
                      {state}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">LGAs (Comma separated)</label>
                <input
                  type="text"
                  value={(newOrg.lgas || []).join(', ')}
                  onChange={e => handleLgaToggle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Alimosho, Ikeja, Agege"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={newOrg.contactPerson}
                    onChange={e => setNewOrg({ ...newOrg, contactPerson: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newOrg.contactPhone}
                    onChange={e => setNewOrg({ ...newOrg, contactPhone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 rounded-lg text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Save Organisation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
