import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarmerStore } from '../store/useFarmerStore';
import { useSettingsStore, THEMES } from '../store/useSettingsStore';
import { MapContainer, TileLayer, Marker, Popup, WMSTileLayer } from 'react-leaflet';
import { Filter, Layers, Trash2, Map as MapIcon, Globe, Mountain, Compass, Upload, X, Bot, Sparkles } from 'lucide-react';
import { GeoJSON } from 'react-leaflet';

import { useMap, Polygon } from 'react-leaflet';
import { BASEMAP_PROVIDERS, BasemapConfig } from '../lib/leafletConfig';

function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function getFarmPolygon(lat: number, lng: number, farmSizeHa: number) {
  const sideMeters = 100 * Math.sqrt(farmSizeHa || 1);
  const sideDegrees = (sideMeters / 111320) * 15;
  const halfSide = sideDegrees / 2;
  
  return [
    [lat - halfSide, lng - halfSide],
    [lat + halfSide, lng - halfSide],
    [lat + halfSide, lng + halfSide],
    [lat - halfSide, lng + halfSide]
  ];
}

import MapLayerUploader from '../components/MapLayerUploader';
import { HeatmapLayer } from '../components/HeatmapLayer';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


const FarmerMarker: React.FC<{ farmer: any }> = ({ farmer }) => {
  const lat = parseFloat(farmer.latitude) || 0;
  const lng = parseFloat(farmer.longitude) || 0;
  if (!lat || !lng) return null;

  const farmSize = farmer.farmSize || 1;
  const polygonCoords = getFarmPolygon(lat, lng, farmSize);
  
  const hash = (farmer.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const ndvi = 0.4 + ((hash % 60) / 100);
  
  let ndviColor = '#ef4444';
  if (ndvi > 0.8) ndviColor = '#10b981';
  else if (ndvi > 0.6) ndviColor = '#f59e0b';

  return (
    <Polygon positions={polygonCoords as any} pathOptions={{ color: ndviColor, fillColor: ndviColor, fillOpacity: 0.6, weight: 2 }}>
      <Popup>
        <div className="p-2 text-slate-800 min-w-[200px]">
          <h3 className="font-bold text-lg mb-1">{farmer.firstName} {farmer.lastName}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-2">
            <div className="font-semibold text-slate-500">Location:</div>
            <div>{farmer.state}, {farmer.lga}</div>
            
            <div className="font-semibold text-slate-500">Crop:</div>
            <div>{farmer.crop || 'N/A'}</div>
            
            <div className="font-semibold text-slate-500">Farm Size:</div>
            <div>{farmSize} Hectares</div>
            
            <div className="font-semibold text-slate-500">NDVI:</div>
            <div>
              <span className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: ndviColor }}>
                {ndvi.toFixed(2)}
              </span>
            </div>
            
            <div className="font-semibold text-slate-500">Status:</div>
            <div>{farmer.profileStatus || 'Active'}</div>
          </div>
        </div>
      </Popup>
    </Polygon>
  );
}


