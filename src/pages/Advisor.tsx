import React from 'react';
import AgriculturalAdvisorChat from '../components/AgriculturalAdvisorChat';
import { Bot, Sparkles, MapPin, Wheat, Warehouse, ShieldCheck } from 'lucide-react';

export default function Advisor() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Highlights Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/60 via-slate-900/60 to-slate-900/80 border border-emerald-500/20 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles size={13} /> Gemini 3.8 Flash Grounded
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
              <MapPin size={13} /> Google Maps Live Data
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-3 tracking-tight flex items-center gap-3">
            <span>Agricultural Farm Advisor & Extension Hub</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Real-time agronomist guidance for farmer yield optimization, disease diagnostic protocols, and instant discovery of verified grain silos, fertilizer outlets, and seed dealers.
          </p>
        </div>

        {/* Feature badges */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-slate-300">
            <Wheat size={16} className="text-emerald-400" />
            <span>Agronomic Schedules</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-slate-300">
            <Warehouse size={16} className="text-amber-400" />
            <span>Silo & Storage Locator</span>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="h-[720px]">
        <AgriculturalAdvisorChat isFloating={false} />
      </div>
    </div>
  );
}
