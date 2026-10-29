import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  GeoJSON,
  LayersControl,
  WMSTileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPinned, Layers, Upload } from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import { PageHeading, Badge, SearchBox } from "../components/ui";
import { names, format } from "../model";
import { parseBoundary } from "../lib/geodata";
import IntelligencePanel from "../components/operations/IntelligencePanel";
import StagedFilters from "../components/operations/StagedFilters";
import HeatLayer from "../components/HeatLayer";
function FitRecordedPoints({ rows }: { rows: any[] }) {
  const map = useMap();
  useEffect(() => {
    const points = rows
      .filter(
        (f) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude),
      )
      .map((f) => [f.latitude, f.longitude] as [number, number]);
    map.invalidateSize();
    if (points.length)
      map.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
  }, [map, rows]);
  return null;
}
export default function MapPage() {
  const { snapshot, notify } = useWorkspace();
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [sites, setSites] = useState<any[]>([]);
  const [state, setState] = useState(""),
    [crop, setCrop] = useState(""),
    [view, setView] = useState("Points"),
    [layer, setLayer] = useState<any>(null),
    [weather, setWeather] = useState(false);
  const [remote, setRemote] = useState<any>({
      rows: snapshot.data.farmers,
      total: 0,
    }),
    [summary, setSummary] = useState(snapshot.summary);
  useEffect(() => {
    const params = new URLSearchParams({
      state,
      crop,
      located: "true",
      limit: "1000",
    });
    api("/api/farmers?" + params)
      .then(setRemote)
      .catch(() => {});
    api("/api/summary?" + new URLSearchParams({ state, crop }))
      .then(setSummary)
      .catch(() => {});
  }, [state, crop]);
  useEffect(() => {
    api(
      "/api/operations/records/farmLocations?" +
        new URLSearchParams({ ...filters, state, crop, limit: "1000" }),
    )
      .then((r) => setSites(r.rows))
      .catch((e) => notify(e.message, true));
  }, [JSON.stringify(filters), state, crop]);
  const farmers = [
    ...(filters.seasonId || filters.programId || filters.interventionId
      ? []
      : remote.rows),
    ...sites.map((s) => ({ ...s, farmSize: s.farmSize, site: true })),
  ].filter(
    (f: any) => (!state || state === f.state) && (!crop || crop === f.crop),
  );
  const valid = farmers.filter(
    (f: any) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude),
  );
  return (
    <>
      <PageHeading
        title="Farm intelligence"
        eyebrow="KNOW YOUR FIELDS"
        description="Explore recorded farm locations and boundaries. Missing coordinates stay missing."
      />
      <StagedFilters value={filters} onChange={setFilters} />
      <p className="muted">
        Current registry locations and up to 1,000 matching historical site
        observations. Select a season to view its recorded sites.
      </p>
      <div className="map-toolbar panel">
        <div className="inline-filters">
          <select
            aria-label="Map state"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">All states</option>
            {snapshot.summary.regions
              .map((r: any) => r.name)
              .sort()
              .map((s: string) => (
                <option key={s}>{s}</option>
              ))}
          </select>
          <select
            aria-label="Map crop"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
          >
            <option value="">All crops</option>
            {[...new Set(snapshot.data.farmers.map((f) => f.crop))]
              .filter(Boolean)
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
          <div className="segmented">
            {["Points", "Heatmap", "Boundaries"].map((v) => (
              <button
                key={v}
                className={v === view ? "active" : ""}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <label className="button">
          <Upload size={15} />
          Add map layer
          <input
            className="visually-hidden"
            type="file"
            accept=".geojson,.json,.kml,.gpx,.zip"
            onChange={async (e) => {
              if (e.target.files?.[0])
                try {
                  setLayer(await parseBoundary(e.target.files[0]));
                  notify("Map layer loaded for this session");
                } catch (err: any) {
                  notify(err.message, true);
                }
            }}
          />
        </label>
      </div>
      <div className="map-frame">
        <MapContainer
          center={[9.08, 8.67]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <FitRecordedPoints rows={farmers} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer name="OpenStreetMap" checked>
              <TileLayer
                attribution="© OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite imagery">
              <TileLayer
                attribution="Tiles © Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay name="NASA surface reflectance">
              <WMSTileLayer
                url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
                layers="MODIS_Terra_CorrectedReflectance_TrueColor"
                format="image/png"
                transparent
                attribution="NASA GIBS"
              />
            </LayersControl.Overlay>
          </LayersControl>
          {view === "Heatmap" ? (
            <HeatLayer
              points={valid.map((f: any) => [
                f.latitude,
                f.longitude,
                Math.max(0.1, Number(f.farmSize || 1)),
              ])}
            />
          ) : (
            valid.map((f: any) => (
              <CircleMarker
                key={f.id}
                center={[f.latitude, f.longitude]}
                radius={6}
                pathOptions={{
                  color: "#fff",
                  weight: 2,
                  fillColor: "#245532",
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <strong>
                    {f.site ? "Historical farm observation" : names(f)}
                  </strong>
                  <p>
                    {f.state}, {f.lga}
                    <br />
                    {f.crop} · {format(f.farmSize)} ha
                  </p>
                  <Link to={"/farmers/" + (f.farmerId || f.id)}>
                    Open member profile →
                  </Link>
                  {f.site && (
                    <>
                      <p>
                        {f.address} · {f.observedAt}
                      </p>
                      <Link to={"/records/farmLocations/" + f.id}>
                        Observation & linked season →
                      </Link>
                    </>
                  )}
                </Popup>
              </CircleMarker>
            ))
          )}
          {view === "Boundaries" &&
            farmers
              .filter((f: any) => f.farmBoundary)
              .map((f: any) => (
                <GeoJSON
                  key={f.id}
                  data={f.farmBoundary}
                  style={{ color: "#a38a35", fillOpacity: 0.2 }}
                />
              ))}
          {layer && (
            <GeoJSON
              key={JSON.stringify(layer).slice(0, 100)}
              data={layer}
              style={{ color: "#b6983d" }}
            />
          )}
        </MapContainer>
        <div className="map-note">
          <span className="status-dot" />
          {valid.length} of {remote.total} located farms shown ·{" "}
          {summary.totalFarmers - Number(summary.located || 0)} without recorded
          coordinates
        </div>
      </div>
      <IntelligencePanel filters={{ ...filters, state, crop }} />
      <div className="info-strip">
        <MapPinned size={18} />
        <span>
          Map tiles and satellite layers require access to their external
          providers. All location points use recorded coordinates.
        </span>
      </div>
    </>
  );
}
