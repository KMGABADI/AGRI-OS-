import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
export default function HeatLayer({ points }: { points: number[][] }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.heatLayer(points as [number, number, number][], {
      radius: 22,
      blur: 20,
      maxZoom: 12,
      gradient: {
        0.2: "#bcc79a",
        0.5: "#9aab60",
        0.8: "#4f793e",
        1: "#194c2b",
      },
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}
