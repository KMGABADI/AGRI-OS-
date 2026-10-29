import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Users, Pencil, MapPin } from "lucide-react";
import { api, useWorkspace } from "../lib/workspace";
import { PageHeading, RecordForm, DataTable, Badge } from "../components/ui";
import { entityFields, canEdit, type Entity, type Row } from "../model";
import BulkBeneficiaries from "../components/operations/BulkBeneficiaries";
import StagedFilters from "../components/operations/StagedFilters";
const titles = {
  seasons: ["Seasons", "Season planning and linked storage across programmes."],
  interventions: [
    "Interventions",
    "Interventions sit under programmes and seasons. Assign beneficiaries using reviewed bulk cohorts.",
  ],
  fieldValidations: [
    "Field validation",
    "Capture field evidence on the online platform or mobile device; managers approve verified cohorts.",
  ],
  farmLocations: [
    "Farm location observations",
    "Record points, polygons and addresses for every season/intervention without replacing earlier observations.",
  ],
};
export default function Operations({
  entity,
}: {
  entity: "seasons" | "interventions" | "fieldValidations" | "farmLocations";
}) {
  const { session, snapshot, save } = useWorkspace();
  const [params] = useSearchParams();
  const [edit, setEdit] = useState<Partial<Row> | null>(null),
    [cohort, setCohort] = useState<Row | null>(null),
    [filters, setFilters] = useState<Record<string, any>>({
      programId: params.get("programId") || "",
      seasonId: params.get("seasonId") || "",
    }),
    [rows, setRows] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    const q = new URLSearchParams({ ...filters, offset: String(offset) });
    api("/api/operations/records/" + entity + "?" + q)
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message));
  }, [entity, filters, offset, snapshot]);
  const writable = canEdit(session.role, entity);
  const label = (kind: Entity, id: string) =>
    snapshot.data[kind]?.find((r) => r.id === id)?.name ||
    id?.slice(0, 12) ||
    "—";
  return (
    <>
      <PageHeading
        title={titles[entity][0]}
        eyebrow="CONNECTED FIELD OPERATIONS"
        description={titles[entity][1]}
        actions={
          writable && (
            <button
              className="button primary"
              onClick={() =>
                setEdit({
                  ...filters,
                  ...(entity === "seasons"
                    ? { status: "Planned", year: new Date().getFullYear() }
                    : entity === "fieldValidations"
                      ? { status: "Pending" }
                      : { status: "Planned" }),
                })
              }
            >
              <Plus size={16} />
              Add{" "}
              {entity === "seasons"
                ? "season"
                : entity === "interventions"
                  ? "intervention"
                  : entity === "farmLocations"
                    ? "farm observation"
                    : "field validation"}
            </button>
          )
        }
      />
      <section className="panel detail-panel">
        <StagedFilters
          value={filters}
          onChange={(v) => {
            setFilters(v);
            setOffset(0);
          }}
        />
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <DataTable
          rows={rows}
          columns={[
            {
              key: "name",
              label: "Record",
              render: (r) => (
                <Link
                  className="text-link"
                  to={"/records/" + entity + "/" + r.id}
                >
                  {r.name || label("farmers", r.farmerId) || r.id}
                </Link>
              ),
            },
            {
              key: "programme",
              label: "Programme",
              render: (r) => (
                <Link
                  to={"/records/programs/" + r.programId}
                  className="text-link"
                >
                  {label("programs", r.programId)}
                </Link>
              ),
            },
            {
              key: "season",
              label: "Season",
              render: (r) =>
                r.seasonId ? (
                  <Link
                    to={"/records/seasons/" + r.seasonId}
                    className="text-link"
                  >
                    {label("seasons", r.seasonId)}
                  </Link>
                ) : (
                  String(r.year || "—")
                ),
            },
            {
              key: "state",
              label: "State",
              render: (r) =>
                r.state ? (
                  <Link to={"/records/states/" + encodeURIComponent(r.state)}>
                    {r.state}
                  </Link>
                ) : (
                  "Multiple / not specified"
                ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status || "Observed"}</Badge>,
            },
            {
              key: "actions",
              label: "Actions",
              render: (r) => (
                <div className="row-actions">
                  {entity === "interventions" &&
                    !r.farmerId &&
                    ["Super Admin", "Admin", "Manager"].includes(
                      session.role,
                    ) && (
                      <button
                        className="button small-button"
                        onClick={() => setCohort(r)}
                      >
                        <Users size={14} />
                        Bulk beneficiaries
                      </button>
                    )}
                  {writable &&
                    entity !== "farmLocations" &&
                    !(
                      entity === "fieldValidations" && r.status === "Verified"
                    ) && (
                      <button
                        className="icon-button"
                        aria-label={"Edit " + (r.name || "record")}
                        onClick={() => setEdit(r)}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  <Link
                    className="button small-button"
                    to={"/records/" + entity + "/" + r.id}
                  >
                    History →
                  </Link>
                </div>
              ),
            },
          ]}
          pageSize={25}
        />
        <div className="table-footer">
          <span>{total.toLocaleString()} records</span>
          <div>
            <button
              className="button small-button"
              disabled={!offset}
              onClick={() => setOffset((o) => Math.max(0, o - 25))}
            >
              Previous
            </button>
            <button
              className="button small-button"
              disabled={offset + 25 >= total}
              onClick={() => setOffset((o) => o + 25)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {edit && (
        <RecordForm
          entity={entity}
          fields={entityFields[entity] || []}
          initial={edit}
          title={
            edit.id ? "Edit " + titles[entity][0] : "Add " + titles[entity][0]
          }
          onSave={(r) =>
            save(entity, {
              ...r,
              expectedUpdatedAt: edit.updatedAt || edit.createdAt || "",
            })
          }
          onClose={() => setEdit(null)}
        />
      )}
      {cohort && (
        <BulkBeneficiaries
          intervention={cohort}
          onClose={() => setCohort(null)}
        />
      )}
    </>
  );
}
