import React, { useMemo, useState } from 'react';
import { useWarehouseStore } from '../store/useWarehouseStore';
import { useSettingsStore, THEMES } from '../store/useSettingsStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { BASEMAP_PROVIDERS } from '../lib/leafletConfig';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Building, Package, MapPin, Search } from 'lucide-react';
import { Warehouse } from '../types';

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const WarehouseMarker: React.FC<{ warehouse: Warehouse }> = ({ warehouse }) => {
  const lat = warehouse.latitude;
  const lng = warehouse.longitude;

  if (!lat || !lng) return null;

  return (
    <Marker position={[lat, lng]}>
      <Popup>
        <div className="p-2 text-slate-800 min-w-[200px]">
          <h3 className="font-bold text-base flex items-center gap-2"><Building size={16}/> {warehouse.name}</h3>
          <p className="text-sm mt-2 font-semibold text-blue-600">{warehouse.commodity}</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>Inventory: <b>{warehouse.currentInventory.toLocaleString()}</b> MT</p>
            <p>Capacity: {warehouse.capacity.toLocaleString()} MT</p>
          </div>
          <span className={`inline-block mt-3 px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${warehouse.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {warehouse.status}
          </span>
        </div>
      </Popup>
    </Marker>
  );
}

export default function FoodBank() {
  const { warehouses } = useWarehouseStore();
  const settings = useSettingsStore();
  const theme = settings.theme || THEMES.frosted;
  const { primaryColor } = useBrandingStore();
  
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.commodity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const center: [number, number] = useMemo(() => {
    if (filteredWarehouses.length === 0) return [9.0820, 8.6753];
    const avgLat = filteredWarehouses.reduce((sum, w) => sum + w.latitude, 0) / filteredWarehouses.length;
    const avgLng = filteredWarehouses.reduce((sum, w) => sum + w.longitude, 0) / filteredWarehouses.length;
    return [avgLat, avgLng];
  }, [filteredWarehouses]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Food Bank & Warehouses</h2>
          <p className="text-slate-400 mt-1">Manage commodity storage, capacity, and distribution nodes.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Sidebar List */}
        <div className={`col-span-1 flex flex-col ${theme.bgClass} backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden`}>
          <div className="p-4 border-b border-white/10 bg-white/5">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Search warehouses..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-100 outline-none focus:ring-1 focus:border-white/30"
                />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredWarehouses.map(w => {
              const capacityPercent = (w.currentInventory / w.capacity) * 100;
              return (
                <div key={w.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-100 flex items-center gap-2">
                        {w.name}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                        <Package size={14}/> {w.commodity}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${w.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                      {w.status}
                    </span>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                      <span>{w.currentInventory.toLocaleString()} MT</span>
                      <span>{w.capacity.toLocaleString()} MT</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min(capacityPercent, 100)}%`, backgroundColor: primaryColor }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredWarehouses.length === 0 && (
              <div className="text-center text-slate-500 py-8">No warehouses match your search.</div>
            )}
          </div>
        </div>

        {/* Map View */}
        <div className={`col-span-2 rounded-3xl overflow-hidden ${theme.bgClass} border border-white/10 shadow-2xl relative flex flex-col`}>
          <MapContainer
            center={center}
            zoom={6}
            style={{ width: '100%', height: '100%', zIndex: 0 }}
          >
            <TileLayer
              attribution={BASEMAP_PROVIDERS.dark.attribution}
              url={BASEMAP_PROVIDERS.dark.url}
              subdomains={BASEMAP_PROVIDERS.dark.subdomains}
              maxZoom={BASEMAP_PROVIDERS.dark.maxZoom}
            />
            {filteredWarehouses.map(w => (
              <WarehouseMarker key={w.id} warehouse={w} />
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
