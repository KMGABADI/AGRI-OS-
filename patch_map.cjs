const fs = require('fs');

let code = fs.readFileSync('src/pages/DistributionMap.tsx', 'utf8');

const mapUpdater = `
import { useMap, Polygon } from 'react-leaflet';

function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function getFarmPolygon(lat: number, lng: number, farmSizeHa: number) {
  // 1 degree is approx 111km. Make it slightly exaggerated for visibility.
  const sideMeters = 100 * Math.sqrt(farmSizeHa || 1);
  const sideDegrees = (sideMeters / 111320) * 15; // Exaggerated scale
  const halfSide = sideDegrees / 2;
  
  return [
    [lat - halfSide, lng - halfSide],
    [lat + halfSide, lng - halfSide],
    [lat + halfSide, lng + halfSide],
    [lat - halfSide, lng + halfSide]
  ];
}
`;

code = code.replace(
  "import { GeoJSON } from 'react-leaflet';",
  "import { GeoJSON } from 'react-leaflet';\n" + mapUpdater
);

const newMarker = `
const FarmerMarker: React.FC<{ farmer: any }> = ({ farmer }) => {
  // Parse coords
  const lat = parseFloat(farmer.latitude) || 0;
  const lng = parseFloat(farmer.longitude) || 0;
  if (!lat || !lng) return null;

  // Calculate Map Size for Display (Polygon)
  const farmSize = farmer.farmSize || 1;
  const polygonCoords = getFarmPolygon(lat, lng, farmSize);
  
  // Simulated NDVI assessment for the system (0.0 to 1.0)
  // We can use a deterministic random based on farmer ID or just random
  const hash = (farmer.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const ndvi = 0.4 + ((hash % 60) / 100); // ranges 0.4 to 0.99
  
  let ndviColor = '#ef4444'; // poor
  if (ndvi > 0.8) ndviColor = '#10b981'; // excellent
  else if (ndvi > 0.6) ndviColor = '#f59e0b'; // moderate

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
`;

code = code.replace(/const FarmerMarker: React\.FC<\{ farmer: any \}>[\s\S]*?return \([\s\S]*?<\/Marker>\s*\);\s*\}/, newMarker);

const centerLogic = `
  const zoomLevel = useMemo(() => {
    if (selectedState !== 'All') return 8; // Zoom in for state
    return 6; // National view
  }, [selectedState]);

  const center: [number, number] = useMemo(() => {
    if (selectedState !== 'All') {
      const stateFarmers = filteredFarmers;
      if (stateFarmers.length > 0) {
        const avgLat = stateFarmers.reduce((sum, f) => sum + parseFloat(f.latitude as any), 0) / stateFarmers.length;
        const avgLng = stateFarmers.reduce((sum, f) => sum + parseFloat(f.longitude as any), 0) / stateFarmers.length;
        return [avgLat, avgLng];
      }
      // If we don't have farmers but have STATE_COORDS we could use it, but filteredFarmers should handle it mostly.
      // Alternatively, we could import STATE_COORDS here. 
    }
    const withCoords = filteredFarmers.filter(f => parseFloat(f.latitude as any) && parseFloat(f.longitude as any));
    if (withCoords.length === 0) return [9.0820, 8.6753]; // Center of Nigeria
    
    const avgLat = withCoords.reduce((sum, f) => sum + parseFloat(f.latitude as any), 0) / withCoords.length;
    const avgLng = withCoords.reduce((sum, f) => sum + parseFloat(f.longitude as any), 0) / withCoords.length;
    
    return [avgLat, avgLng];
  }, [farmers, selectedState, filteredFarmers]);
`;

code = code.replace(/const center: \[number, number\] = useMemo\(\(\) => \{[\s\S]*?return \[avgLat, avgLng\];\s*\}, \[farmers\]\);/, centerLogic);

code = code.replace(
  "<TileLayer",
  "<MapUpdater center={center} zoom={zoomLevel} />\n          <TileLayer"
);

fs.writeFileSync('src/pages/DistributionMap.tsx', code);
