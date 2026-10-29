import React, { useState, useEffect, useMemo } from 'react';
import { useFarmerStore } from '../store/useFarmerStore';
import { CloudRain, Sun, Cloud, Wind, AlertTriangle, CloudLightning, Droplets, MapPin, Loader2 } from 'lucide-react';
import { useSettingsStore, THEMES } from '../store/useSettingsStore';

interface WeatherData {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  windspeed_10m_max: number[];
}

export const WeatherWidget = () => {
  const { farmers } = useFarmerStore();
  const settings = useSettingsStore();
  const theme = settings.theme || THEMES.frosted;

  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get regions/locations from farmers
  const locations = useMemo(() => {
    const locs: Record<string, { lat: number, lng: number, count: number }> = {};
    farmers.forEach(f => {
      const state = f.state || 'Unknown';
      if (state !== 'Unknown' && f.latitude && f.longitude) {
        if (!locs[state]) {
          locs[state] = { lat: f.latitude, lng: f.longitude, count: 0 };
        }
        locs[state].count++;
      }
    });
    return Object.entries(locs)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [farmers]);

  // Default to Abuja if no farmers have valid lat/lng
  const defaultLocation = { name: 'Abuja', lat: 9.0765, lng: 7.3986 };
  const [selectedLocation, setSelectedLocation] = useState(
    locations.length > 0 ? locations[0] : defaultLocation
  );

  useEffect(() => {
    if (locations.length > 0 && !locations.find(l => l.name === selectedLocation.name)) {
      setSelectedLocation(locations[0]);
    }
  }, [locations, selectedLocation]);

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`);
        if (!res.ok) throw new Error('Failed to fetch weather data');
        const data = await res.json();
        setWeatherData(data.daily);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [selectedLocation.lat, selectedLocation.lng]);

  const getWeatherIcon = (code: number, size = 24) => {
    if (code <= 3) return <Sun size={size} className="text-yellow-400" />;
    if (code <= 48) return <Cloud size={size} className="text-slate-400" />;
    if (code <= 67) return <CloudRain size={size} className="text-blue-400" />;
    if (code <= 77) return <CloudRain size={size} className="text-slate-200" />;
    if (code <= 82) return <CloudRain size={size} className="text-blue-500" />;
    if (code <= 99) return <CloudLightning size={size} className="text-purple-400" />;
    return <Cloud size={size} className="text-slate-400" />;
  };

  const getWeatherDesc = (code: number) => {
    if (code === 0) return 'Clear sky';
    if (code <= 3) return 'Partly cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 55) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Heavy rain showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  // Check for severe weather (heavy rain, strong wind, thunderstorm)
  const isSevere = (code: number, wind: number) => {
    return code >= 80 || wind > 40; // Wind > 40km/h or heavy rain/storm
  };

  return (
    <div className={`col-span-1 lg:col-span-2 bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <CloudRain className="text-blue-400" /> Weather & Storm Alerts
          </h3>
          <p className="text-xs text-slate-400 mt-1">7-day forecast for active farmer regions</p>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-slate-400" />
          <select 
            value={selectedLocation.name} 
            onChange={(e) => {
              const loc = locations.find(l => l.name === e.target.value);
              if (loc) setSelectedLocation(loc);
            }}
            className="bg-black/20 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors [&>option]:bg-slate-800"
          >
            {locations.length > 0 ? (
              locations.map(loc => (
                <option key={loc.name} value={loc.name}>{loc.name} ({loc.count} farmers)</option>
              ))
            ) : (
              <option value={defaultLocation.name}>{defaultLocation.name} (Default)</option>
            )}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center min-h-[200px] text-red-400 text-sm">
          {error}
        </div>
      ) : weatherData ? (
        <div className="flex flex-col gap-6">
          {/* Current / Today Alert Banner */}
          {isSevere(weatherData.weathercode[0], weatherData.windspeed_10m_max[0]) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-4">
              <div className="bg-amber-500/20 text-amber-400 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-amber-400">Severe Weather Alert</h4>
                <p className="text-sm text-slate-300 mt-1">
                  {getWeatherDesc(weatherData.weathercode[0])} expected today with winds up to {weatherData.windspeed_10m_max[0]} km/h. Advise farmers in {selectedLocation.name} to secure equipment.
                </p>
              </div>
            </div>
          )}

          {/* Forecast Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {weatherData.time.map((time, index) => {
              const date = new Date(time);
              const isToday = index === 0;
              const severe = isSevere(weatherData.weathercode[index], weatherData.windspeed_10m_max[index]);
              
              return (
                <div 
                  key={index} 
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-colors ${
                    isToday ? 'bg-blue-500/10 border-blue-500/30' : 'bg-black/20 border-white/5'
                  } ${severe ? 'border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : ''}`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                    {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  
                  <div className="mb-2 relative">
                    {getWeatherIcon(weatherData.weathercode[index], 32)}
                    {severe && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                    )}
                  </div>
                  
                  <span className="text-xs font-semibold text-slate-200 text-center leading-tight mb-2 h-6 flex items-center">
                    {getWeatherDesc(weatherData.weathercode[index])}
                  </span>
                  
                  <div className="flex gap-2 text-[11px] font-bold">
                    <span className="text-slate-200">{Math.round(weatherData.temperature_2m_max[index])}°</span>
                    <span className="text-slate-500">{Math.round(weatherData.temperature_2m_min[index])}°</span>
                  </div>
                  
                  <div className="w-full flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1" title="Precipitation">
                      <Droplets size={10} className="text-blue-400" />
                      {weatherData.precipitation_sum[index]}mm
                    </div>
                    <div className="flex items-center gap-1" title="Max Wind Speed">
                      <Wind size={10} />
                      {Math.round(weatherData.windspeed_10m_max[index])}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
