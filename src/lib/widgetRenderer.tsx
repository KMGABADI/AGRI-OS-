import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];

export function renderWidgetData(widget: any, farmers: any[], organizations: any[]) {
  if (widget.type === 'kpi_card') {
    let value = 0;
    if (widget.dataSource === 'Farmers DB') value = farmers.length;
    else if (widget.dataSource === 'Beneficiaries DB') value = farmers.length;
    else if (widget.dataSource === 'Organizations DB') value = organizations.length;
    
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/50 rounded-xl border border-white/5 p-4 text-center">
        <span className="text-5xl font-mono font-bold text-emerald-400 mb-2">{value.toLocaleString()}</span>
        <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">{widget.name}</span>
      </div>
    );
  }

  if (widget.type === 'pie_chart') {
    let data: any[] = [];
    if (widget.dataFunction === 'aggregateByGender') {
      const counts: Record<string, number> = {};
      farmers.forEach(f => {
        const g = f.gender || 'Unknown';
        counts[g] = (counts[g] || 0) + 1;
      });
      data = Object.entries(counts).map(([name, value]) => ({ name, value }));
    } else {
      data = [{ name: 'Placeholder', value: 1 }];
    }
    return (
      <div className="flex-1 w-full bg-slate-900/50 rounded-xl border border-white/5 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widget.type === 'bar_chart') {
    let data: any[] = [];
    if (widget.dataFunction === 'aggregateByStatus') {
      const counts: Record<string, number> = { Active: 0, Pending: 0, Suspended: 0 };
      farmers.forEach(f => {
        const status = f.profileStatus || 'Active';
        counts[status] = (counts[status] || 0) + 1;
      });
      data = Object.entries(counts).map(([name, count]) => ({ name, count }));
    } else {
      data = [{ name: 'Placeholder', count: 1 }];
    }
    return (
      <div className="flex-1 w-full bg-slate-900/50 rounded-xl border border-white/5 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="name" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
            <Bar dataKey="count" fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/50 rounded-xl border border-white/5 p-4 text-center">
      <p className="text-sm text-slate-300 font-semibold mb-1">Widget Type: {widget.type.replace('_', ' ').toUpperCase()}</p>
      <p className="text-xs text-slate-500 font-mono">Source: {widget.dataSource}</p>
      <div className="mt-4 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs text-slate-400">
        Live Data Connected
      </div>
    </div>
  );
}
