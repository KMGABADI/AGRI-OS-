import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Pencil, Users, MapPin } from "lucide-react";
import { api, useWorkspace } from "../lib/workspace";
import { PageHeading, Badge, RecordForm, Empty } from "../components/ui";
import { entityFields, canEdit, type Entity, type Row } from "../model";
import HistoryPanel from "../components/operations/HistoryPanel";
import BulkBeneficiaries from "../components/operations/BulkBeneficiaries";
export default function RecordDetail() {
  const { entity: kind, id } = useParams();
  const entity = kind as Entity;
  const { snapshot, session, save, refresh, notify } = useWorkspace();
  const [row, setRow] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [edit, setEdit] = useState(false),
    [cohort, setCohort] = useState(false);
  useEffect(() => {
    if (kind === "states") {
      setRow({ id: id!, name: id });
      return;
    }
    api("/api/operations/record/" + kind + "/" + id)
      .then(setRow)
      .catch((e) => setError(e.message));
  }, [kind, id, snapshot]);
  if (error) return <Empty title="Record unavailable" description={error} />;
  if (!row)
    return <div className="loading-block">Loading connected record…</div>;
  const linked = [
    ["organizationId", "organizations"],
    ["programId", "programs"],
    ["seasonId", "seasons"],
    ["interventionId", "interventions"],
    ["warehouseId", "warehouses"],
    ["farmerId", "farmers"],
  ] as const;
  const writable =
    kind !== "states" &&
    entityFields[entity] &&
    canEdit(session.role, entity) &&
    !["farmLocations", "payments", "participations"].includes(kind || "") &&
    !(entity === "fieldValidations" && row.status === "Verified") &&
    !(
      entity === "harvestTasks" &&
      !["Super Admin", "Admin", "Manager"].includes(session.role) &&
      !session.plannerApproved
    ) &&
    !(entity === "interventions" && row.farmerId);
  return (
    <>
      <PageHeading
        title={row.name || row.reference || row.farmerID || kind!}
        eyebrow="CONNECTED RECORD"
        description="Open linked records, participation, farm evidence and historical changes from one place."
        actions={
          <>
            {kind === "interventions" &&
              !row.farmerId &&
              ["Super Admin", "Admin", "Manager"].includes(session.role) && (
                <button
                  className="button primary"
                  onClick={() => setCohort(true)}
                >
                  <Users size={16} />
                  Bulk beneficiaries
                </button>
              )}
            {writable && (
              <button className="button" onClick={() => setEdit(true)}>
                <Pencil size={16} />
                Edit record
              </button>
            )}
          </>
        }
      />
      <section className="panel detail-panel">
        <div className="record-links">
          {linked
            .filter(([key]) => row[key])
            .map(([key, target]) => (
              <Link
                className="button"
                key={key}
                to={
                  target === "farmers"
                    ? "/farmers/" + row[key]
                    : "/records/" + target + "/" + row[key]
                }
              >
                {target}:{" "}
                {snapshot.data[target]?.find((r) => r.id === row[key])?.name ||
                  row[key].slice(0, 12)}{" "}
                →
              </Link>
            ))}
          {kind === "programs" && (
            <>
              <Link
                className="button primary"
                to={"/seasons?programId=" + row.id}
              >
                Seasons →
              </Link>
              <Link
                className="button"
                to={"/interventions?programId=" + row.id}
              >
                Interventions →
              </Link>
            </>
          )}
          {kind === "seasons" && (
            <>
              <Link
                className="button primary"
                to={"/calendar?seasonId=" + row.id}
              >
                Open season planner →
              </Link>
              <Link className="button" to={"/map?seasonId=" + row.id}>
                Farm intelligence →
              </Link>
              <Link className="button" to={"/interventions?seasonId=" + row.id}>
                Season interventions →
              </Link>
            </>
          )}
          {row.farmerId && (
            <Link
              className="button"
              to={
                "/map?farmerId=" +
                row.farmerId +
                "&seasonId=" +
                (row.seasonId || "")
              }
            >
              Farm location history →
            </Link>
          )}
        </div>
        <dl className="history-values">
          {Object.entries(row)
            .filter(
              ([k, v]) =>
                typeof v !== "object" &&
                ![
                  "id",
                  "photo",
                  "bvn",
                  "nin",
                  "accountNumber",
                  "sourceDob",
                ].includes(k),
            )
            .map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </React.Fragment>
            ))}
        </dl>
        {row.warehouseIds?.length > 0 && (
          <div className="record-links">
            {row.warehouseIds.map((wid: string) => (
              <Link
                key={wid}
                className="button"
                to={"/records/warehouses/" + wid}
              >
                Warehouse:{" "}
                {snapshot.data.warehouses.find((w) => w.id === wid)?.name ||
                  wid}
              </Link>
            ))}
          </div>
        )}
      </section>
      {kind === "interventions" &&
        !row.farmerId &&
        ["Super Admin", "Admin", "Manager"].includes(session.role) && (
          <section className="panel detail-panel section-spacing">
            <h3>Record cohort delivery</h3>
            <p>
              Update beneficiary outcome history for this intervention in
              batches. Earlier statuses remain in the change history.
            </p>
            <div className="heading-actions">
              {["In Progress", "Delivered", "Withdrawn"].map((status) => (
                <button
                  key={status}
                  className="button"
                  onClick={async () => {
                    try {
                      let remaining = 1,
                        total = 0;
                      while (remaining) {
                        const r = await api(
                          "/api/operations/participations/status",
                          {
                            method: "POST",
                            body: JSON.stringify({
                              interventionId: row.id,
                              status,
                            }),
                          },
                        );
                        total += r.updated;
                        remaining = r.remaining;
                        if (!r.updated && remaining)
                          throw new Error(
                            "Remaining beneficiaries are outside your scope",
                          );
                      }
                      await refresh();
                      notify(`${total} outcomes recorded: ${status}`);
                    } catch (e: any) {
                      notify(e.message, true);
                    }
                  }}
                >
                  Mark cohort {status.toLowerCase()}
                </button>
              ))}
            </div>
          </section>
        )}
      <HistoryPanel entity={kind as any} id={id!} />
      {edit && (
        <RecordForm
          entity={entity}
          fields={entityFields[entity] || []}
          initial={row}
          title="Edit connected record"
          onSave={(r) =>
            save(entity, {
              ...r,
              expectedUpdatedAt: row.updatedAt || row.createdAt || "",
            })
          }
          onClose={() => setEdit(false)}
        />
      )}
      {cohort && (
        <BulkBeneficiaries
          intervention={row}
          onClose={() => setCohort(false)}
        />
      )}
    </>
  );
}
