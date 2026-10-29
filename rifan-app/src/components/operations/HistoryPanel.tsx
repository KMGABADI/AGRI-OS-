import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, useWorkspace } from "../../lib/workspace";
import { Badge, DataTable, Empty } from "../ui";
import type { Entity, Row } from "../../model";
const labels: Record<string, string> = {
  participations: "Beneficiary participation",
  farmLocations: "Farm location observations",
  fieldValidations: "Field validations",
  harvestTasks: "Season activities",
  interventions: "Interventions",
  payments: "Membership payments",
  seasons: "Seasons",
  programs: "Programmes",
};
export default function HistoryPanel({
  entity,
  id,
}: {
  entity: Entity | "states";
  id: string;
}) {
  const { snapshot } = useWorkspace();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("participations");
  useEffect(() => {
    api("/api/history/" + entity + "/" + encodeURIComponent(id))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [entity, id, snapshot]);
  if (error)
    return (
      <p className="error-text" role="alert">
        {error}
      </p>
    );
  if (!data)
    return <div className="loading-block">Loading connected history…</div>;
  const link = (kind: string, target: any) =>
    target ? (
      <Link
        className="text-link"
        to={
          kind === "farmers"
            ? "/farmers/" + target
            : "/records/" + kind + "/" + target
        }
      >
        {(snapshot.data as any)[kind]?.find((r: Row) => r.id === target)
          ?.name ||
          data.linkedFarmers?.find((r: Row) => r.id === target)?.name ||
          String(target).slice(0, 14)}
      </Link>
    ) : (
      "—"
    );
  return (
    <section className="panel section-spacing">
      <div className="panel-heading">
        <div>
          <h3>Connected record history</h3>
          <p>{data.baselineNotice}</p>
        </div>
      </div>
      <div className="tabs history-tabs">
        {Object.keys(labels).map((key) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {labels[key]} ({data.related[key]?.length || 0})
          </button>
        ))}
        <button
          className={tab === "versions" ? "active" : ""}
          onClick={() => setTab("versions")}
        >
          Change history
        </button>
      </div>
      {tab === "versions" ? (
        <div className="history-timeline">
          {data.versions.length ? (
            data.versions.map((v: any) => (
              <details key={v.version}>
                <summary>
                  <Badge tone="neutral">{v.action}</Badge>{" "}
                  {new Date(v.recordedAt).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })}{" "}
                  · {v.actorName}
                </summary>
                <dl className="history-values">
                  {Object.entries(v.data)
                    .filter(
                      ([k, val]) =>
                        typeof val !== "object" &&
                        !["photo", "id", "sourceDob"].includes(k),
                    )
                    .map(([k, val]) => (
                      <React.Fragment key={k}>
                        <dt>{k}</dt>
                        <dd>{String(val)}</dd>
                      </React.Fragment>
                    ))}
                </dl>
              </details>
            ))
          ) : (
            <Empty
              title="No captured revisions yet"
              description="The baseline appears on the next confirmed update. Earlier unrecorded events are not invented."
            />
          )}
        </div>
      ) : (
        <DataTable
          rows={data.related[tab] || []}
          columns={[
            {
              key: "name",
              label: "Record",
              render: (r) => (
                <Link className="text-link" to={"/records/" + tab + "/" + r.id}>
                  {r.name || r.reference || r.type || r.id.slice(0, 12)}
                </Link>
              ),
            },
            {
              key: "date",
              label: "Recorded",
              render: (r) =>
                r.observedAt ||
                r.validationDate ||
                r.startDate ||
                r.enrolledAt?.slice(0, 10) ||
                r.date?.slice(0, 10) ||
                r.dateApplied ||
                "—",
            },
            {
              key: "farmer",
              label: "Farmer",
              render: (r) => link("farmers", r.farmerId),
            },
            {
              key: "program",
              label: "Programme",
              render: (r) => link("programs", r.programId),
            },
            {
              key: "season",
              label: "Season",
              render: (r) => link("seasons", r.seasonId),
            },
            {
              key: "state",
              label: "State",
              render: (r) =>
                r.state ? (
                  <Link
                    className="text-link"
                    to={"/records/states/" + encodeURIComponent(r.state)}
                  >
                    {r.state}
                  </Link>
                ) : (
                  "—"
                ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status || "Recorded"}</Badge>,
            },
          ]}
        />
      )}
      <p className="panel-footnote">
        Up to {data.limits.relatedPerCollection} records per collection and{" "}
        {data.limits.versions} revisions are displayed. Original evidence
        remains in the database.
      </p>
    </section>
  );
}
