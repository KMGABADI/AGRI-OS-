import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Sprout,
  Users,
  ShieldCheck,
  Warehouse,
  CalendarDays,
  Wallet,
  MapPin,
  Wheat,
} from "lucide-react";
import Overview from "./Overview";
import Reports from "./Reports";
import { api, useWorkspace } from "../lib/workspace";
import { PageHeading, StatCard, DataTable, Badge } from "../components/ui";
import StagedFilters from "../components/operations/StagedFilters";
import IntelligencePanel from "../components/operations/IntelligencePanel";
import { format, money } from "../model";
const tabs = [
  "Overview",
  "Reports & insights",
  "Season performance",
  "Field validation",
  "Collections",
  "Recommendations",
];
export default function Dashboard() {
  const { snapshot } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const tab =
    params.get("view") === "reports"
      ? "Reports & insights"
      : params.get("view") || "Overview";
  const [filters, setFilters] = useState<Record<string, any>>({}),
    [stats, setStats] = useState<any>(null);
  useEffect(() => {
    api(
      "/api/operations/summary?" +
        new URLSearchParams(
          Object.entries(filters)
            .filter(([, v]) => v)
            .map(([k, v]) => [k, String(v)]),
        ),
    )
      .then(setStats)
      .catch(() => {});
  }, [filters, snapshot]);
  return (
    <>
      <PageHeading
        title="Dashboard"
        eyebrow="ONE CONNECTED ASSOCIATION"
        description="Overview, reports, season performance and field decisions in one dashboard."
      />
      <div className="tabs dashboard-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setParams(t === "Overview" ? {} : { view: t })}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <>
          <div className="stats-grid">
            <StatCard
              label="Programmes"
              value={stats?.programmes || 0}
              icon={Sprout}
            />
            <StatCard
              label="Active seasons"
              value={stats?.activeSeasons || 0}
              icon={CalendarDays}
            />
            <StatCard
              label="Unique beneficiaries"
              value={format(stats?.uniqueBeneficiaries || 0)}
              icon={Users}
            />
            <StatCard
              label="Verified field visits"
              value={format(stats?.fieldVerified || 0)}
              icon={ShieldCheck}
            />
          </div>
          <Overview embedded />
        </>
      ) : tab === "Reports & insights" ? (
        <Reports embedded />
      ) : (
        <>
          <section className="panel detail-panel">
            <StagedFilters
              value={filters}
              onChange={setFilters}
              includeFarmerCriteria
            />
          </section>
          {tab === "Recommendations" ? (
            <div className="section-spacing">
              <IntelligencePanel filters={filters} />
            </div>
          ) : (
            stats && (
              <>
                <div className="stats-grid section-spacing">
                  <StatCard
                    label="Beneficiary participations"
                    value={format(stats.participations)}
                    icon={Users}
                  />
                  <StatCard
                    label="Completed deliveries"
                    value={format(stats.delivered)}
                    icon={Sprout}
                  />
                  <StatCard
                    label="Overdue activities"
                    value={stats.overdue}
                    icon={CalendarDays}
                    tone="gold"
                  />
                  <StatCard
                    label="Verified collections"
                    value={money(stats.collections)}
                    icon={Wallet}
                  />
                </div>
                {tab === "Season performance" && (
                  <section className="panel detail-panel">
                    <h3>Season execution</h3>
                    <div className="stats-grid three">
                      <StatCard
                        label="Scheduled activities"
                        value={stats.activities}
                        icon={CalendarDays}
                      />
                      <StatCard
                        label="Completed harvests"
                        value={stats.harvestCompleted}
                        icon={Wheat}
                      />
                      <StatCard
                        label="Historical farm sites"
                        value={stats.sites}
                        icon={MapPin}
                      />
                    </div>
                    <div className="record-links">
                      <Link className="button primary" to="/calendar">
                        Edit harvest plan →
                      </Link>
                      <Link className="button" to="/seasons">
                        Season records →
                      </Link>
                      <Link className="button" to="/interventions">
                        Intervention records →
                      </Link>
                    </div>
                  </section>
                )}
                {tab === "Field validation" && (
                  <section className="panel detail-panel">
                    <h3>Field evidence and beneficiary eligibility</h3>
                    <div className="stats-grid three">
                      <StatCard
                        label="Approved validations"
                        value={stats.fieldVerified}
                        icon={ShieldCheck}
                      />
                      <StatCard
                        label="Awaiting approval"
                        value={stats.fieldPending}
                        icon={ShieldCheck}
                        tone="gold"
                      />
                      <StatCard
                        label="Farm observations"
                        value={stats.sites}
                        icon={MapPin}
                      />
                    </div>
                    <Link className="button primary" to="/field-validation">
                      Open field validation →
                    </Link>
                  </section>
                )}
                {tab === "Collections" && (
                  <section className="panel detail-panel">
                    <h3>Membership collections</h3>
                    <p>
                      Verified ledger total:{" "}
                      <strong>{money(stats.collections)}</strong>.{" "}
                      {stats.paymentPending} records are pending/unsuccessful
                      and are not counted as collected funds.
                    </p>
                    <Link className="button primary" to="/membership">
                      Manage manual and Paystack payments →
                    </Link>
                  </section>
                )}
              </>
            )
          )}
        </>
      )}
    </>
  );
}
