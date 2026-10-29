import React, { useState } from "react";
import { Download, Plus, Pencil, ChartNoAxesCombined } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  StatCard,
  RecordForm,
  DataTable,
  Badge,
} from "../components/ui";
import { entityFields, canEdit, format, money, type Row } from "../model";
import { exportRows, exportSpreadsheet, download } from "../lib/export";
const colors = [
  "#305c35",
  "#7b955c",
  "#b7a158",
  "#ced2b4",
  "#607b66",
  "#a8b69a",
];
export default function Reports({embedded=false}:{embedded?:boolean}={}) {
  const EmbeddedHeading=(props:any)=>embedded?<div className="embedded-actions">{props.actions}</div>:<PageHeading {...props}/>;
  const { snapshot, session, save, notify } = useWorkspace();
  const [edit, setEdit] = useState<Partial<Row> | null>(null),
    [working, setWorking] = useState(false);
  const summary = snapshot.summary;
  const exportAll = async (excel = false) => {
    setWorking(true);
    try {
      const rows: Row[] = [];
      let offset = 0,
        total = 1;
      while (offset < total) {
        const page = await api("/api/farmers?limit=1000&offset=" + offset);
        rows.push(...page.rows);
        total = page.total;
        offset += page.rows.length;
        if (!page.rows.length) break;
      }
      if (excel) await exportSpreadsheet("RIFAN-full-member-register", rows);
      else await exportRows("RIFAN-full-member-register", rows);
      notify(`Exported ${rows.length.toLocaleString()} members`);
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <EmbeddedHeading
        title="Reports & insights"
        eyebrow="MAKE EVERY DECISION COUNT"
        description="Explore your full registry, measure programme delivery, and share the national picture."
        actions={
          <>
            <button
              disabled={working}
              className="button"
              onClick={() => exportAll()}
            >
              <Download size={16} />
              {working ? "Preparing export…" : "Full register CSV"}
            </button>
            <button
              disabled={working}
              className="button primary"
              onClick={() => exportAll(true)}
            >
              <Download size={16} />
              Excel workbook
            </button>
          </>
        }
      />
      <div className="stats-grid three">
        <StatCard
          label="Farmers in database"
          value={format(summary.totalFarmers)}
          icon={ChartNoAxesCombined}
        />
        <StatCard
          label="Hectares on record"
          value={format(summary.hectares) + " ha"}
          icon={ChartNoAxesCombined}
        />
        <StatCard
          label="States represented"
          value={summary.states}
          icon={ChartNoAxesCombined}
          tone="gold"
        />
      </div>
      <div className="dashboard-charts">
        <ChartPanel
          title="Member distribution by state"
          data={summary.regions}
          type="bar"
        />
        <ChartPanel
          title="Gender representation"
          data={summary.genders}
          type="pie"
        />
      </div>
      <div className="dashboard-charts">
        <ChartPanel title="Crop focus" data={summary.crops} type="bar" />
        <section className="panel detail-panel">
          <h3>Approved finance by state</h3>
          <DataTable
            rows={summary.regions.map((r: any) => ({ ...r, id: r.name }))}
            columns={[
              { key: "name", label: "State" },
              {
                key: "loans",
                label: "Recorded approved finance",
                render: (r) => money(r.loans),
              },
            ]}
          />
        </section>
      </div>
      <section className="panel section-spacing">
        <div className="panel-heading">
          <div>
            <h3>Custom dashboard widgets</h3>
            <p>
              Define role-specific charts and tables using your recorded
              operational data.
            </p>
          </div>
          {canEdit(session.role, "widgets") && (
            <button
              className="button primary"
              onClick={() =>
                setEdit({
                  enabled: true,
                  roles: "Super Admin,Admin,Manager,Viewer",
                  refreshInterval: 60,
                  dashboard: "Executive",
                })
              }
            >
              <Plus size={16} />
              Create widget
            </button>
          )}
        </div>
        <div className="widget-grid">
          {snapshot.data.widgets
            .filter(
              (w) =>
                w.enabled &&
                (!w.roles ||
                  w.roles
                    .split(",")
                    .map((v: string) => v.trim())
                    .includes(session.role)),
            )
            .map((w) => {
              let values: any[];
              if (
                w.dataSource === "farmers" &&
                ["state", "gender", "crop"].includes(w.groupBy)
              )
                values =
                  w.groupBy === "state"
                    ? summary.regions
                    : w.groupBy === "gender"
                      ? summary.genders
                      : summary.crops;
              else {
                const rows =
                  snapshot.data[w.dataSource as keyof typeof snapshot.data] ||
                  [];
                const counts = rows.reduce(
                  (a: Record<string, number>, r: Row) => {
                    const k = r[w.groupBy] || "Not recorded";
                    a[k] = (a[k] || 0) + 1;
                    return a;
                  },
                  {},
                );
                values = Object.entries(counts).map(([name, members]) => ({
                  name,
                  members,
                }));
              }
              return (
                <div key={w.id} className="custom-widget">
                  <div className="widget-title">
                    <h3>{w.name}</h3>
                    {canEdit(session.role, "widgets") && (
                      <button
                        className="icon-button"
                        aria-label={"Edit widget " + w.name}
                        onClick={() => setEdit(w)}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                  <small>{w.dashboard || "Executive"} dashboard</small>
                  {w.type === "kpi" ? (
                    <strong className="widget-kpi">
                      {w.dataSource === "farmers"
                        ? format(summary.totalFarmers)
                        : format(
                            (
                              snapshot.data[
                                w.dataSource as keyof typeof snapshot.data
                              ] || []
                            ).length,
                          )}
                    </strong>
                  ) : w.type === "table" ? (
                    <DataTable
                      rows={values.map((r: any) => ({ ...r, id: r.name }))}
                      columns={[
                        { key: "name", label: "Group" },
                        { key: "members", label: "Records" },
                      ]}
                    />
                  ) : (
                    <ChartPanel
                      title=""
                      data={values}
                      type={w.type === "pie" ? "pie" : "bar"}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </section>
      {edit && (
        <RecordForm
          entity="widgets"
          fields={entityFields.widgets || []}
          initial={edit}
          title="Configure dashboard widget"
          onSave={(r) => save("widgets", r)}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
function ChartPanel({
  title,
  data,
  type,
}: {
  title: string;
  data: any[];
  type: string;
}) {
  return (
    <section className="panel report-chart">
      <div className="panel-heading">
        <h3>{title}</h3>
      </div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="members"
                nameKey="name"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
              >
                {data.map((r, i) => (
                  <Cell key={r.name} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart
              data={data.slice(0, 12)}
              margin={{ left: -20, bottom: 15, right: 20 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 4" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                angle={-25}
                textAnchor="end"
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="members" fill="#426b3e" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {type === "pie" && (
        <div className="pie-legend">
          {data.map((r, i) => (
            <span key={r.name}>
              <i style={{ background: colors[i % colors.length] }} />
              {r.name} · {format(r.members)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