export default function DistributionMap() {
  const farmers = useFarmerStore(state => state.farmers);
  const isLoading = useFarmerStore(state => state.isLoading);
  const settings = useSettingsStore();
  const theme = settings.theme || THEMES.frosted;

  const [selectedCrop, setSelectedCrop] = useState<string>('All');
  const [selectedFarmingType, setSelectedFarmingType] = useState<string>('All');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [selectedBasemap, setSelectedBasemap] = useState<string>('dark');
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showNdvi, setShowNdvi] = useState<boolean>(false);
  const [showLayerUploader, setShowLayerUploader] = useState<boolean>(false);
  const [customLayers, setCustomLayers] = useState<any[]>([]);

  const uniqueCrops = useMemo(() => {
    const crops = new Set<string>();
    farmers.forEach(f => { if (f.crop) crops.add(f.crop); });
    return Array.from(crops).sort();
  }, [farmers]);

  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    farmers.forEach(f => { if (f.state) states.add(f.state); });
    return Array.from(states).sort();
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    return farmers.filter(f => {
      const matchCrop = selectedCrop === 'All' || f.crop === selectedCrop;
      const matchFarmingType = selectedFarmingType === 'All' || f.farmingType === selectedFarmingType || (!f.farmingType && selectedFarmingType === 'Conventional'); // assume conventional if not specified
      const matchState = selectedState === 'All' || f.state === selectedState;
      return matchCrop && matchFarmingType && matchState;
    });
  }, [farmers, selectedCrop, selectedFarmingType, selectedState]);


  // Calculate center based on farmers with coordinates, fallback to Nigeria center

  const heatmapPoints = useMemo(() => {
    const baseYields: Record<string, number> = {
      'Maize': 2.5, 'Rice': 3.5, 'Cassava': 12.0, 'Cocoa': 0.6,
      'Wheat': 3.0, 'Soybean': 1.5, 'Sorghum': 1.2
    };
    return filteredFarmers
      .filter(f => parseFloat(f.latitude as any) && parseFloat(f.longitude as any))
      .map(f => {
        // Use historical harvest data if available, else fallback to projected yield based on farmSize
        let yieldMT = 0;
        if ((f as any).historicalHarvests && (f as any).historicalHarvests.length > 0) {
          const harvests = (f as any).historicalHarvests;
          yieldMT = harvests[harvests.length - 1].yieldMT; // Latest harvest
        } else {
          const baseYield = f.crop ? (baseYields[f.crop] || 2.0) : 2.0;
          const expMultiplier = 1 + ((f.experience || 0) * 0.02);
          yieldMT = baseYield * (f.farmSize || 1) * expMultiplier;
        }
        // Leaflet heat intensity is normally 0-1, but we can pass raw values and let max handle it if we set max option, 
        // or just pass a scaled value. We will normalize yield for intensity.
        return [parseFloat(f.latitude as any), parseFloat(f.longitude as any), yieldMT] as [number, number, number];
      });
  }, [filteredFarmers]);

  // Find max yield to scale the heatmap properly
  const maxYield = heatmapPoints.length > 0 ? Math.max(...heatmapPoints.map(p => p[2])) : 1;

  
  const zoomLevel = useMemo(() => {
    if (selectedState !== 'All') return 8;
    return 6;
  }, [selectedState]);

  const center: [number, number] = useMemo(() => {
    if (selectedState !== 'All') {
      const stateFarmers = filteredFarmers;
      if (stateFarmers.length > 0) {
        const avgLat = stateFarmers.reduce((sum, f) => sum + parseFloat(f.latitude as any), 0) / stateFarmers.length;
        const avgLng = stateFarmers.reduce((sum, f) => sum + parseFloat(f.longitude as any), 0) / stateFarmers.length;
        return [avgLat, avgLng];
      }
    }
    const withCoords = filteredFarmers.filter(f => parseFloat(f.latitude as any) && parseFloat(f.longitude as any));
    if (withCoords.length === 0) return [9.0820, 8.6753];
    
    const avgLat = withCoords.reduce((sum, f) => sum + parseFloat(f.latitude as any), 0) / withCoords.length;
    const avgLng = withCoords.reduce((sum, f) => sum + parseFloat(f.longitude as any), 0) / withCoords.length;
    
    return [avgLat, avgLng];
  }, [farmers, selectedState, filteredFarmers]);


  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-120px)] flex flex-col">

      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Farmer Distribution Map</h2>
          <p className="text-slate-400 mt-1">GIS visualization of registered farmers across Nigeria.</p>
        </div>
      </div>

      <div className={`p-4 rounded-2xl border ${theme.borderClass} ${theme.bgClass} flex flex-wrap gap-4 items-center`}>
        <div className="flex items-center gap-2 text-slate-300 mr-2">
          <Filter size={18} />
          <span className="text-sm font-semibold uppercase tracking-widest">Filters:</span>
        </div>
        
        <select 
          value={selectedCrop}
          onChange={(e) => setSelectedCrop(e.target.value)}
          className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="All">All Crops</option>
          {uniqueCrops.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select 
          value={selectedFarmingType}
          onChange={(e) => setSelectedFarmingType(e.target.value)}
          className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="All">All Farming Types</option>
          <option value="Conventional">Conventional</option>
          <option value="Organic">Organic</option>
        </select>

        <select 
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="All">All States</option>
          {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        
        <div className="flex items-center gap-1 border border-white/10 bg-black/20 rounded-xl p-1">
          <button 
            onClick={() => setShowMarkers(!showMarkers)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showMarkers ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-white/5'}`}
          >
            Farmers
          </button>
          <button 
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${showHeatmap ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:bg-white/5'}`}
          >
            <Layers size={14} /> Yield Heatmap
          </button>
          <button 
            onClick={() => setShowNdvi(!showNdvi)}
            title="NASA Earth Observations MODIS NDVI Vegetation Layer"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${showNdvi ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-white/5'}`}
          >
            <Globe size={14} /> NASA NDVI
          </button>
        </div>

        {/* Basemap Switcher */}
        <div className="flex items-center gap-1 border border-white/10 bg-black/20 rounded-xl p-1">
          <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
            <MapIcon size={12} /> Basemap:
          </span>
          {Object.values(BASEMAP_PROVIDERS).map((bm) => (
            <button
              key={bm.id}
              onClick={() => setSelectedBasemap(bm.id)}
              title={bm.description}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                selectedBasemap === bm.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {bm.name}
            </button>
          ))}
        </div>

        {/* Upload Custom GIS Layer Button */}
        <button
          onClick={() => setShowLayerUploader(!showLayerUploader)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors ${
            showLayerUploader ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-black/20 text-slate-300 hover:bg-white/5'
          }`}
        >
          <Upload size={14} /> GIS Layer {customLayers.length > 0 ? `(${customLayers.length})` : ''}
        </button>

        {/* Silos & Agricultural Suppliers Grounding Shortcut */}
        <Link
          to="/advisor"
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Bot size={14} className="text-emerald-400" />
          <span>Locate Silos & Suppliers (Maps Grounded)</span>
        </Link>
        
        <div className="ml-auto text-xs text-slate-400">
          Showing {filteredFarmers.length} of {farmers.length} farmers
        </div>
      </div>

      {/* Layer Uploader Dropdown / Panel */}
      {showLayerUploader && (
        <div className={`p-4 rounded-2xl border ${theme.borderClass} ${theme.bgClass} flex flex-col md:flex-row gap-4 items-start md:items-center justify-between animate-fadeIn`}>
          <div className="flex-1 max-w-md">
            <div className="text-sm font-semibold text-slate-200 mb-1">Import GIS Boundaries & Shapefiles</div>
            <p className="text-xs text-slate-400 mb-2">Upload GeoJSON, KML, or zipped ESRI Shapefiles to overlay on the basemap.</p>
            <MapLayerUploader onLayerAdded={(layer) => {
              setCustomLayers(prev => [...prev, layer]);
              setShowLayerUploader(false);
            }} />
          </div>
          {customLayers.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-400">Active Layers:</span>
              {customLayers.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300">
                  {l.name}
                  <button onClick={() => setCustomLayers(prev => prev.filter(item => item.id !== l.id))} className="text-slate-400 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`flex-1 rounded-3xl overflow-hidden ${theme.bgClass} border border-white/10 shadow-2xl relative`}>
        {isLoading ? (
          <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center z-10 animate-pulse">
             <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
             <div className="text-blue-400 font-semibold tracking-widest text-sm uppercase">Loading GIS Data...</div>
          </div>
        ) : null}

        {/* Floating Map Legend */}
        <div className="absolute bottom-6 left-6 z-[400] bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-xl text-xs space-y-2 pointer-events-auto">
          <div className="font-semibold text-slate-200 flex items-center justify-between gap-4">
            <span>NDVI Vegetation Health</span>
            <span className="text-[10px] text-slate-400 uppercase">{BASEMAP_PROVIDERS[selectedBasemap]?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
              <span className="text-slate-300">&gt; 0.8 (Healthy)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-sm"></span>
              <span className="text-slate-300">0.6 - 0.8</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-sm"></span>
              <span className="text-slate-300">&lt; 0.6 (Stressed)</span>
            </div>
          </div>
        </div>

        <MapContainer
          center={center}
          zoom={6}
          style={{ width: '100%', height: '100%', zIndex: 0 }}
        >
          <MapUpdater center={center} zoom={zoomLevel} />
          <TileLayer
            key={selectedBasemap}
            attribution={BASEMAP_PROVIDERS[selectedBasemap]?.attribution || BASEMAP_PROVIDERS.dark.attribution}
            url={BASEMAP_PROVIDERS[selectedBasemap]?.url || BASEMAP_PROVIDERS.dark.url}
            subdomains={BASEMAP_PROVIDERS[selectedBasemap]?.subdomains}
            maxZoom={BASEMAP_PROVIDERS[selectedBasemap]?.maxZoom || 19}
          />
          {customLayers.map(layer => (
            <GeoJSON key={layer.id} data={layer.data} style={{ color: '#3b82f6', weight: 2, fillOpacity: 0.2 }} onEachFeature={(feature, layer) => {
              if (feature.properties) {
                layer.bindPopup(Object.keys(feature.properties).map(k => `<strong>${k}:</strong> ${feature.properties[k]}`).join('<br>'));
              }
            }} />
          ))}
          {showNdvi && (
             <WMSTileLayer
                url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
                layers="MODIS_Terra_NDVI_16Day"
                format="image/png"
                transparent={true}
                opacity={0.6}
                attribution="NASA EOSDIS GIBS"
             />
          )}
          {showHeatmap && <HeatmapLayer points={heatmapPoints} options={{ max: maxYield }} />}
          {showMarkers && filteredFarmers.map(farmer => (
            <FarmerMarker key={farmer.id} farmer={farmer} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
