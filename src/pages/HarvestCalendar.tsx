import React, { useMemo, useState } from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { useSettingsStore, THEMES } from '../store/useSettingsStore';
import { CalendarDays, Sprout, Wheat, CheckCircle2 } from 'lucide-react';

// Estimated days to harvest for different crops
const CROP_HARVEST_DAYS: Record<string, number> = {
  'Maize': 90,
  'Rice': 120,
  'Cassava': 270,
  'Cocoa': 1825, // 5 years usually, but let's just make it simple
  'Wheat': 110,
  'Soybean': 100,
  'Sorghum': 110,
  'Yam': 210,
};

export default function HarvestCalendar() {
  const { farmers } = useFarmerStore();
  const settings = useSettingsStore();
  const theme = settings.theme || THEMES.frosted;

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const harvestEvents = useMemo(() => {
    const events: Array<{ farmer: any; plantingDate: Date; harvestDate: Date; crop: string }> = [];

    farmers.forEach(f => {
      if (f.plantingDate && f.crop) {
        const pDate = new Date(f.plantingDate);
        if (!isNaN(pDate.getTime())) {
          // Default to 120 days if crop not found
          const daysToHarvest = CROP_HARVEST_DAYS[f.crop] || 120;
          const hDate = new Date(pDate.getTime() + daysToHarvest * 24 * 60 * 60 * 1000);
          events.push({
            farmer: f,
            plantingDate: pDate,
            harvestDate: hDate,
            crop: f.crop
          });
        }
      }
    });

    return events.sort((a, b) => a.harvestDate.getTime() - b.harvestDate.getTime());
  }, [farmers]);

  const filteredEvents = useMemo(() => {
    return harvestEvents.filter(e => 
      e.harvestDate.getMonth() === selectedMonth && 
      e.harvestDate.getFullYear() === selectedYear
    );
  }, [harvestEvents, selectedMonth, selectedYear]);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = Array.from(new Set(harvestEvents.map(e => e.harvestDate.getFullYear()))).sort();
  if (!years.includes(new Date().getFullYear())) {
    years.push(new Date().getFullYear());
  }

  // Group events by day
  const eventsByDay: Record<number, typeof harvestEvents> = {};
  filteredEvents.forEach(e => {
    const day = e.harvestDate.getDate();
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(e);
  });

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
  
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-end shrink-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <CalendarDays className="text-emerald-400" />
              Harvest Calendar
            </h2>
            <p className="text-slate-400 mt-1">Visualizing upcoming harvest windows based on planting dates.</p>
          </div>
          
          <div className="flex gap-4 items-center">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors [&>option]:bg-slate-800"
            >
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors [&>option]:bg-slate-800"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className={`${theme.bgClass} ${theme.borderClass} border backdrop-blur-2xl rounded-3xl p-6 shadow-xl`}>
          
          <div className="grid grid-cols-7 gap-4 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-4">
            {blanksArray.map(b => (
              <div key={`blank-${b}`} className="h-32 bg-white/5 rounded-2xl opacity-50 border border-white/5"></div>
            ))}
            
            {daysArray.map(day => {
              const dayEvents = eventsByDay[day] || [];
              const isToday = new Date().getDate() === day && new Date().getMonth() === selectedMonth && new Date().getFullYear() === selectedYear;

              return (
                <div key={day} className={`h-32 rounded-2xl border p-2 flex flex-col ${isToday ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/20 border-white/10 hover:border-white/20'} transition-colors overflow-hidden`}>
                  <div className="flex justify-between items-start mb-2 shrink-0">
                    <span className={`text-sm font-bold ${isToday ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
                    {dayEvents.map((evt, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded p-1.5 text-xs">
                        <div className="font-semibold text-slate-200 truncate">{evt.farmer.firstName} {evt.farmer.lastName}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Wheat size={10} />
                          {evt.crop}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
        
        {/* Upcoming List View */}
        {filteredEvents.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Detailed Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((evt, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-4 hover:bg-white/10 transition-colors">
                  <div className="bg-emerald-500/20 text-emerald-400 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                    <Sprout size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200">{evt.farmer.firstName} {evt.farmer.lastName}</h4>
                    <p className="text-xs text-slate-400 mt-1">Expected Harvest: {evt.harvestDate.toLocaleDateString()}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-semibold">
                        {evt.crop}
                      </span>
                      {evt.farmer.community && (
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-semibold">
                          {evt.farmer.community}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
