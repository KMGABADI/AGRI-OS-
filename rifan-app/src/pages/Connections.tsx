import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileSpreadsheet,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Download,
  Link2,
  FileText,
  FormInput,
  CheckCircle2,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  Badge,
  DataTable,
  RecordForm,
  Modal,
} from "../components/ui";
import { entityFields, type Row, canEdit } from "../model";
import GoogleConnectionCard from "../components/operations/GoogleConnectionCard";
export default function Connections() {
  const { snapshot, session, save, refresh, notify } = useWorkspace();
  const [edit, setEdit] = useState<Partial<Row> | null>(null),
    [working, setWorking] = useState(false),
    [output, setOutput] = useState(""),
    [title, setTitle] = useState("RIFAN Member Register"),
    [folder, setFolder] = useState(""),
    [folders, setFolders] = useState<any[]>([]),
    [sync, setSync] = useState<Row | null>(null),
    [syncPreview, setSyncPreview] = useState<any>(null);
  const run = async (url: string, body: any) => {
    setWorking(true);
    try {
      const r = await api(url, { method: "POST", body: JSON.stringify(body) });
      if (r.url) setOutput(r.url);
      await refresh();
      notify(
        r.count !== undefined
          ? `${r.count} member records exported`
          : "Google operation completed",
      );
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Connections"
        eyebrow="YOUR TOOLS, WORKING TOGETHER"
        description="Connect Google Sheets, Docs and Forms to your independent RIFAN workspace."
      />
      <div className="settings-grid">
        <GoogleConnectionCard />
        <section className="panel detail-panel">
          <h3>Connected register workflow</h3>
          <ol className="flow-list">
            <li>Connect the Google account authorized to use your register.</li>
            <li>Link an existing sheet or create a workbook below.</li>
            <li>
              Preview its columns, validation results and duplicate matches.
            </li>
            <li>
              Synchronize reviewed changes into the RIFAN member registry.
            </li>
            <li>
              Export current registry records back to the selected workbook.
            </li>
          </ol>
          <Link className="text-link" to="/upload">
            Open Google Sheets import in Data hub →
          </Link>
        </section>
      </div>
      <section className="panel section-spacing">
        <div className="panel-heading">
          <div>
            <h3>Linked workbooks</h3>
            <p>
              These sheets can act as external member-register sources. Export
              writes to the dedicated RIFAN Registry tab; original source
              worksheets are preserved.
            </p>
          </div>
          {canEdit(session.role, "workbooks") && (
            <button className="button primary" onClick={() => setEdit({})}>
              <Plus size={16} />
              Link a workbook
            </button>
          )}
        </div>
        <DataTable
          rows={snapshot.data.workbooks}
          columns={[
            { key: "name", label: "Register" },
            {
              key: "url",
              label: "Workbook",
              render: (r) => (
                <a
                  className="text-link"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open spreadsheet ↗
                </a>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (r) => (
                <div className="row-actions">
                  <button
                    className="button small-button"
                    disabled={
                      working ||
                      !snapshot.integrations.googleConnected ||
                      !canEdit(session.role, "farmers")
                    }
                    onClick={() => {
                      setSync(r);
                      setSyncPreview(null);
                    }}
                  >
                    <RefreshCw size={14} />
                    Synchronize
                  </button>
                  <button
                    className="button small-button"
                    disabled={working || !snapshot.integrations.googleConnected}
                    onClick={() =>
                      run("/api/google/sheets/export", { url: r.url })
                    }
                  >
                    <Download size={14} />
                    Export to RIFAN Registry tab
                  </button>
                </div>
              ),
            },
          ]}
        />
      </section>
      {output && (
        <div className="info-strip">
          <CheckCircle2 size={18} />
          <span>Your Google document is ready.</span>
          <a href={output} rel="noreferrer" target="_blank">
            Open document ↗
          </a>
        </div>
      )}
      <section className="panel detail-panel section-spacing">
        <h3>Create a connected resource</h3>
        <div className="form-grid">
          <label className="field">
            <span>Document title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Google Drive folder (optional)</span>
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">Default Google Drive location</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="heading-actions">
          <button
            className="button"
            disabled={!snapshot.integrations.googleConnected}
            onClick={async () => {
              try {
                setFolders(await api("/api/google/folders"));
              } catch (e: any) {
                notify(e.message, true);
              }
            }}
          >
            Load authorized folders
          </button>
          <button
            className="button primary"
            disabled={working || !snapshot.integrations.googleConnected}
            onClick={() =>
              run("/api/google/sheets", { title, folderId: folder })
            }
          >
            <FileSpreadsheet size={16} />
            Create workbook
          </button>
          <button
            className="button"
            disabled={working || !snapshot.integrations.googleConnected}
            onClick={() => run("/api/google/forms", { title })}
          >
            <FormInput size={16} />
            Create registration form
          </button>
          <button
            className="button"
            disabled={working || !snapshot.integrations.googleConnected}
            onClick={() => run("/api/google/docs", {})}
          >
            <FileText size={16} />
            Export member report to Docs
          </button>
        </div>
        <p className="small-text muted">
          Creating a Google Form does not connect its responses automatically.
          Link its response spreadsheet as a workbook and synchronize it.
        </p>
      </section>
      {edit && (
        <RecordForm
          entity="workbooks"
          fields={entityFields.workbooks || []}
          initial={edit}
          title="Link Google workbook"
          onSave={(r) => save("workbooks", r)}
          onClose={() => setEdit(null)}
        />
      )}
      {sync && (
        <Modal
          title="Synchronize Google member register"
          onClose={() => setSync(null)}
          wide
        >
          <p>
            Read the current sheet and preview additions, updates and validation
            failures. Matching phone, BVN or member ID identifies an existing
            farmer. Only mapped member fields are updated.
          </p>
          <p>
            <strong>{sync.name}</strong>
          </p>
          {syncPreview ? (
            <>
              <div className="import-outcomes">
                <span>{syncPreview.additions} new members</span>
                <span>{syncPreview.updates} matching members</span>
                <span>{syncPreview.invalid} invalid rows</span>
              </div>
              <DataTable
                rows={syncPreview.rows
                  .slice(0, 100)
                  .map((r: any) => ({ ...r, id: String(r.sourceRow) }))}
                columns={[
                  { key: "sourceRow", label: "Sheet row" },
                  {
                    key: "status",
                    label: "Result",
                    render: (r) => <Badge>{r.status}</Badge>,
                  },
                  { key: "reason", label: "Notes" },
                ]}
              />
              <div className="form-actions">
                <button className="button" onClick={() => setSyncPreview(null)}>
                  Back
                </button>
                <button
                  className="button primary"
                  disabled={working || !snapshot.integrations.googleConnected}
                  onClick={async () => {
                    setWorking(true);
                    try {
                      const r = await api("/api/google/sheets/sync/commit", {
                        method: "POST",
                        body: JSON.stringify({
                          previewId: syncPreview.previewId,
                        }),
                      });
                      await refresh();
                      notify(
                        `Synchronized ${r.created} additions and ${r.updated} updates`,
                      );
                      setSync(null);
                    } catch (e: any) {
                      notify(e.message, true);
                    } finally {
                      setWorking(false);
                    }
                  }}
                >
                  Apply reviewed synchronization
                </button>
              </div>
            </>
          ) : (
            <div className="form-actions">
              <button
                className="button primary"
                disabled={working || !snapshot.integrations.googleConnected}
                onClick={async () => {
                  setWorking(true);
                  try {
                    setSyncPreview(
                      await api("/api/google/sheets/sync/preview", {
                        method: "POST",
                        body: JSON.stringify({ url: sync.url }),
                      }),
                    );
                  } catch (e: any) {
                    notify(e.message, true);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                {working ? "Reading sheet…" : "Read & preview synchronization"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
