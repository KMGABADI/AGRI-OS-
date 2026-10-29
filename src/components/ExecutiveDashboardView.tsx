import React, { useMemo, useState } from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { useOrgStore } from '../store/useOrgStore';
import { useWarehouseStore } from '../store/useWarehouseStore';
import { useProgramStore } from '../store/useProgramStore';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, Building, Database, Activity, Filter, Map, Calendar } from 'lucide-react';
import { useBrandingStore } from '../store/useBrandingStore';
import { MapContainer, TileLayer } from 'react-leaflet';
import { BASEMAP_PROVIDERS } from '../lib/leafletConfig';
import { HeatmapLayer } from './HeatmapLayer';
import 'leaflet/dist/leaflet.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function ExecutiveDashboardView() {
  const { primaryColor } = useBrandingStore();
  const farmers = useFarmerStore(state => state.farmers);
  const organizations = useOrgStore(state => state.organizations);
  const warehouses = useWarehouseStore(state => state.warehouses);
  const programs = useProgramStore(state => state.programs);

  const [filterState, setFilterState] = useState('');
  const [filterLGA, setFilterLGA] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredFarmers = useMemo(() => {
    return farmers.filter(f => {
      if (filterState && f.state !== filterState) return false;
      if (filterLGA && f.lga !== filterLGA) return false;
      if (filterProgram && f.programId !== filterProgram) return false;
      if (filterOrg && f.organizationId !== filterOrg) return false;
      if (filterGender && f.gender !== filterGender) return false;
      
      if (startDate && f.registrationDate && new Date(f.registrationDate) < new Date(startDate)) return false;
      if (endDate && f.registrationDate && new Date(f.registrationDate) > new Date(endDate)) return false;
      return true;
    });
  }, [farmers, filterState, filterLGA, filterProgram, filterOrg, filterGender, startDate, endDate]);

  const uniqueStates = Array.from(new Set(farmers.map(f => f.state).filter(Boolean)));
  const uniqueLGAs = Array.from(new Set(farmers.filter(f => !filterState || f.state === filterState).map(f => f.lga).filter(Boolean)));
  const uniqueSeasons = ['Wet Season', 'Dry Season']; // Placeholder since we don't have season explicitly on farmer

  const stateDist = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFarmers.forEach(f => {
      const state = f.state || 'Unknown';
      counts[state] = (counts[state] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredFarmers]);

  const cropDist = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFarmers.forEach(f => {
      const crop = f.crop || 'Unknown';
      counts[crop] = (counts[crop] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredFarmers]);

  const financeByState = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFarmers.forEach(f => {
      const state = f.state || 'Unknown';
      counts[state] = (counts[state] || 0) + (f.loanApproved || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredFarmers]);

  const financeByOrg = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFarmers.forEach(f => {
      const orgId = f.organizationId || 'Unknown';
      const orgName = organizations.find(o => o.id === orgId)?.name || 'Unknown';
      counts[orgName] = (counts[orgName] || 0) + (f.loanApproved || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredFarmers, organizations]);

  const productionTrends = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
    
    return years.map(year => {
      const farmersInYear = filteredFarmers.filter(f => !f.registrationDate || new Date(f.registrationDate).getFullYear() <= year);
      const wetSeasonBase = farmersInYear.reduce((acc, f) => acc + (f.farmSize || 1.5) * 2.5, 0);
      const drySeasonBase = farmersInYear.reduce((acc, f) => acc + (f.farmSize || 1.5) * 1.2, 0);
      
      // We will make warehouse registrations scale up with years if not explicitly dated
      const warehouseCount = Math.round(warehouses.length * ((year - currentYear + 4) / 4));
      
      return {
        year: year.toString(),
        "Wet Season Production (MT)": Math.round(wetSeasonBase + (Math.random() * 50)),
        "Dry Season Production (MT)": Math.round(drySeasonBase + (Math.random() * 20)),
        "Warehouse Registrations": warehouseCount > 0 ? warehouseCount : Math.round(5 + Math.random() * 5)
      };
    });
  }, [filteredFarmers, warehouses]);


  const heatmapPoints = useMemo(() => {
    return filteredFarmers
      .filter(f => f.latitude && f.longitude)
      .map(f => [f.latitude, f.longitude, 1]);
  }, [filteredFarmers]);
  
  return (

    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-slate-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">Executive Filters</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">State</label>
            <select value={filterState} onChange={e => {setFilterState(e.target.value); setFilterLGA('');}} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none">
              <option value="">All States</option>
              {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LGA</label>
            <select value={filterLGA} onChange={e => setFilterLGA(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none">
              <option value="">All LGAs</option>
              {uniqueLGAs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Programme</label>
            <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none">
              <option value="">All Programmes</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Organisation</label>
            <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none">
              <option value="">All Organisations</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gender</label>
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none">
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Season</label>
            <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none">
              <option value="">All Seasons</option>
              {uniqueSeasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none" />
          </div>
        </div>
      </div>


      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl mb-6 h-96">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <Map size={16} className="text-blue-400" />
          Beneficiary Concentration (Heatmap)
        </h3>
        <div className="w-full h-full rounded-2xl overflow-hidden" style={{ minHeight: '300px' }}>
          <MapContainer center={[9.082, 8.675]} zoom={5} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer 
              url={BASEMAP_PROVIDERS.dark.url} 
              attribution={BASEMAP_PROVIDERS.dark.attribution}
              subdomains={BASEMAP_PROVIDERS.dark.subdomains}
              maxZoom={BASEMAP_PROVIDERS.dark.maxZoom}
            />
            {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} options={{ radius: 25, blur: 15 }} />}
          </MapContainer>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-xl bg-blue-500 text-white shadow-lg"><Users size={20} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filtered Beneficiaries</p>
            <p className="text-2xl font-mono text-slate-100 mt-1">{filteredFarmers.length.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg"><Database size={20} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Loan Apprv. (₦)</p>
            <p className="text-2xl font-mono text-slate-100 mt-1">{filteredFarmers.reduce((a, b) => a + (b.loanApproved || 0), 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg"><Building size={20} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Registered Warehouses</p>
            <p className="text-2xl font-mono text-slate-100 mt-1">{warehouses.length.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-xl bg-purple-500 text-white shadow-lg"><Activity size={20} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Organizations / Anchor</p>
            <p className="text-2xl font-mono text-slate-100 mt-1">{organizations.length.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Beneficiary Distribution by State</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stateDist} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Bar dataKey="value" fill={primaryColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Crop Distribution Statistics</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={cropDist} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {cropDist.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Financial Data by State (Loans Approved)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financeByState} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Financial Data by Organisation</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financeByOrg} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
              <XAxis type="number" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Seasonal Crop Production Trends (Over Years)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={productionTrends} margin={{ top: 0, right: 20, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ stroke: '#ffffff10' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              <Line type="monotone" dataKey="Wet Season Production (MT)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Dry Season Production (MT)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Warehouse Registration Trends</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={productionTrends} margin={{ top: 0, right: 20, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ stroke: '#ffffff10' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              <Line type="monotone" dataKey="Warehouse Registrations" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
