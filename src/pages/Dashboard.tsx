import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarmerStore } from '../store/useFarmerStore';
import { useOrgStore } from '../store/useOrgStore';
import { useWarehouseStore } from '../store/useWarehouseStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useDashboardStore } from '../store/useDashboardStore';
import { Users, Sprout, Building, Map, Activity, Download, FileText, FileSpreadsheet, Bot, Sparkles, MapPin, ArrowRight } from 'lucide-react';
import jsPDF from 'jspdf';
import { renderWidgetData } from '../lib/widgetRenderer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { WeatherWidget } from '../components/WeatherWidget';
import { ExecutiveDashboardView } from '../components/ExecutiveDashboardView';

export default function Dashboard() {
  const { primaryColor } = useBrandingStore();
  const settings = useSettingsStore();
  const dashboard = settings.dashboard || {
    showStats: true,
    showCropChart: true,
    showScoreChart: true,
    showRecentInterventions: true,
  };
  const farmers = useFarmerStore(state => state.farmers);
  const isLoading = useFarmerStore(state => state.isLoading);
  const organizations = useOrgStore(state => state.organizations);
  const warehouses = useWarehouseStore(state => state.warehouses);
  const configuredWidgets = useDashboardStore(state => state.widgets);
  const dashboardsList = useDashboardStore(state => state.dashboards);


  const activeWidgets = configuredWidgets.filter(w => w.visibilityStatus);
const [activeTab, setActiveTab] = useState('Dashboard');
  const tabs = ['Dashboard', ...(dashboardsList || []).filter(d => d !== 'Dashboard' && d !== 'System Overview')];
  
  const widgetsToDisplay = activeTab === 'Dashboard' 
    ? activeWidgets.filter(w => !w.assignedDashboards || w.assignedDashboards.length === 0 || w.assignedDashboards.includes('Dashboard') || w.assignedDashboards.includes('System Overview') || w.assignedDashboards.includes('Executive Overview'))
    : activeWidgets.filter(w => w.assignedDashboards && w.assignedDashboards.includes(activeTab));


  const stats = [
    { label: 'Total Farmers', value: farmers.length, icon: Users },
    { label: 'Avg Credit Score', value: Math.round(farmers.reduce((sum, f) => sum + (f.creditScore?.score || 0), 0) / (farmers.length || 1)), icon: Activity },
    { label: 'Cooperatives', value: organizations.length, icon: Building },
    { label: 'Active Regions', value: new Set(farmers.map(f => f.state).filter(Boolean)).size, icon: Map },
  ];

  // Prepare chart data
  const cropData = useMemo(() => {
    const counts: Record<string, number> = {};
    farmers.forEach(f => {
      const crop = f.crop || 'Unknown';
      counts[crop] = (counts[crop] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [farmers]);

  const scoreData = useMemo(() => {
    const bins = { '0-300': 0, '301-500': 0, '501-700': 0, '701+': 0 };
    farmers.forEach(f => {
      const s = f.creditScore?.score || 0;
      if (s <= 300) bins['0-300']++;
      else if (s <= 500) bins['301-500']++;
      else if (s <= 700) bins['501-700']++;
      else bins['701+']++;
    });
    return Object.entries(bins).map(([name, value]) => ({ name, value }));
  }, [farmers]);

  const comparisonData = useMemo(() => {
    const activeWarehouses = warehouses.filter(w => w.status === 'Active').length;
    return [
      { name: 'Farmers vs Warehouses', 'Registered Farmers': farmers.length, 'Active Warehouses': activeWarehouses }
    ];
  }, [farmers, warehouses]);

  // Predictive Analytics: Projected Harvest Yield
  const projectedYieldData = useMemo(() => {
    // Base yield per hectare (MT/ha) approximations
    const baseYields: Record<string, number> = {
      'Maize': 2.5,
      'Rice': 3.5,
      'Cassava': 12.0,
      'Cocoa': 0.6,
      'Wheat': 3.0,
      'Soybean': 1.5,
      'Sorghum': 1.2
    };

    const yieldsByCrop: Record<string, number> = {};

    farmers.forEach(f => {
      if (!f.crop || !f.farmSize) return;
      const crop = f.crop;
      const baseYield = baseYields[crop] || 2.0; // Default base yield
      
      // Calculate projected yield: Base * Area * (1 + (Experience * 0.02))
      const expMultiplier = 1 + ((f.experience || 0) * 0.02);
      const projected = baseYield * f.farmSize * expMultiplier;

      yieldsByCrop[crop] = (yieldsByCrop[crop] || 0) + projected;
    });

    return Object.entries(yieldsByCrop)
      .map(([name, value]) => ({ name, projectedYield: Math.round(value) }))
      .sort((a, b) => b.projectedYield - a.projectedYield)
      .slice(0, 5);
  }, [farmers]);


  const productionTrendsData = useMemo(() => {
    const trends: Record<string, Record<string, number>> = {};
    const states = new Set<string>();
    const baseYields: Record<string, number> = {
      'Maize': 2.5, 'Rice': 3.5, 'Cassava': 12.0, 'Cocoa': 0.6,
      'Wheat': 3.0, 'Soybean': 1.5, 'Sorghum': 1.2
    };

    farmers.forEach(f => {
      if (!f.plantingDate || !f.crop || !f.farmSize || !f.state) return;
      const pDate = new Date(f.plantingDate);
      if (isNaN(pDate.getTime())) return;
      
      const baseYield = baseYields[f.crop] || 2.0;
      const expMultiplier = 1 + ((f.experience || 0) * 0.02);
      const projected = baseYield * f.farmSize * expMultiplier;
      
      const state = f.state;
      states.add(state);

      const hDate = new Date(pDate.getTime() + 120 * 24 * 60 * 60 * 1000);
      const monthYear = `${hDate.getFullYear()}-${String(hDate.getMonth() + 1).padStart(2, '0')}`;

      if (!trends[monthYear]) {
        trends[monthYear] = {};
      }
      trends[monthYear][state] = (trends[monthYear][state] || 0) + projected;
    });

    const sortedMonths = Object.keys(trends).sort();
    return {
      data: sortedMonths.map(month => {
        const item: any = { name: month };
        Array.from(states).forEach(state => {
          if (trends[month][state]) {
            item[state] = Math.round(trends[month][state]);
          }
        });
        return item;
      }),
      states: Array.from(states)
    };
  }, [farmers]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#8b5cf6'];


  const exportCSV = () => {
    const headers = ['Farmer ID', 'First Name', 'Last Name', 'Primary Phone', 'State', 'LGA', 'Crop', 'Farm Size (Ha)', 'Farming Type', 'Planting Date', 'Experience (Years)'];
    const rows = farmers.map(f => [
      f.farmerID || '',
      f.firstName || '',
      f.lastName || '',
      f.primaryPhone || '',
      f.state || '',
      f.lga || '',
      f.crop || '',
      f.farmSize || '',
      f.farmingType || '',
      f.plantingDate || '',
      f.experience || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `farmer_reports_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Farmer Harvest & Profile Report', 14, 20);
    
    doc.setFontSize(10);
    let y = 30;
    
    // Add summary stats
    doc.text(`Total Farmers: ${farmers.length}`, 14, y); y += 6;
    const activeWarehouses = warehouses.filter(w => w.status === 'Active').length;
    doc.text(`Active Warehouses: ${activeWarehouses}`, 14, y); y += 10;
    
    // Add top projected harvests
    doc.setFontSize(12);
    doc.text('Top Projected Harvests (MT)', 14, y); y += 6;
    doc.setFontSize(10);
    projectedYieldData.forEach(item => {
      doc.text(`${item.name}: ${item.projectedYield} MT`, 14, y); y += 5;
    });
    
    y += 10;
    
    // Add sample of farmers
    doc.setFontSize(12);
    doc.text('Recent Farmers', 14, y); y += 6;
    doc.setFontSize(9);
    farmers.slice(0, 15).forEach((f, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${index + 1}. ${f.firstName} ${f.lastName} - ${f.crop || 'N/A'} - ${f.state || 'N/A'}`, 14, y);
      y += 5;
    });

    doc.save(`harvest_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Dashboard</h2>
          <p className="text-slate-400">Real-time metrics from the Agricultural Operating System.</p>
        </div>
        
        {tabs.length > 1 && (
          <div className="flex overflow-x-auto gap-2 pb-2 mb-6 border-b border-white/10 w-full mt-4">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab 
                    ? 'bg-white/10 text-white border-b-2 border-blue-500' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-slate-200 transition-colors">
            <FileSpreadsheet size={16} className="text-emerald-400" />
            Export CSV
          </button>
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-slate-200 transition-colors">
            <FileText size={16} className="text-blue-400" />
            Export PDF
          </button>
        </div>
      </div>

      
      


      {activeTab === 'Dashboard' && (
        <>
          <ExecutiveDashboardView />
      {isLoading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl flex items-center gap-4 shadow-xl animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-white/10 shrink-0 shadow-lg"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-3 bg-white/10 rounded-full w-24"></div>
                  <div className="h-8 bg-white/10 rounded-full w-16"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-96 mt-6 animate-pulse">
            <div className="h-4 bg-white/10 rounded-full w-48 mb-6"></div>
            <div className="h-72 bg-white/5 rounded-xl"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80 animate-pulse">
              <div className="h-4 bg-white/10 rounded-full w-48 mb-6"></div>
              <div className="h-56 bg-white/5 rounded-xl"></div>
            </div>
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80 animate-pulse">
              <div className="h-4 bg-white/10 rounded-full w-48 mb-6"></div>
              <div className="h-56 bg-white/5 rounded-xl"></div>
            </div>
          </div>
        </>
      ) : (
        <>
      {dashboard.showStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl flex items-center gap-4 shadow-xl">
              <div 
                className="p-3 rounded-xl text-white flex-shrink-0 shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="text-3xl font-mono text-slate-100 mt-1">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Gemini 3.8 Farm Advisor & Maps Grounding Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-teal-950/70 border border-emerald-500/30 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50 flex-shrink-0">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base">Gemini Farm Advisor & Agronomist</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles size={11} /> Gemini 3.8 Flash
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                <MapPin size={11} /> Maps Grounded
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Need advice on crop pests, planting dates, or locating local grain storage silos and certified seed dealers? Consult the Farm Advisor.
            </p>
          </div>
        </div>
        <Link
          to="/advisor"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-emerald-600/30 flex-shrink-0 group"
        >
          <span>Open Farm Advisor</span>
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Weather Widget */}
      <WeatherWidget />

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-96 mt-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          Regional Crop Production Trends (Projected Harvest MT)
        </h3>
        {productionTrendsData.data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={productionTrendsData.data} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ stroke: '#ffffff10' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#94a3b8' }} />
              {productionTrendsData.states.map((state, index) => (
                <Line 
                  key={state} 
                  type="monotone" 
                  dataKey={state} 
                  name={state} 
                  stroke={COLORS[index % COLORS.length]} 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#1e293b', strokeWidth: 2 }} 
                  activeDot={{ r: 6 }} 
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
            No trend data available. Add farmers with planting dates and regions.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {dashboard.showCropChart && (
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Top Crop Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cropData} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Bar dataKey="value" fill={primaryColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Sprout size={16} className="text-emerald-400" />
            Projected Harvest Yield (MT)
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectedYieldData} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Bar dataKey="projectedYield" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {dashboard.showScoreChart && (
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Credit Score Health</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {scoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {scoreData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-[10px] text-slate-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {settings.features?.enableFoodBank && (
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Farmers vs Active Warehouses</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Bar dataKey="Registered Farmers" fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Active Warehouses" fill={COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
        </>
      )}
        </>
      )}

      {widgetsToDisplay.length > 0 && (
        <>
          <div className="mt-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-100 mb-2">Custom Dashboard Widgets</h2>
            <p className="text-slate-400 mb-6">Widgets configured in the Dashboard Editor.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgetsToDisplay.map(widget => (
              <div key={widget.id} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl h-80 flex flex-col">
                <div className="mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">{widget.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{widget.description}</p>
                </div>
                {renderWidgetData(widget, farmers, organizations)}
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
