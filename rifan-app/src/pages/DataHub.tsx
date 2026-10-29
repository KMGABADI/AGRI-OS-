import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  Download,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Link2,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Database,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  DataTable,
  Badge,
  RecordForm,
  Empty,
} from "../components/ui";
import { farmerFields, entityFields, canEdit, type Row } from "../model";
import { parseUpload, suggestMapping, normalizeInput } from "../lib/importing";
import { download, exportRows, exportSpreadsheet } from "../lib/export";
type Parsed = Awaited<ReturnType<typeof parseUpload>>;
export default function DataHub() {
  const { snapshot, session, refresh, notify, save } = useWorkspace();
  const [tab, setTab] = useState("Import records"),
    [parsed, setParsed] = useState<Parsed | null>(null),
    [sheet, setSheet] = useState(0),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [source, setSource] = useState(""),
    [preview, setPreview] = useState<any>(null),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [template, setTemplate] = useState<Partial<Row> | null>(null),
    [sheetUrl, setSheetUrl] = useState(""),
    [batchId, setBatchId] = useState(""),
    [result, setResult] = useState<any>(null),
    [drag, setDrag] = useState(false),
    [selectedOrg, setSelectedOrg] = useState(""),
    [selectedProgram, setSelectedProgram] = useState("");
  const [reviewBatch, setReviewBatch] = useState(""),
    [reviewRows, setReviewRows] = useState<any>({ rows: [], total: 0 }),
    [reviewOffset, setReviewOffset] = useState(0),
    [correction, setCorrection] = useState<any>(null);
  useEffect(() => {
    if (reviewBatch)
      api("/api/import/review/" + reviewBatch + "?offset=" + reviewOffset)
        .then(setReviewRows)
        .catch((e) => notify(e.message, true));
  }, [reviewBatch, reviewOffset, snapshot]);
  const fileInput = useRef<HTMLInputElement>(null);
  const writable = canEdit(session.role, "imports");
  const table = parsed?.sheets[sheet];
  const busy = !!progress;
  const load = async (file: File) => {
    setError("");
    setResult(null);
    setPreview(null);
    setProgress("Reading file and checking structure…");
    try {
      const data = await parseUpload(file);
      if (!data.sheets.length || !data.sheets[0].headers.length)
        throw new Error("The selected file has no data headers.");
      setParsed(data);
      setSheet(0);
      setMapping(suggestMapping(data.sheets[0].headers));
      setSource(file.name);
      setBatchId(crypto.randomUUID());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProgress("");
    }
  };
  const mapped = () =>
    table?.rows.map((raw) => {
      const normalized = normalizeInput(raw, mapping);
      return {
        ...normalized,
        data: {
          ...normalized.data,
          ...(selectedOrg ? { organizationId: selectedOrg } : {}),
          ...(selectedProgram ? { programId: selectedProgram } : {}),
        },
      };
    }) || [];
  const validate = async () => {
    if (!table) return;
    setError("");
    setProgress("Validating sample and checking database…");
    try {
      const data = mapped();
      const sample = await api("/api/import/preview", {
        method: "POST",
        body: JSON.stringify({ rows: data.slice(0, 1000).map((r) => r.data) }),
      });
      setPreview({ ...sample, sample: data.length > 1000, total: data.length });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProgress("");
    }
  };
  const commit = async () => {
    if (!table) return;
    setError("");
    let staged = { valid: 0, invalid: 0, duplicates: 0, staged: 0 };
    try {
      const data = mapped();
      for (let offset = 0; offset < data.length; offset += 500) {
        setProgress(
          `Validating and preserving source rows ${offset + 1}–${Math.min(offset + 500, data.length)} of ${data.length}…`,
        );
        const r = await api("/api/import/stage", {
          method: "POST",
          body: JSON.stringify({
            batchId,
            source,
            rows: data
              .slice(offset, offset + 500)
              .map((row, i) => ({
                sourceRow: offset + i + 2,
                raw: table.rows[offset + i],
                data: row.data,
              })),
          }),
        });
        for (const key of Object.keys(staged) as (keyof typeof staged)[])
          staged[key] += r[key];
      }
      let remaining = 1;
      let last: any;
      while (remaining) {
        setProgress(
          "Committing valid records; duplicate and invalid originals stay in the review archive…",
        );
        last = await api("/api/import/staged/" + batchId + "/commit", {
          method: "POST",
        });
        remaining = last.remaining;
      }
      setResult(last.summary);
      setPreview(null);
      await refresh();
      notify("Import finished. Review the source-row summary below.");
    } catch (e: any) {
      setError(
        e.message +
          " Your staged records are retained; retrying this batch is safe.",
      );
    } finally {
      setProgress("");
    }
  };
  const fromGoogle = async () => {
    setProgress("Reading connected Google Sheet…");
    setError("");
    try {
      const r = await api("/api/google/sheets/read", {
        method: "POST",
        body: JSON.stringify({ url: sheetUrl }),
      });
      const [headers, ...values] = r.values;
      if (!headers?.length) throw new Error("The connected sheet is empty");
      const rows = values.map((row: any[]) =>
        Object.fromEntries(
          headers.map((h: string, i: number) => [h, row[i] ?? ""]),
        ),
      );
      setParsed({
        encoding: "Google Sheets",
        sheets: [{ name: "Connected register", headers, rows }],
      });
      setSheet(0);
      setMapping(suggestMapping(headers));
      setSource(sheetUrl);
      setBatchId(crypto.randomUUID());
      setTab("Import records");
      setPreview(null);
      setResult(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProgress("");
    }
  };
  return (
    <>
      <PageHeading
        title="Data hub"
        eyebrow="BETTER DATA. BETTER DECISIONS."
        description="Bring spreadsheets and connected registers into one dependable farmer database."
        actions={
          <button
            className="button"
            onClick={() =>
              download(
                "RIFAN-registration-template.csv",
                "firstName,lastName,gender,primaryPhone,country,state,lga,crop,farmSize\r\n",
              )
            }
          >
            <Download size={16} />
            Download template
          </button>
        }
      />
      <div className="tabs">
        {[
          "Import records",
          "Google Sheets",
          "Mapping templates",
          "Export & history",
          "Review queue",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      {progress && (
        <div role="status" className="progress-box">
          <RefreshCw size={18} className="spin" />
          {progress}
        </div>
      )}
      {tab === "Import records" && (
        <>
          {!parsed ? (
            <section
              className={`upload-dropzone ${drag ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                if (writable && e.dataTransfer.files[0])
                  load(e.dataTransfer.files[0]);
              }}
            >
              <div className="upload-icon">
                <Upload size={30} />
              </div>
              <span className="eyebrow">START WITH YOUR SPREADSHEET</span>
              <h2>Good records make great beginnings.</h2>
              <p>
                Drop a CSV, Excel workbook, or ZIP register here.
                <br />
                We’ll map the columns, validate the data, and keep the originals
                safe.
              </p>
              <button
                className="button primary"
                disabled={!writable || busy}
                onClick={() => fileInput.current?.click()}
              >
                <Plus size={16} />
                Choose a file
              </button>
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                accept=".csv,.xlsx,.xls,.zip"
                onChange={(e) => {
                  if (e.target.files?.[0]) load(e.target.files[0]);
                }}
              />
              <small>CSV · XLSX · XLS · ZIP · Up to 100 MB</small>
            </section>
          ) : (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div className="file-heading">
                    <span className="stat-icon green">
                      <FileSpreadsheet size={22} />
                    </span>
                    <div>
                      <h3>
                        {source.startsWith("http")
                          ? "Connected Google register"
                          : source}
                      </h3>
                      <p>
                        {table?.rows.length.toLocaleString()} rows ·{" "}
                        {parsed.encoding} · {parsed.sheets.length} worksheet(s)
                      </p>
                    </div>
                  </div>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      setParsed(null);
                      setPreview(null);
                      setResult(null);
                    }}
                  >
                    Choose another file
                  </button>
                </div>
                <div className="import-controls">
                  <label className="field">
                    <span>Worksheet</span>
                    <select
                      disabled={busy}
                      value={sheet}
                      onChange={(e) => {
                        const i = Number(e.target.value);
                        setSheet(i);
                        setMapping(suggestMapping(parsed.sheets[i].headers));
                        setPreview(null);
                        setBatchId(crypto.randomUUID());
                      }}
                    >
                      {parsed.sheets.map((s, i) => (
                        <option key={s.name} value={i}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Assign cooperative</span>
                    <select
                      value={selectedOrg}
                      onChange={(e) => {
                        setSelectedOrg(e.target.value);
                        setSelectedProgram("");
                        setPreview(null);
                      }}
                    >
                      <option value="">Use mapped values / unassigned</option>
                      {snapshot.data.organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Assign programme</span>
                    <select
                      value={selectedProgram}
                      onChange={(e) => {
                        setSelectedProgram(e.target.value);
                        setPreview(null);
                      }}
                    >
                      <option value="">Use mapped values / unassigned</option>
                      {snapshot.data.programs
                        .filter(
                          (p) =>
                            !selectedOrg || p.organizationId === selectedOrg,
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Apply mapping template</span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const t = snapshot.data.templates.find(
                          (t) => t.id === e.target.value,
                        );
                        if (t)
                          try {
                            setMapping(JSON.parse(t.mapping));
                            setPreview(null);
                          } catch {
                            notify("Invalid template JSON", true);
                          }
                      }}
                    >
                      <option value="">Choose a template</option>
                      {snapshot.data.templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mapping-header">
                  <h3>Match your columns</h3>
                  <p>
                    Map each source column to a RIFAN field. Leave unrelated
                    columns unmapped.
                  </p>
                </div>
                <div className="mapping-grid">
                  {table?.headers.map((h) => (
                    <div className="mapping-row" key={h}>
                      <span>{h}</span>
                      <ArrowRight size={14} />
                      <select
                        aria-label={"Map column " + h}
                        value={mapping[h] || ""}
                        onChange={(e) => {
                          setMapping({ ...mapping, [h]: e.target.value });
                          setPreview(null);
                        }}
                      >
                        <option value="">Do not import this column</option>
                        {farmerFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                        <option value="farmerID">Existing member ID</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div className="form-actions">
                  <span className="small-text muted">
                    Source verification claims remain pending review.
                  </span>
                  <button
                    className="button"
                    onClick={() =>
                      setTemplate({
                        name: "",
                        mapping: JSON.stringify(mapping, null, 2),
                        requiredFields:
                          "firstName,lastName,primaryPhone,state,lga",
                      })
                    }
                  >
                    Save mapping
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || !writable}
                    onClick={validate}
                  >
                    Validate & preview <ArrowRight size={16} />
                  </button>
                </div>
              </section>
              {preview && (
                <section className="panel section-spacing">
                  <div className="panel-heading">
                    <div>
                      <h3>Review before you import</h3>
                      <p>
                        {preview.sample
                          ? "Preview of the first 1,000 rows. Every row will be validated during full import."
                          : "All rows checked against current database records."}
                      </p>
                    </div>
                  </div>
                  <div className="import-outcomes">
                    <span className="green-text">
                      ✓ {preview.valid} valid in preview
                    </span>
                    <span className="gold-text">
                      {preview.duplicates} duplicates
                    </span>
                    <span className="error-text">
                      {preview.invalid} invalid
                    </span>
                  </div>
                  <DataTable
                    rows={preview.rows.map((r: any) => ({
                      ...r,
                      id: String(r.row),
                    }))}
                    columns={[
                      {
                        key: "row",
                        label: "Source row",
                        render: (r) => r.row + 1,
                      },
                      {
                        key: "status",
                        label: "Result",
                        render: (r) => <Badge>{r.status}</Badge>,
                      },
                      { key: "reason", label: "Validation notes" },
                    ]}
                  />
                  <div className="form-actions">
                    <p className="small-text muted">
                      All {preview.total.toLocaleString()} source rows will be
                      preserved privately. Only valid, unique records enter the
                      farmer registry.
                    </p>
                    <button
                      className="button primary"
                      disabled={busy || !writable}
                      onClick={commit}
                    >
                      Import full register <Database size={16} />
                    </button>
                  </div>
                </section>
              )}
              {result && (
                <section className="panel detail-panel section-spacing">
                  <h3>Import completed</h3>
                  <div className="import-outcomes">
                    {Object.entries(result).map(([k, v]) => (
                      <span key={k}>
                        <Badge>{k}</Badge> {Number(v).toLocaleString()}
                      </span>
                    ))}
                  </div>
                  <p>
                    Duplicates and invalid originals are retained in the private
                    source archive for review, rather than discarded.
                  </p>
                  <Link className="button primary" to="/farmers">
                    Open farmer registry <ArrowRight size={16} />
                  </Link>
                </section>
              )}
            </>
          )}
          <div className="import-principles">
            <div>
              <CheckCircle2 size={22} />
              <h3>Validate first</h3>
              <p>
                Phone, identity, dates, geography and relationships are checked
                before saving.
              </p>
            </div>
            <div>
              <Database size={22} />
              <h3>Preserve the source</h3>
              <p>
                Every original row remains available in the private import
                archive.
              </p>
            </div>
            <div>
              <ShieldIcon />
              <h3>Protect member identity</h3>
              <p>BVNs, NINs and bank details stay out of diagnostic reports.</p>
            </div>
          </div>
        </>
      )}
      {tab === "Google Sheets" && (
        <section className="panel detail-panel">
          <div className="connection-heading">
            <div className="stat-icon green">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2>A connected member register</h2>
              <p>
                Read your authorized Google Sheet, map its fields, and
                synchronize records with the RIFAN registry.
              </p>
            </div>
            <Badge
              tone={snapshot.integrations.googleConnected ? "green" : "gold"}
            >
              {snapshot.integrations.googleConnected
                ? "Connected"
                : "Not connected"}
            </Badge>
          </div>
          <div className="info-strip">
            <Link2 size={17} />
            <span>
              Private sheets need a connected Google account. Refresh reads the
              current worksheet; imports are reviewed before database changes.
            </span>
            <Link to="/connections">Manage connection →</Link>
          </div>
          <label className="field">
            <span>Google spreadsheet URL</span>
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
            />
          </label>
          <div className="form-actions">
            <button
              className="button primary"
              disabled={busy || !sheetUrl || !writable}
              onClick={fromGoogle}
            >
              <RefreshCw size={16} />
              Read sheet & map columns
            </button>
          </div>
          <h3>Saved connected registers</h3>
          <DataTable
            rows={snapshot.data.workbooks}
            columns={[
              { key: "name", label: "Workbook" },
              {
                key: "url",
                label: "Spreadsheet",
                render: (r) => (
                  <a
                    className="text-link"
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Google Sheet ↗
                  </a>
                ),
              },
              {
                key: "actions",
                label: "Sync",
                render: (r) => (
                  <button
                    className="button small-button"
                    onClick={() => {
                      setSheetUrl(r.url);
                      notify(
                        "Workbook selected. Choose Read sheet & map columns to synchronize.",
                      );
                    }}
                  >
                    Select source
                  </button>
                ),
              },
            ]}
          />
          <p className="small-text muted">
            Two-way sheet sync and export are available in Connections. Google
            Sheets is a linked registry source; membership payments and audit
            history remain in the RIFAN database.
          </p>
        </section>
      )}
      {tab === "Mapping templates" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Reusable field mappings</h3>
              <p>Make repeated uploads consistent across your chapters.</p>
            </div>
            {canEdit(session.role, "templates") && (
              <button
                className="button primary"
                onClick={() => setTemplate({ mapping: "{}" })}
              >
                <Plus size={16} />
                Add template
              </button>
            )}
          </div>
          <DataTable
            rows={snapshot.data.templates}
            columns={[
              { key: "name", label: "Template" },
              { key: "requiredFields", label: "Required fields" },
              {
                key: "actions",
                label: "Manage",
                render: (r) => (
                  <button
                    className="icon-button"
                    aria-label={"Edit template " + r.name}
                    onClick={() => setTemplate(r)}
                  >
                    <Pencil size={16} />
                  </button>
                ),
              },
            ]}
          />
        </section>
      )}
      {tab === "Export & history" && (
        <>
          <section className="panel detail-panel">
            <h3>Download the loaded member view</h3>
            <p>
              Exports exclude raw identity and bank values. For large registers,
              use the paginated server export in Reports.
            </p>
            <div className="heading-actions">
              <button
                className="button"
                onClick={() =>
                  exportRows("RIFAN-members", snapshot.data.farmers).catch(
                    (e) => notify(e.message, true),
                  )
                }
              >
                <Download size={16} />
                CSV
              </button>
              <button
                className="button"
                onClick={() =>
                  exportSpreadsheet(
                    "RIFAN-members",
                    snapshot.data.farmers,
                  ).catch((e) => notify(e.message, true))
                }
              >
                <Download size={16} />
                Excel workbook
              </button>
              <Link className="button primary" to="/reports">
                Full register exports →
              </Link>
            </div>
          </section>
          <section className="panel section-spacing">
            <div className="panel-heading">
              <h3>Upload history</h3>
            </div>
            <DataTable
              rows={snapshot.data.imports}
              columns={[
                { key: "name", label: "Source" },
                {
                  key: "date",
                  label: "Uploaded",
                  render: (r) => new Date(r.date).toLocaleDateString("en-NG"),
                },
                { key: "count", label: "Imported members" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
                {
                  key: "summary",
                  label: "Review counts",
                  render: (r) =>
                    r.summary
                      ? Object.entries(r.summary)
                          .map(
                            ([k, v]) => `${k}: ${Number(v).toLocaleString()}`,
                          )
                          .join(" · ")
                      : "—",
                },
                {
                  key: "review",
                  label: "Review",
                  render: (r) => (
                    <button
                      className="button small-button"
                      onClick={() => {
                        setReviewBatch(r.id);
                        setReviewOffset(0);
                        setTab("Review queue");
                      }}
                    >
                      Review source rows
                    </button>
                  ),
                },
              ]}
            />
          </section>
        </>
      )}
      {tab === "Review queue" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Resolve source-data issues</h3>
              <p>
                Correct rejected records without changing the archived original.
                Duplicate identities need review in their existing profiles.
              </p>
            </div>
            <select
              aria-label="Select import for review"
              value={reviewBatch}
              onChange={(e) => {
                setReviewBatch(e.target.value);
                setReviewOffset(0);
              }}
            >
              <option value="">Choose an import</option>
              {snapshot.data.imports
                .filter((r) => r.summary)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>
          <DataTable
            pageSize={25}
            rows={reviewRows.rows.map((r: any) => ({
              ...r,
              id: String(r.sourceRow),
            }))}
            columns={[
              { key: "sourceRow", label: "Source row" },
              {
                key: "status",
                label: "Result",
                render: (r) => <Badge>{r.status}</Badge>,
              },
              { key: "reason", label: "Validation reason" },
              {
                key: "action",
                label: "Resolve",
                render: (r) =>
                  r.status === "Invalid" ? (
                    <button
                      className="button small-button"
                      onClick={() => setCorrection(r)}
                    >
                      Review & correct
                    </button>
                  ) : r.farmerId ? (
                    <Link className="text-link" to={"/farmers/" + r.farmerId}>
                      Open matching member →
                    </Link>
                  ) : null,
              },
            ]}
          />
          <div className="table-footer">
            <span>{reviewRows.total.toLocaleString()} rows need review</span>
            <div>
              <button
                className="button small-button"
                disabled={reviewOffset === 0}
                onClick={() => setReviewOffset((v) => Math.max(0, v - 25))}
              >
                Previous
              </button>
              <button
                className="button small-button"
                disabled={reviewOffset + 25 >= reviewRows.total}
                onClick={() => setReviewOffset((v) => v + 25)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
      {correction && (
        <RecordForm
          entity="farmers"
          fields={farmerFields}
          initial={correction.data}
          title={"Correct source row " + correction.sourceRow}
          onSave={async (r) => {
            await api(
              "/api/import/correct/" + reviewBatch + "/" + correction.sourceRow,
              { method: "PUT", body: JSON.stringify(r) },
            );
            await refresh();
            notify("Corrected record imported; original source preserved");
          }}
          onClose={() => setCorrection(null)}
        />
      )}
      {template && (
        <RecordForm
          entity="templates"
          fields={entityFields.templates || []}
          initial={template}
          title={
            template.id ? "Edit mapping template" : "Save mapping template"
          }
          onSave={(r) => save("templates", r)}
          onClose={() => setTemplate(null)}
        />
      )}
    </>
  );
}
function ShieldIcon() {
  return <CheckCircle2 size={22} />;
}
