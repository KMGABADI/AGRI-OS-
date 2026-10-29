import React, { useEffect, useMemo, useState } from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { useNotificationStore, Alert } from '../store/useNotificationStore';
import { useSettingsStore, THEMES } from '../store/useSettingsStore';
import { BellRing, Send, CheckCircle2, AlertTriangle, Sprout, Settings, RefreshCw, Smartphone, Mail, Trash2 } from 'lucide-react';

const CROP_HARVEST_DAYS: Record<string, number> = {
  'Maize': 90,
  'Rice': 120,
  'Cassava': 270,
  'Cocoa': 1825,
  'Wheat': 110,
  'Soybean': 100,
  'Sorghum': 110,
  'Yam': 210,
};

export default function Alerts() {
  const { farmers } = useFarmerStore();
  const { alerts, addAlert, markAsSent, autoSendEnabled, toggleAutoSend, clearAlerts } = useNotificationStore();
  const settings = useSettingsStore();
  const theme = settings.theme || THEMES.frosted;

  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Sent'>('All');

  const generateAlerts = () => {
    setIsGenerating(true);
    setTimeout(() => {
      let newAlertsCount = 0;
      
      farmers.forEach(farmer => {
        // 1. Harvest Alerts
        if (farmer.plantingDate && farmer.crop) {
          const pDate = new Date(farmer.plantingDate);
          if (!isNaN(pDate.getTime())) {
            const daysToHarvest = CROP_HARVEST_DAYS[farmer.crop] || 120;
            const hDate = new Date(pDate.getTime() + daysToHarvest * 24 * 60 * 60 * 1000);
            
            const daysLeft = Math.ceil((hDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            
            // If harvest is within 14 days and we don't have an alert for this farmer yet
            if (daysLeft > 0 && daysLeft <= 14) {
              const hasAlert = alerts.some(a => a.farmerId === farmer.id && a.type === 'Harvest' && a.status === 'Pending');
              if (!hasAlert) {
                addAlert({
                  farmerId: farmer.id,
                  type: 'Harvest',
                  message: `Your \${farmer.crop} harvest is coming up in \${daysLeft} days (\${hDate.toLocaleDateString()}). Prepare storage and logistics.`,
                  status: autoSendEnabled ? 'Sent' : 'Pending',
                  channel: autoSendEnabled ? 'SMS' : undefined,
                  sentAt: autoSendEnabled ? new Date().toISOString() : undefined
                });
                newAlertsCount++;
              }
            }
          }
        }

        // 2. Soil Health Concerns (Simulated based on crop type or region)
        // E.g. Corn and Wheat in dry regions might need NPK top-up
        if (farmer.crop && ['Maize', 'Wheat'].includes(farmer.crop)) {
            // Randomly assign to 10% of such farmers if they don't have one
            const hasAlert = alerts.some(a => a.farmerId === farmer.id && a.type === 'SoilHealth');
            if (!hasAlert && Math.random() > 0.9) {
                addAlert({
                  farmerId: farmer.id,
                  type: 'SoilHealth',
                  message: `Predictive models suggest low nitrogen levels in your area. Consider applying NPK fertilizer within 7 days for optimal \${farmer.crop} yield.`,
                  status: autoSendEnabled ? 'Sent' : 'Pending',
                  channel: autoSendEnabled ? 'SMS' : undefined,
                  sentAt: autoSendEnabled ? new Date().toISOString() : undefined
                });
                newAlertsCount++;
            }
        }
      });
      setIsGenerating(false);
    }, 1500);
  };

  const handleSend = (id: string, channel: 'SMS' | 'Email') => {
    markAsSent(id, channel);
  };

  const handleSendAll = () => {
    alerts.filter(a => a.status === 'Pending').forEach(a => {
        markAsSent(a.id, 'SMS');
    });
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => filter === 'All' ? true : a.status === filter).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [alerts, filter]);

  const getFarmerName = (id: string) => {
    const f = farmers.find(f => f.id === id);
    return f ? `\${f.firstName} \${f.lastName}` : 'Unknown Farmer';
  };
  
  const getFarmerPhone = (id: string) => {
    const f = farmers.find(f => f.id === id);
    return f ? f.primaryPhone : '';
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-end shrink-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <BellRing className="text-amber-400" />
              Automated Alerts & Notifications
            </h2>
            <p className="text-slate-400 mt-1">Predictive alerts for harvest windows and soil health.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
                onClick={toggleAutoSend}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors \${autoSendEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
            >
                <Settings size={16} />
                Auto-Send: {autoSendEnabled ? 'ON' : 'OFF'}
            </button>
            <button 
                onClick={generateAlerts}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
                <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />
                {isGenerating ? 'Analyzing...' : 'Run Analytics Engine'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400">Total Generated</p>
                    <p className="text-2xl font-bold text-slate-100">{alerts.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <BellRing size={24} />
                </div>
            </div>
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400">Pending Delivery</p>
                    <p className="text-2xl font-bold text-amber-400">{alerts.filter(a => a.status === 'Pending').length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <AlertTriangle size={24} />
                </div>
            </div>
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400">Successfully Sent</p>
                    <p className="text-2xl font-bold text-emerald-400">{alerts.filter(a => a.status === 'Sent').length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={24} />
                </div>
            </div>
        </div>

        <div className={`\${theme.bgClass} \${theme.borderClass} border backdrop-blur-2xl rounded-3xl p-6 shadow-xl`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/10">
                    {['All', 'Pending', 'Sent'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab as any)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === tab ? 'bg-white/10 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                
                <div className="flex items-center gap-2">
                    {alerts.some(a => a.status === 'Pending') && (
                        <button 
                            onClick={handleSendAll}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 rounded-xl text-sm font-semibold transition-colors"
                        >
                            <Send size={16} /> Send All Pending (SMS)
                        </button>
                    )}
                    {alerts.length > 0 && (
                        <button 
                            onClick={clearAlerts}
                            className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-sm font-semibold transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {filteredAlerts.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <BellRing className="mx-auto text-slate-500 mb-3" size={32} />
                    <h3 className="text-lg font-semibold text-slate-300">No alerts found</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
                        Click "Run Analytics Engine" to scan farmer records and generate automated predictions for harvest windows and soil health.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAlerts.map(alert => (
                        <div key={alert.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col md:flex-row gap-4 justify-between group hover:bg-white/10 transition-colors">
                            <div className="flex gap-4 items-start">
                                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border \${alert.type === 'Harvest' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                                    {alert.type === 'Harvest' ? <Sprout size={20} /> : <AlertTriangle size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-slate-200">{getFarmerName(alert.farmerId)}</h4>
                                        <span className="text-xs text-slate-500 font-mono">{getFarmerPhone(alert.farmerId)}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold \${alert.status === 'Sent' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-300'}`}>
                                            {alert.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">{alert.message}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                        <span>Generated: {new Date(alert.createdAt).toLocaleString()}</span>
                                        {alert.sentAt && <span>Sent via {alert.channel}: {new Date(alert.sentAt).toLocaleString()}</span>}
                                    </div>
                                </div>
                            </div>
                            
                            {alert.status === 'Pending' && (
                                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                                    <button 
                                        onClick={() => handleSend(alert.id, 'SMS')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 transition-colors"
                                    >
                                        <Smartphone size={14} /> SMS
                                    </button>
                                    <button 
                                        onClick={() => handleSend(alert.id, 'Email')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 transition-colors"
                                    >
                                        <Mail size={14} /> Email
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
