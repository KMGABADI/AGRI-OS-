import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  CalendarDays,
} from "lucide-react";
import { api, useWorkspace } from "../lib/workspace";
import { PageHeading, Badge, RecordForm, DataTable } from "../components/ui";
import { entityFields, type Row } from "../model";
import WeatherOutlook from "../components/WeatherOutlook";
const approved = (s: any) =>
  ["Super Admin", "Admin", "Manager"].includes(s.role) ||
  s.plannerApproved === true;
export default function Calendar() {
  const { snapshot, session, save } = useWorkspace();
  const [params] = useSearchParams();
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [view, setView] = useState("Calendar"),
    [season, setSeason] = useState(params.get("seasonId") || ""),
    [rows, setRows] = useState<Row[]>([]),
    [edit, setEdit] = useState<Partial<Row> | null>(null),
    [error, setError] = useState("");
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  useEffect(() => {
    api(
      "/api/operations/calendar?" +
        new URLSearchParams({ month: prefix, seasonId: season }),
    )
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [prefix, season, snapshot]);
  const seasonRecord = snapshot.data.seasons.find((s) => s.id === season),
    writable = approved(session);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const label = (kind: string, id: any) =>
    (snapshot.data as any)[kind]?.find((r: Row) => r.id === id)?.name ||
    id?.slice(0, 12) ||
    "—";
  return (
    <>
      <PageHeading
        title="Harvest planner"
        eyebrow="PLAN · EXECUTE · RECORD · LEARN"
        description="An editable season activity plan linked to programmes, farm observations and aggregation warehouses."
        actions={
          <>
            <a
              className="button"
              href={
                "/api/operations/calendar.ics?" +
                new URLSearchParams({ seasonId: season })
              }
            >
              <Download size={16} />
              Calendar (.ics)
            </a>
            {writable && (
              <button
                className="button primary"
                onClick={() =>
                  setEdit({
                    seasonId: season,
                    programId: seasonRecord?.programId || "",
                    status: "Planned",
                    startDate: prefix + "-01",
                    endDate: prefix + "-01",
                  })
                }
              >
                <Plus size={16} />
                Schedule activity
              </button>
            )}
          </>
        }
      />
      <section className="panel">
        <div className="calendar-toolbar">
          <div>
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <h2>
              {month.toLocaleDateString("en-NG", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="button small-button"
              onClick={() =>
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
            >
              Today
            </button>
          </div>
          <div className="inline-filters">
            <select
              aria-label="Planner season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            >
              <option value="">All seasons</option>
              {snapshot.data.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="segmented">
              {["Calendar", "Agenda"].map((v) => (
                <button
                  key={v}
                  className={view === v ? "active" : ""}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {view === "Calendar" ? (
          <div className="calendar-scroll">
            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="calendar-weekday">
                  {d}
                </div>
              ))}
              {Array.from({ length: month.getDay() }, (_, i) => (
                <div className="calendar-day blank" key={"b" + i} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = prefix + "-" + String(i + 1).padStart(2, "0"),
                  events = rows.filter(
                    (r) => r.startDate <= date && r.endDate >= date,
                  );
                return (
                  <div
                    className={
                      "calendar-day " +
                      (date === new Date().toISOString().slice(0, 10)
                        ? "today"
                        : "")
                    }
                    key={date}
                  >
                    <b>{i + 1}</b>
                    {events.slice(0, 3).map((r) => (
                      <button
                        className={
                          "planner-event " +
                          (r.stage === "Harvest" ? "harvest" : "planting")
                        }
                        key={r.id}
                        onClick={() =>
                          writable
                            ? setEdit(r)
                            : location.assign("/records/harvestTasks/" + r.id)
                        }
                        title={r.name + " · " + r.status}
                      >
                        {r.name}
                        <small>
                          {r.stage} · {r.status}
                        </small>
                      </button>
                    ))}
                    {events.length > 3 && (
                      <button
                        className="text-button"
                        onClick={() => setView("Agenda")}
                      >
                        +{events.length - 3} activities
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <DataTable
            rows={rows}
            columns={[
              {
                key: "name",
                label: "Activity",
                render: (r) => (
                  <Link
                    className="text-link"
                    to={"/records/harvestTasks/" + r.id}
                  >
                    {r.name}
                  </Link>
                ),
              },
              { key: "stage", label: "Stage" },
              { key: "startDate", label: "Start" },
              { key: "endDate", label: "End" },
              {
                key: "seasonId",
                label: "Season",
                render: (r) => (
                  <Link to={"/records/seasons/" + r.seasonId}>
                    {label("seasons", r.seasonId)}
                  </Link>
                ),
              },
              {
                key: "warehouseId",
                label: "Warehouse",
                render: (r) =>
                  r.warehouseId ? (
                    <Link to={"/records/warehouses/" + r.warehouseId}>
                      {label("warehouses", r.warehouseId)}
                    </Link>
                  ) : (
                    "Not assigned"
                  ),
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge>{r.status}</Badge>,
              },
              {
                key: "edit",
                label: "Manage",
                render: (r) =>
                  writable ? (
                    <button
                      className="button small-button"
                      onClick={() => setEdit(r)}
                    >
                      Edit activity
                    </button>
                  ) : (
                    <span>Read only</span>
                  ),
              },
            ]}
          />
        )}
        <div className="calendar-legend">
          <span>
            Click an activity to edit dates, stage, officer, status and
            warehouse.
          </span>
          <small>
            {writable
              ? "Approved planner access"
              : "Read-only; administrator planning approval is required."}
          </small>
        </div>
      </section>
      {seasonRecord && (
        <section className="panel detail-panel section-spacing">
          <h3>{seasonRecord.name}</h3>
          <p>
            {seasonRecord.startDate}–{seasonRecord.endDate} ·{" "}
            {seasonRecord.type} season
          </p>
          <div className="record-links">
            <Link className="button" to={"/records/seasons/" + seasonRecord.id}>
              Season history →
            </Link>
            <Link className="button" to={"/map?seasonId=" + seasonRecord.id}>
              Map this season →
            </Link>
            {seasonRecord.warehouseIds?.map((id: string) => (
              <Link
                className="button"
                key={id}
                to={"/records/warehouses/" + id}
              >
                Storage: {label("warehouses", id)}
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="info-strip">
        <CalendarDays size={18} />
        <span>
          Earlier planting/harvest dates remain in farmer profiles. Schedule new
          operational activities explicitly; historical dates are not
          overwritten or automatically assigned.
        </span>
        <Link to="/farmers">Farmer registry →</Link>
      </div>
      <WeatherOutlook />
      {edit && (
        <RecordForm
          entity="harvestTasks"
          fields={entityFields.harvestTasks || []}
          initial={edit}
          title={edit.id ? "Edit season activity" : "Schedule season activity"}
          onSave={(r) =>
            save("harvestTasks", {
              ...r,
              ...(edit.id
                ? { expectedUpdatedAt: edit.updatedAt || edit.createdAt || "" }
                : {}),
            })
          }
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
