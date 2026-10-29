import React, { useRef, useState } from 'react';
import { Upload, X, Layers } from 'lucide-react';
import { kml } from '@tmcw/togeojson';
import shp from 'shpjs';

export default function MapLayerUploader({ onLayerAdded }: { onLayerAdded: (layer: any) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'zip') {
        // Assume shapefile zip
        const buffer = await file.arrayBuffer();
        const geojson = await shp(buffer);
        onLayerAdded({ id: Date.now().toString(), name: fileName, data: geojson, type: 'geojson' });
      } else if (extension === 'kml') {
        const text = await file.text();
        const dom = new DOMParser().parseFromString(text, 'text/xml');
        // @ts-ignore
        const geojson = kml(dom);
        onLayerAdded({ id: Date.now().toString(), name: fileName, data: geojson, type: 'geojson' });
      } else if (extension === 'geojson' || extension === 'json') {
        const text = await file.text();
        const geojson = JSON.parse(text);
        onLayerAdded({ id: Date.now().toString(), name: fileName, data: geojson, type: 'geojson' });
      } else {
        alert('Unsupported file type. Please upload a .zip (Shapefile), .kml, or .geojson file.');
      }
    } catch (err) {
      console.error(err);
      alert('Error parsing map layer: ' + (err as Error).message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input 
        type="file" 
        accept=".zip,.kml,.geojson,.json" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 border border-blue-500/30 w-full"
      >
        {isUploading ? <span className="animate-pulse">Parsing...</span> : <><Upload size={16} /> Upload GIS Layer</>}
      </button>
      <p className="text-[10px] text-slate-500 text-center">Supports .zip (Shapefile), .kml, .geojson</p>
    </div>
  );
}
