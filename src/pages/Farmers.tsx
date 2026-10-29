import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { useOrgStore } from '../store/useOrgStore';
import { useProgramStore } from '../store/useProgramStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { useAuth, getAccessToken } from '../lib/AuthContext';
import { useActivityLogStore } from '../store/useActivityLogStore';
import { Plus, Search, Filter, Download, FileText, Mail, FormInput } from 'lucide-react';
import { NIGERIA_STATES } from '../lib/nigeriaData';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { IDCard } from '../components/IDCard';
import { Certificate } from '../components/Certificate';
import { useSystemConfigStore } from '../store/useSystemConfigStore';
import FarmerTemplateManager from '../components/FarmerTemplateManager';

export default function Farmers() {
  const { primaryColor } = useBrandingStore();
  const { farmers, addFarmer, deleteFarmer, updateFarmer } = useFarmerStore();
  const [selectedFarmers, setSelectedFarmers] = useState<string[]>([]);
  const config = useSystemConfigStore(state => state.config);
  const { organizations } = useOrgStore();
  const { programs } = useProgramStore();
  const { profile } = useAuth();
  const logActivity = useActivityLogStore(state => state.logActivity);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const hiddenContainerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    title: 'Mr',
    firstName: '',
    lastName: '',
    gender: 'Male',
    primaryPhone: '',
    state: Object.keys(NIGERIA_STATES)[0],
    lga: NIGERIA_STATES[Object.keys(NIGERIA_STATES)[0]][0],
    organizationId: '',
    programId: '',
    latitude: '',
    longitude: ''
  });

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = e.target.value;
    setFormData(prev => ({
      ...prev,
      state: newState,
      lga: NIGERIA_STATES[newState][0] // Reset LGA to first in state
    }));
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString()
          }));
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get location. Please enter manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredFarmers = useMemo(() => {
    return farmers.filter(f => {
    const searchString = `${f.firstName} ${f.lastName} ${f.farmerID || ''} ${f.state || ''} ${f.lga || ''} ${f.crop || ''} ${f.anchor || ''} ${f.profileStatus || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesOrg = orgFilter ? f.organizationId === orgFilter || f.anchor === orgFilter || (f.interventions?.some(i => i.name === orgFilter)) : true;
    const matchesProgram = programFilter ? f.programId === programFilter || f.interventions?.some(i => i.name === programFilter) : true;
    return matchesSearch && matchesOrg && matchesProgram;
    });
  }, [farmers, searchTerm, orgFilter, programFilter]);

  const totalPages = Math.ceil(filteredFarmers.length / itemsPerPage);
  const paginatedFarmers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredFarmers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredFarmers, currentPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addFarmer({
        id: Date.now().toString(),
        ...formData,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
        profileStatus: 'Active',
        registrationDate: new Date().toISOString(),
      });
      setIsModalOpen(false);
      setFormData({ title: 'Mr', firstName: '', lastName: '', gender: 'Male', primaryPhone: '', state: Object.keys(NIGERIA_STATES)[0], lga: NIGERIA_STATES[Object.keys(NIGERIA_STATES)[0]][0], organizationId: '', programId: '', latitude: '', longitude: '' });
    } catch (err: any) {
      console.error(err);
      alert('Failed to add farmer: ' + err.message);
    }
  };


  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFarmers(e.target.checked ? filteredFarmers.map(f => f.id) : []);
  };

  const handleSelectFarmer = (id: string, checked: boolean) => {
    setSelectedFarmers(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedFarmers.length} farmers?`)) return;
    try {
      await Promise.all(selectedFarmers.map(id => deleteFarmer(id)));
      setSelectedFarmers([]);
    } catch (e: any) {
      alert('Error deleting farmers: ' + e.message);
    }
  };

  const handleBatchAssign = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    if (!orgId) return;
    if (!confirm(`Assign ${selectedFarmers.length} farmers to this organization?`)) return;
    try {
      await Promise.all(selectedFarmers.map(id => updateFarmer(id, { organizationId: orgId })));
      setSelectedFarmers([]);
      e.target.value = "";
    } catch (error: any) {
      alert('Error assigning farmers: ' + error.message);
    }
  };

  const [exportTarget, setExportTarget] = useState<'ID' | 'CERT' | null>(null);

  const bulkExport = async (type: 'ID' | 'CERT') => {
    if (filteredFarmers.length === 0) return;
    setExportTarget(type);
    setIsExporting(true);
  };

  useEffect(() => {
    if (isExporting && exportTarget && hiddenContainerRef.current) {
      setTimeout(async () => {
        try {
          const pdf = new jsPDF({ 
            orientation: 'landscape', 
            unit: 'px', 
            format: exportTarget === 'ID' ? [400, 250] : [800, 600] 
          });

          const elements = hiddenContainerRef.current!.children;
          let addedPages = 0;

          for (let i = 0; i < filteredFarmers.length; i++) {
            const wrapper = elements[i] as HTMLElement;
            const targetEl = wrapper.children[exportTarget === 'ID' ? 0 : 1] as HTMLElement;
            const canvas = await html2canvas(targetEl, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            
            if (addedPages > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, 0, exportTarget === 'ID' ? 400 : 800, exportTarget === 'ID' ? 250 : 600);
            addedPages++;
          }

          pdf.save(`Bulk_${exportTarget === 'ID' ? 'IDCards' : 'Certificates'}.pdf`);
          logActivity({
            action: 'EXPORT',
            entityType: 'FARMER',
            entityId: 'BULK',
            details: `Bulk exported ${addedPages} ${exportTarget === 'ID' ? 'ID Cards' : 'Certificates'}`
          });
        } catch (e) {
          console.error(e);
        }
        setIsExporting(false);
        setExportTarget(null);
      }, 500); // Give React time to flush hidden container to DOM
    }
  }, [isExporting, exportTarget, filteredFarmers.length, logActivity]);

  const exportToDocs = async () => {
    if (filteredFarmers.length === 0) return;
    setIsExporting(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        alert("Please log in again with Google to authorize Google Docs.");
        setIsExporting(false);
        return;
      }

      const res = await fetch('/api/docs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ farmers: filteredFarmers })
      });

      const data = await res.json();
      if (data.url) {
        logActivity({
          action: 'EXPORT',
          entityType: 'FARMER',
          entityId: 'BULK',
          details: `Exported ${filteredFarmers.length} farmers to Google Docs`
        });
        // Open the document in a new tab
        window.open(data.url, '_blank');
      } else {
        alert("Error exporting to Google Docs: " + data.error);
      }
    } catch (error) {
      console.error("Export to docs error", error);
      alert("Failed to export to Google Docs.");
    }

    setIsExporting(false);
  };

  const createForm = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        alert("Please log in again with Google to authorize Google Forms.");
        return;
      }
      const res = await fetch('/api/forms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'Farmer Field Data Collection' })
      });
      const data = await res.json();
      if (data.url) {
        logActivity({
          action: 'CREATE',
          entityType: 'FARMER',
          entityId: 'FORM',
          details: `Created new Google Form for data collection`
        });
        window.open(data.url, '_blank');
      } else {
        alert("Error creating Google Form: " + data.error);
      }
    } catch (error) {
      console.error("Create form error", error);
      alert("Failed to create Google Form.");
    }
  };

  const broadcastEmail = async () => {
    const emailList = filteredFarmers.map(f => (f as any).email).filter(Boolean);
    if (emailList.length === 0) {
      alert("No email addresses found for the filtered farmers.");
      return;
    }
    const subject = prompt("Enter email subject:");
    if (!subject) return;
    const body = prompt("Enter email body (HTML supported):");
    if (!body) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        alert("Please log in again with Google to authorize Gmail.");
        return;
      }
      
      const to = emailList.join(',');
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ to, subject, body })
      });
      
      const data = await res.json();
      if (data.success) {
        logActivity({
          action: 'UPDATE',
          entityType: 'FARMER',
          entityId: 'BULK_EMAIL',
          details: `Broadcast email sent to ${emailList.length} farmers`
        });
        alert(`Successfully sent email to ${emailList.length} farmers.`);
      } else {
        alert("Error sending email: " + data.error);
      }
    } catch (error) {
      console.error("Broadcast email error", error);
      alert("Failed to send broadcast email.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Farmer Management</h2>
          <p className="text-slate-400">View and manage registered farmers.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2 text-white font-semibold rounded-full shadow-lg shadow-blue-600/20 transition-all hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus size={18} />
          Add Farmer
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Farmers</p>
          <p className="text-3xl font-mono text-emerald-400 font-bold mt-1">{farmers.length}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Active Profiles</p>
          <p className="text-3xl font-mono text-blue-400 font-bold mt-1">{farmers.filter(f => f.profileStatus === 'Active').length}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Avg Credit Score</p>
          <p className="text-3xl font-mono text-purple-400 font-bold mt-1">{Math.round(farmers.reduce((s,f)=>s+(f.creditScore?.score||0),0)/(farmers.length||1))}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Unique Regions</p>
          <p className="text-3xl font-mono text-amber-400 font-bold mt-1">{new Set(farmers.map(f=>f.state).filter(Boolean)).size}</p>
        </div>
      </div>

        


      {config?.features?.enableFarmerTemplate && (
        <FarmerTemplateManager />
      )}

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
      {selectedFarmers.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between mb-4 mt-4 mx-4">
          <span className="text-emerald-400 font-semibold text-sm">
            {selectedFarmers.length} farmer(s) selected
          </span>
          <div className="flex items-center gap-3">
            <select 
              onChange={handleBatchAssign}
              className="bg-slate-900/50 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 text-emerald-100 [&>option]:bg-slate-800"
            >
              <option value="">Assign to Organization...</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button 
              onClick={handleBatchDelete}
              className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-semibold"
            >
              Delete Selected
            </button>
            <button 
              onClick={() => setSelectedFarmers([])}
              className="text-slate-400 hover:text-slate-200 text-sm ml-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row items-center gap-4 bg-white/5">
          <div className="flex items-center gap-2 flex-1 w-full bg-slate-900/50 px-4 py-2 rounded-xl border border-white/10">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search farmers by name, location, or tag..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-transparent border-none focus:outline-none text-slate-100 placeholder-slate-500 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={orgFilter} 
              onChange={(e) => { setOrgFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 text-slate-200 [&>option]:bg-slate-800"
            >
              <option value="">All Organizations</option>
              {organizations.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
            <select 
              value={programFilter} 
              onChange={(e) => { setProgramFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 text-slate-200 [&>option]:bg-slate-800"
            >
              <option value="">All Programs</option>
              {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>

            <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>

            <button 
              onClick={() => bulkExport('ID')}
              disabled={isExporting || filteredFarmers.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-colors text-sm font-semibold disabled:opacity-50"
              title="Export IDs for all filtered farmers"
            >
              <Download size={16} /> IDs
            </button>
            <button 
              onClick={() => bulkExport('CERT')}
              disabled={isExporting || filteredFarmers.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/20 transition-colors text-sm font-semibold disabled:opacity-50"
              title="Export Certificates for all filtered farmers"
            >
              <Download size={16} /> Certs
            </button>
            <button 
              onClick={exportToDocs}
              disabled={isExporting || filteredFarmers.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors text-sm font-semibold disabled:opacity-50"
              title="Export filtered farmers to Google Docs"
            >
              <FileText size={16} /> Docs
            </button>
            <button 
              onClick={createForm}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-colors text-sm font-semibold"
              title="Generate a Google Form for Data Collection"
            >
              <FormInput size={16} /> Form
            </button>
            <button 
              onClick={broadcastEmail}
              disabled={filteredFarmers.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-colors text-sm font-semibold disabled:opacity-50"
              title="Send an email to all filtered farmers"
            >
              <Mail size={16} /> Mail
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-widest text-[10px] border-b border-white/10">
              <tr>
                <th className="px-6 py-4 w-12"><input type="checkbox" onChange={handleSelectAll} checked={filteredFarmers.length > 0 && selectedFarmers.length === filteredFarmers.length} className="rounded bg-slate-800 border-slate-600 text-emerald-500" /></th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Credit Score</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Registered Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {paginatedFarmers.map(farmer => {
                const org = organizations.find(o => o.id === farmer.organizationId) || organizations.find(o => o.id === farmer.anchor);
                return (
                <tr key={farmer.id} onClick={() => window.location.href = `/farmers/${farmer.id}`} className="hover:bg-white/5 transition-colors cursor-pointer">
                  <td className="px-6 py-4 w-12" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedFarmers.includes(farmer.id)} onChange={e => handleSelectFarmer(farmer.id, e.target.checked)} className="rounded bg-slate-800 border-slate-600 text-emerald-500" />
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-100 flex items-center gap-3">
                    {farmer.photo ? (
                      <img src={farmer.photo} alt="Photo" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        {farmer.firstName.charAt(0)}{farmer.lastName.charAt(0)}
                      </div>
                    )}
                    {farmer.title} {farmer.firstName} {farmer.lastName}
                  </td>
                  <td className="px-6 py-4 opacity-80">{farmer.farmerID || farmer.id}</td>
                  <td className="px-6 py-4 opacity-80">{org?.name || farmer.anchor || 'N/A'}</td>
                  <td className="px-6 py-4 opacity-80">{farmer.state ? `${farmer.state}, ${farmer.lga || ''}` : 'N/A'}</td>
                  <td className="px-6 py-4 opacity-80">
                    <span className="font-mono bg-white/5 px-2 py-1 rounded border border-white/10">{farmer.creditScore?.score || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase
                      ${farmer.profileStatus === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                      {farmer.profileStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 opacity-80 font-mono">{new Date(farmer.registrationDate).toLocaleDateString()}</td>
                </tr>
              )})}
              {filteredFarmers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No farmers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-t border-white/10 mt-4 rounded-b-3xl">
          <div className="text-sm text-slate-400">
            Showing <span className="font-medium text-slate-200">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium text-slate-200">{Math.min(currentPage * itemsPerPage, filteredFarmers.length)}</span> of <span className="font-medium text-slate-200">{filteredFarmers.length}</span> farmers
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-slate-300 transition-colors"
            >
              Previous
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-slate-300 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-lg font-bold tracking-tight text-slate-100">Register Farmer</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Title</label>
                  <select 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [&>option]:bg-slate-800"
                  >
                    <option>Mr</option>
                    <option>Mrs</option>
                    <option>Dr</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">First Name</label>
                  <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" />
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Last Name</label>
                <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Organization</label>
                  <select value={formData.organizationId} onChange={e => setFormData({...formData, organizationId: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [&>option]:bg-slate-800">
                    <option value="">-- Select Organization --</option>
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Program</label>
                  <select value={formData.programId} onChange={e => setFormData({...formData, programId: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [&>option]:bg-slate-800">
                    <option value="">-- Select Program --</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Gender</label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [&>option]:bg-slate-800">
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Phone</label>
                  <input required type="tel" value={formData.primaryPhone} onChange={e => setFormData({...formData, primaryPhone: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">State</label>
                  <select value={formData.state} onChange={handleStateChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [&>option]:bg-slate-800">
                    {Object.keys(NIGERIA_STATES).map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">LGA</label>
                  <select value={formData.lga} onChange={e => setFormData({...formData, lga: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [&>option]:bg-slate-800">
                    {NIGERIA_STATES[formData.state]?.map(lga => (
                      <option key={lga} value={lga}>{lga}</option>
                    ))}
                  </select>
                </div>
              </div>



              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Crop</label>
                  <input type="text" value={formData.crop || ''} onChange={e => setFormData({...formData, crop: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Farming Type</label>
                  <select value={formData.farmingType || 'Conventional'} onChange={e => setFormData({...formData, farmingType: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [&>option]:bg-slate-800">
                    <option value="Conventional">Conventional</option>
                    <option value="Organic">Organic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Planting Date</label>
                  <input type="date" value={formData.plantingDate || ''} onChange={e => setFormData({...formData, plantingDate: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100 [color-scheme:dark]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Latitude</label>
                  <input type="number" step="any" required value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Longitude</label>
                  <input type="number" step="any" required value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" />
                </div>
              </div>
              <div className="flex justify-end">
                 <button type="button" onClick={getLocation} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    Auto-collect GPS
                 </button>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 text-sm font-semibold text-white rounded-full shadow-lg transition-all hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                  Save Farmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden container for bulk exports */}
      <div ref={hiddenContainerRef} style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none', opacity: 0 }}>
        {isExporting && filteredFarmers.map(farmer => (
          <div key={farmer.id}>
            <IDCard farmer={farmer} />
            <Certificate farmer={farmer} />
          </div>
        ))}
      </div>
    </div>
  );
}
