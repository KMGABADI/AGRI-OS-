import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export const HeatmapLayer = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const layer = (L as any).heatLayer(points, { radius: 25, blur: 15 }).addTo(map);
    return () => map.removeLayer(layer);
  }, [map, points]);
  return null;
}
