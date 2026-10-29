import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  MapPinned,
  Wheat,
  Warehouse,
  ArrowUpRight,
  Plus,
  Download,
  ChevronRight,
  Leaf,
  CalendarDays,
  ShieldCheck,
  CloudSun,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useWorkspace, api } from "../lib/workspace";
import { PageHeading, StatCard, Badge } from "../components/ui";
import { format, names, canEdit } from "../model";
import { RiceLandscape } from "./Auth";
import { exportRows } from "../lib/export";
export default function Dashboard() {
  const { snapshot, session } = useWorkspace();
  const [state, setState] = useState(""),
    [period, setPeriod] = useState("12");
  const d = snapshot.data;
  const farmers = d.farmers.filter((f) => !state || f.state === state);
  const [summary, setSummary] = useState(snapshot.summary);
  useEffect(() => {
    if (!state) {
      setSummary(snapshot.summary);
      return;
    }
    api("/api/summary?state=" + encodeURIComponent(state))
      .then(setSummary)
      .catch(() => {});
  }, [state, snapshot.summary]);
  const states = snapshot.summary.regions.map((r: any) => r.name);
  const hectares = summary.hectares;
  const stats = snapshot.settings;
  const growth = useMemo(
    () =>
      Array.from({ length: Number(period) }, (_, i) => {
        const date = new Date();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() - (Number(period) - 1 - i));
        const key = date.toISOString().slice(0, 7);
        return {
          month: date.toLocaleString("en-NG", {
            month: "short",
            timeZone: "Africa/Lagos",
          }),
          members: summary.registrations
            .filter((r: any) => r.month <= key)
            .reduce((a: number, r: any) => a + Number(r.count), 0),
        };
      }),
    [summary, period],
  );
  const regions = summary.regions.slice(0, 5);
  const due = farmers
    .filter(
      (f) =>
        f.harvestDate && Date.parse(f.harvestDate) >= Date.now() - 86400000,
    )
    .sort((a, b) => a.harvestDate.localeCompare(b.harvestDate))
    .slice(0, 3);
  const active = summary.active;
  return (
    <>
      <PageHeading
        eyebrow="YOUR NATIONAL PICTURE"
        title="Growing stronger, together"
        description={`Welcome back, ${session.demo ? "RIFAN team" : session.name.split(" ")[0]}. Here’s what’s happening across your community.`}
        actions={
          <>
            <button
              className="button"
              onClick={() => exportRows("RIFAN-membership-overview", farmers)}
            >
              <Download size={16} />
              Export report
            </button>
            {canEdit(session.role, "farmers") && (
              <Link className="button primary" to="/farmers?register=1">
                <Plus size={17} />
                Register farmer
              </Link>
            )}
          </>
        }
      />
      <section className="hero-banner">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span />
            ONE ASSOCIATION. SHARED PROSPERITY.
          </span>
          <h2>
            Every farmer counts.
            <br />
            Every harvest matters.
          </h2>
          <p>
            Connecting our people, strengthening our fields,
            <br className="desktop-break" /> and securing Nigeria’s food future.
          </p>
          <Link to="/monitoring">
            Explore programmes <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="hero-art">
          <RiceLandscape />
          <div className="hero-seal">
            <img src="/rifan-logo.png" alt="RIFAN logo" />
            <span>
              ROOTED IN NIGERIA
              <br />
              <strong>Growing for tomorrow.</strong>
            </span>
          </div>
        </div>
        <span className="hero-number">01 / RIFAN CONNECT</span>
      </section>
      <div className="section-toolbar">
        <div className="section-tab">
          <span className="status-dot" />
          Association at a glance <span className="muted">/</span>
          <span className="muted">
            {session.demo ? "Sample workspace" : "Live workspace"}
          </span>
        </div>
        <div className="inline-filters">
          <label>
            <MapPinned size={14} />
            <select
              aria-label="Filter overview by state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">All states</option>
              {states.map((s: string) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <CalendarDays size={14} />
            <select
              aria-label="Registration trend period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="12">Last 12 months</option>
              <option value="6">Last 6 months</option>
              <option value="3">Last 3 months</option>
            </select>
          </label>
        </div>
      </div>
      {stats.showStats && (
        <div className="stats-grid">
          <StatCard
            label="Registered farmers"
            value={format(summary.totalFarmers)}
            note={`${format(active)} active members in this view`}
            icon={Users}
          />
          <StatCard
            label="Hectares cultivated"
            value={format(hectares)}
            note="Based on recorded farm sizes"
            icon={Leaf}
          />
          <StatCard
            label="States represented"
            value={summary.states}
            note="A growing national community"
            icon={MapPinned}
            tone="gold"
          />
          <StatCard
            label="Grain in reserve"
            value={`${format(d.warehouses.filter((w) => !state || w.state === state).reduce((s, w) => s + Number(w.currentInventory || 0), 0))} MT`}
            note={`${d.warehouses.filter((w) => !state || w.state === state).length} registered storage facilities`}
            icon={Warehouse}
            tone="gold"
          />
        </div>
      )}
      <div className="dashboard-charts">
        {stats.showGrowth && (
          <section className="panel growth-panel">
            <div className="panel-heading">
              <div>
                <h3>Our growing community</h3>
                <p>Cumulative farmer registrations</p>
              </div>
              <Badge tone="neutral">{Number(period)} months</Badge>
            </div>
            <div className="chart-legend">
              <span className="legend-dot" />
              Registered members
            </div>
            <div className="growth-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={growth}
                  margin={{ left: -25, right: 15, top: 15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#55794d"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="100%"
                        stopColor="#55794d"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 5"
                    vertical={false}
                    stroke="#e8ece4"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#7b867a" }}
                    dy={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#7b867a" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e0e5dc",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="members"
                    stroke="#426a3e"
                    strokeWidth={2.5}
                    fill="url(#growthFill)"
                    name="Members"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="panel-footnote">
              <ShieldCheck size={13} />
              {summary.undated
                ? `${format(summary.undated)} year-only or undated registrations are excluded from this monthly trend.`
                : "Calculated from member registration dates"}
            </div>
          </section>
        )}
        {stats.showRegions && (
          <section className="panel regions-panel">
            <div className="panel-heading">
              <div>
                <h3>Where we’re growing</h3>
                <p>Top states by registered members</p>
              </div>
              <MapPinned size={19} className="muted" />
            </div>
            <div className="region-bars">
              {regions.length ? (
                regions.map((r: any, i: number) => (
                  <div className="region-row" key={r.name}>
                    <div>
                      <span>
                        <b>{String(i + 1).padStart(2, "0")}</b>
                        {r.name}
                      </span>
                      <strong>{format(r.members)}</strong>
                    </div>
                    <div className="bar-track">
                      <span
                        style={{
                          width: `${(r.members / Math.max(...regions.map((r: any) => r.members))) * 100}%`,
                          background:
                            i === 0
                              ? "#305d36"
                              : i === 1
                                ? "#6b8754"
                                : i === 2
                                  ? "#a4ad72"
                                  : "#c3bb8b",
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Register farmers to see state distribution.
                </p>
              )}
            </div>
            <Link className="panel-link" to="/map">
              Explore farm intelligence <ArrowUpRight size={15} />
            </Link>
          </section>
        )}
      </div>
      <div className="dashboard-bottom">
        <section className="panel recent-members">
          <div className="panel-heading">
            <div>
              <h3>Meet our newest members</h3>
              <p>The people behind our progress</p>
            </div>
            <Link to="/farmers" className="text-link">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>FARMER</th>
                  <th>CHAPTER</th>
                  <th>FARM SIZE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {[...farmers]
                  .sort((a, b) =>
                    (b.registrationDate || "").localeCompare(
                      a.registrationDate || "",
                    ),
                  )
                  .slice(0, 4)
                  .map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link className="member-cell" to={"/farmers/" + f.id}>
                          <span
                            className="avatar small"
                            style={{
                              background:
                                f.gender === "Female" ? "#eee9da" : "#e9eee3",
                            }}
                          >
                            {f.firstName[0]}
                            {f.lastName[0]}
                          </span>
                          <span>
                            <strong>{names(f)}</strong>
                            <small>{f.farmerID}</small>
                          </span>
                        </Link>
                      </td>
                      <td>{f.state}</td>
                      <td>{format(f.farmSize)} ha</td>
                      <td>
                        <Badge>{f.profileStatus}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!farmers.length && (
            <p className="empty">Your newest farmers will appear here.</p>
          )}
        </section>
        <section className="harvest-card">
          <div className="harvest-card-heading">
            <div className="stat-icon gold">
              <Wheat size={21} />
            </div>
            <span>FROM FIELD TO HARVEST</span>
          </div>
          <h3>
            A little planning.
            <br />A better harvest.
          </h3>
          <p>
            {due.length
              ? "Your next harvests are approaching. Keep your field team one step ahead."
              : "Record planting and harvest dates to bring your seasonal plan to life."}
          </p>
          <div className="upcoming-list">
            {due.map((f) => (
              <Link to={"/farmers/" + f.id} key={f.id}>
                <span>
                  <strong>{f.state}</strong>
                  <small>{names(f)}</small>
                </span>
                <b>
                  {new Date(f.harvestDate + "T12:00:00Z").toLocaleDateString(
                    "en-NG",
                    {
                      month: "short",
                      day: "numeric",
                      timeZone: "Africa/Lagos",
                    },
                  )}
                </b>
              </Link>
            ))}
          </div>
          <Link to="/calendar">
            Open harvest planner <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="quick-actions-strip">
        <span>
          <Wheat size={20} />
          <strong>Good things grow when we work together.</strong>
        </span>
        <Link to="/upload">
          Import your farmer records <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
