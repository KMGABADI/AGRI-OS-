import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, useWorkspace } from "../../lib/workspace";
import { Badge, StatCard } from "../ui";
import { Wheat, ShieldCheck, MapPin } from "lucide-react";
import { format } from "../../model";
export default function IntelligencePanel({
  filters = {},
}: {
  filters?: Record<string, any>;
}) {
  const { snapshot } = useWorkspace();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v)
          .map(([k, v]) => [k, String(v)]),
      ),
    );
    api("/api/intelligence?" + q)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [JSON.stringify(filters), snapshot]);
  if (error)
    return (
      <p className="error-text" role="alert">
        {error}
      </p>
    );
  if (!data)
    return (
      <div className="loading-block">Analysing recorded field evidence…</div>
    );
  return (
    <>
      <div className="stats-grid three">
        <StatCard
          label="Historical harvest observations"
          value={data.forecast.observations}
          icon={Wheat}
        />
        <StatCard
          label="Recorded farm sites in view"
          value={format(data.coverage.sites)}
          icon={MapPin}
        />
        <StatCard
          label="Priorities requiring attention"
          value={data.signals.length}
          icon={ShieldCheck}
          tone="gold"
        />
      </div>
      <section className="panel detail-panel">
        <div className="panel-heading">
          <div>
            <h3>Yield outlook</h3>
            <p>{data.forecast.method}</p>
          </div>
          <Badge tone="neutral">Explainable estimate</Badge>
        </div>
        {data.forecast.medianKgPerHa !== null ? (
          <>
            <h2>{format(data.forecast.medianKgPerHa)} kg / ha</h2>
            <p>
              Observed range: {format(data.forecast.lowerKgPerHa)}–
              {format(data.forecast.upperKgPerHa)} kg / ha.{" "}
              {data.forecast.interval}.
            </p>
          </>
        ) : (
          <p>
            No numeric prediction is shown because the measured history is
            insufficient.
          </p>
        )}
        <p>{data.forecast.limitations}</p>
      </section>
      <div className="alert-list section-spacing">
        {data.signals.map((signal: any) => (
          <article className="panel alert-card" key={signal.id}>
            <Badge>{signal.priority}</Badge>
            <div>
              <h3>
                {signal.title} · {signal.count.toLocaleString()}
              </h3>
              <p>{signal.recommendation}</p>
              <small>Evidence: {signal.source}</small>
            </div>
          </article>
        ))}
      </div>
      {!data.signals.length && (
        <div className="info-strip">
          No rule-based priorities detected in the available records. This does
          not establish that fields are risk-free.
        </div>
      )}
      <p className="small-text muted section-spacing">
        {data.disclaimer} Farmer data window:{" "}
        {data.coverage.farmerWindow.toLocaleString()}; operational record
        windows are disclosed in each view.
      </p>
      <Link className="button section-spacing" to="/advisor">
        Discuss these findings with Farm advisor →
      </Link>
    </>
  );
}
