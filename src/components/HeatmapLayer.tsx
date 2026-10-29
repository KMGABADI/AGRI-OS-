import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export const HeatmapLayer = ({ points, options }: { points: [number, number, number][], options?: any }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const layer = (L as any).heatLayer(points, { 
      radius: 25, 
      blur: 15,
      maxZoom: 10,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      },
      ...options 
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, options]);
  return null;
}
