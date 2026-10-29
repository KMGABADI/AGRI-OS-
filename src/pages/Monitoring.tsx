import React from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { useInterventionStore } from '../store/useInterventionStore';
import { useEffect } from 'react';
import { Activity, Target, ShieldCheck } from 'lucide-react';

export default function Monitoring() {
  const farmers = useFarmerStore(state => state.farmers);
  
  // Aggregate interventions across all farmers
  
  const interventionsRecord = useInterventionStore(state => state.interventions);
  const fetchInterventions = useInterventionStore(state => state.fetchInterventions);
  
  useEffect(() => {
    // Fetch interventions for all loaded farmers
    farmers.forEach(f => fetchInterventions(f.id));
  }, [farmers, fetchInterventions]);

  const allInterventions = Object.entries(interventionsRecord).flatMap(([farmerId, invs]) => {
    const f = farmers.find(farmer => farmer.id === farmerId);
    if (!f) return [];
    return invs.map(inv => ({...inv, farmerName: `${f.firstName} ${f.lastName}`, farmerId: f.id}));
  });


  const totalInterventions = allInterventions.length;
  const completedInterventions = allInterventions.filter(i => i.status === 'Completed').length;
  
  const avgImpact = allInterventions.length > 0 
    ? Math.round(allInterventions.reduce((sum, curr) => sum + (curr.impactScore || 0), 0) / allInterventions.length) 
    : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">Monitoring & Evaluation</h2>
        <p className="text-slate-400">Track interventions and measure programmatic impact.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
            <Target size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Interventions</p>
            <p className="text-2xl font-mono text-slate-100">{totalInterventions}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Completed</p>
            <p className="text-2xl font-mono text-slate-100">{completedInterventions}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Avg Impact Score</p>
            <p className="text-2xl font-mono text-slate-100">{avgImpact}/100</p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-xl mt-8">
        <div className="p-6 border-b border-white/10 bg-white/5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Intervention Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-widest text-[10px] border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Intervention Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Beneficiary</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Impact Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {allInterventions.length > 0 ? (
                allInterventions.map((inv, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-100">{inv.name}</td>
                    <td className="px-6 py-4 opacity-80">{inv.type}</td>
                    <td className="px-6 py-4 opacity-80">
                      <a href={`/farmers/${inv.farmerId}`} className="text-blue-400 hover:underline">{inv.farmerName}</a>
                    </td>
                    <td className="px-6 py-4 opacity-80 font-mono">{inv.dateApplied}</td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase
                        ${inv.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">{inv.impactScore || 'N/A'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No interventions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
