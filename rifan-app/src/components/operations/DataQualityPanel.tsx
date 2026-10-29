import React, { useEffect, useState } from "react";
import { api, useWorkspace } from "../../lib/workspace";
import { StatCard, DataTable, Badge } from "../ui";
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  Files,
  Download,
  RefreshCw,
} from "lucide-react";
import { download } from "../../lib/export";
export default function DataQualityPanel({
  onReview,
}: {
  onReview: (id: string) => void;
}) {
  const { snapshot, refresh } = useWorkspace();
  const [summary, setSummary] = useState<any>(null),
    [audit, setAudit] = useState<any>(null),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () => setSummary(await api("/api/data-quality"));
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [snapshot]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const checkRegistry = async () => {
    const totals: any = {
      checked: 0,
      valid: 0,
      needsReview: 0,
      normalizable: 0,
      reasons: {},
      generatedAt: new Date().toISOString(),
    };
    let offset = 0,
      version = "";
    setAudit(null);
    while (true) {
      const r = await api("/api/data-quality/audit", {
        method: "POST",
        body: JSON.stringify({ offset, version }),
      });
      version = r.version;
      for (const key of ["checked", "valid", "needsReview", "normalizable"])
        totals[key] += r[key];
      for (const [key, count] of Object.entries(r.reasons))
        totals.reasons[key] = (totals.reasons[key] || 0) + Number(count);
      setStatus(`Checked ${totals.checked.toLocaleString()} farmer records…`);
      if (r.complete) break;
      offset = r.nextOffset;
    }
    setAudit(totals);
    setStatus("Registry audit completed. No farmer records were changed.");
  };
  const recheck = async () => {
    let afterId = 0;
    const totals = { checked: 0, ready: 0, invalid: 0, duplicates: 0 };
    while (true) {
      const r = await api("/api/data-quality/recheck", {
        method: "POST",
        body: JSON.stringify({ afterId }),
      });
      for (const key of ["checked", "ready", "invalid", "duplicates"] as const)
        totals[key] += r[key];
      setStatus(
        `${totals.checked.toLocaleString()} rejected source rows rechecked; ${totals.ready.toLocaleString()} ready for import…`,
      );
      if (!r.remaining) break;
      afterId = r.afterId;
    }
    await refresh();
    setStatus(
      `Recheck complete: ${totals.ready.toLocaleString()} ready for import, ${totals.invalid.toLocaleString()} require source corrections, ${totals.duplicates.toLocaleString()} duplicates. Original source values are preserved.`,
    );
  };
  return (
    <>
      <section className="panel detail-panel">
        <div className="panel-heading">
          <div>
            <h3>Data quality across the complete database</h3>
            <p>
              Validate the whole registry, recheck archived rejects and
              reconcile import counts. Missing evidence stays missing;
              duplicates are never merged automatically.
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        {summary && (
          <div className="stats-grid">
            <StatCard
              label="Registered farmers"
              value={summary.farmers.total}
              icon={Users}
            />
            <StatCard
              label="Archived source rows"
              value={summary.totalSources}
              icon={Files}
            />
            <StatCard
              label="Source rows requiring correction"
              value={summary.sources.Invalid || 0}
              icon={AlertTriangle}
            />
            <StatCard
              label="Duplicate source rows retained"
              value={summary.sources.Duplicate || 0}
              icon={ShieldCheck}
            />
          </div>
        )}
        <div className="heading-actions section-spacing">
          <button
            className="button primary"
            disabled={busy}
            onClick={() => run(checkRegistry)}
          >
            Audit all farmer records
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => run(recheck)}
          >
            Recheck rejected source rows
          </button>
          <button
            className="button"
            disabled={!summary || busy}
            onClick={() =>
              download(
                "RIFAN-data-quality.json",
                JSON.stringify({ summary, registryAudit: audit }, null, 2),
                "application/json",
              )
            }
          >
            <Download size={16} />
            Download quality report
          </button>
        </div>
        {status && (
          <p role="status" className="info-strip">
            {busy && <RefreshCw size={16} className="spin" />}
            {status}
          </p>
        )}
        {audit && (
          <div className="section-spacing">
            <h3>Complete registry validation</h3>
            <p>
              {audit.checked.toLocaleString()} checked ·{" "}
              {audit.valid.toLocaleString()} valid ·{" "}
              {audit.needsReview.toLocaleString()} require correction ·{" "}
              {audit.normalizable.toLocaleString()} have formatting differences.
            </p>
            {Object.entries(audit.reasons).map(([reason, count]) => (
              <p key={reason}>
                {String(count)} · {reason}
              </p>
            ))}
          </div>
        )}
        {summary && (
          <div className="section-spacing">
            <h3>Identity and completeness checks</h3>
            <p>
              {
                Object.values(summary.duplicateGroups).reduce(
                  (n: any, v: any) => n + v,
                  0,
                ) as number
              }{" "}
              duplicate identity groups (including equivalent Nigerian phone
              formats); {summary.orphanedSources} imported source rows with a
              missing farmer link.
            </p>
            <p>
              {Number(summary.farmers.missingCoordinates || 0).toLocaleString()}{" "}
              farmers have no complete GPS pair;{" "}
              {Number(summary.farmers.missingBirthDate || 0).toLocaleString()}{" "}
              have no confirmed birth date. These are evidence gaps, and are not
              filled with guessed values.
            </p>
          </div>
        )}
      </section>
      {summary?.reasons?.length > 0 && (
        <section className="panel section-spacing">
          <div className="panel-heading">
            <h3>Rejected source reasons</h3>
          </div>
          <DataTable
            rows={summary.reasons.map((r: any, i: number) => ({
              ...r,
              id: String(i),
            }))}
            columns={[
              { key: "reason", label: "Correction needed" },
              { key: "count", label: "Source rows" },
            ]}
          />
        </section>
      )}
      <section className="panel section-spacing">
        <div className="panel-heading">
          <h3>Review and finish each import</h3>
        </div>
        <DataTable
          rows={snapshot.data.imports}
          columns={[
            { key: "name", label: "Import" },
            { key: "count", label: "Imported farmers" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
            {
              key: "actions",
              label: "Actions",
              render: (r) => (
                <div className="row-actions">
                  <button
                    className="button small-button"
                    disabled={busy}
                    onClick={() => onReview(r.id)}
                  >
                    Review corrections
                  </button>
                  {!!r.summary?.Valid && (
                    <button
                      className="button small-button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          let imported = 0;
                          while (true) {
                            const result = await api(
                              "/api/import/staged/" + r.id + "/commit",
                              { method: "POST" },
                            );
                            imported += result.imported;
                            setStatus(
                              `${imported.toLocaleString()} revalidated records imported…`,
                            );
                            if (!result.remaining) break;
                          }
                          await refresh();
                          setStatus(
                            `${imported.toLocaleString()} revalidated records imported. Source values retained.`,
                          );
                        })
                      }
                    >
                      Import revalidated rows
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
