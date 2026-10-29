import React, { useState } from "react";
import { CloudSun, RefreshCw } from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import { STATE_COORDS } from "../lib/nigeriaData";
export default function WeatherOutlook() {
  const { notify } = useWorkspace();
  const [state, setState] = useState("Kebbi"),
    [data, setData] = useState<any>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel detail-panel section-spacing">
      <div className="connection-heading">
        <span className="stat-icon gold">
          <CloudSun size={25} />
        </span>
        <div>
          <h3>Seven-day field weather outlook</h3>
          <p>
            Forecast for a state reference location. This does not represent an
            unrecorded farm coordinate.
          </p>
        </div>
        <select
          aria-label="Weather forecast state"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setData(null);
          }}
        >
          {Object.keys(STATE_COORDS)
            .sort()
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
        <button
          className="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              const c = STATE_COORDS[state];
              setData(await api(`/api/weather?lat=${c.lat}&lng=${c.lng}`));
            } catch (e: any) {
              setError(e.message);
            } finally {
              setPending(false);
            }
          }}
        >
          <RefreshCw size={15} className={pending ? "spin" : ""} />
          {pending ? "Loading…" : "Load forecast"}
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          Forecast unavailable: {error}
        </p>
      )}
      {data?.daily && (
        <div className="weather-days">
          {data.daily.time.map((date: string, i: number) => (
            <div key={date}>
              <strong>
                {new Date(date + "T12:00:00Z").toLocaleDateString("en-NG", {
                  weekday: "short",
                  day: "numeric",
                  timeZone: "Africa/Lagos",
                })}
              </strong>
              <CloudSun size={23} />
              <b>{data.daily.temperature_2m_max[i]}°</b>
              <small>{data.daily.temperature_2m_min[i]}° low</small>
              <small>{data.daily.precipitation_sum[i]} mm rain</small>
              <small>{data.daily.wind_speed_10m_max[i]} km/h wind</small>
            </div>
          ))}
        </div>
      )}
      <p className="small-text muted">
        Source: Open-Meteo. Forecasts require internet access and are advisory.
      </p>
    </section>
  );
}
