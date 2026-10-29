import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Download,
  Printer,
  FileBadge,
  MapPin,
  Phone,
  ShieldCheck,
  Plus,
  Trash2,
  Upload,
  FileText,
  Wallet,
  Leaf,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  Badge,
  RecordForm,
  DataTable,
  Confirm,
  Empty,
  Modal,
} from "../components/ui";
import {
  farmerFields,
  entityFields,
  names,
  format,
  money,
  canEdit,
  type Row,
  type Entity,
} from "../model";
import HistoryPanel from "../components/operations/HistoryPanel";
import MemberCard from "../components/MemberCard";
import { printCards, exportCards } from "../lib/id-cards";
import { memberPDF } from "../lib/export";
export default function FarmerProfile() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { snapshot, session, save, remove, refresh, notify } = useWorkspace();
  const [loaded, setLoaded] = useState<Row | null>(null),
    [loadError, setLoadError] = useState("");
  useEffect(() => {
    setLoaded(null);
    setLoadError("");
    api<Row>("/api/farmers/" + id)
      .then(setLoaded)
      .catch((e) => setLoadError(e.message));
  }, [id, snapshot]);
  const farmer = loaded || snapshot.data.farmers.find((f) => f.id === id);
  const [tab, setTab] = useState("Overview"),
    [editing, setEditing] = useState(false),
    [add, setAdd] = useState<{ entity: Entity; row: Partial<Row> } | null>(
      null,
    ),
    [deleting, setDeleting] = useState(false),
    [working, setWorking] = useState(false);
  if (!farmer && !loadError)
    return <div className="loading-block">Loading member profile…</div>;
  if (!farmer)
    return (
      <Empty
        title="Member not found"
        description="The record may have been removed or be outside your assigned chapter."
        action={
          <Link to="/farmers" className="button">
            Return to registry
          </Link>
        }
      />
    );
  const writable = canEdit(session.role, "farmers");
  const download = async (type: "id" | "certificate") => {
    setWorking(true);
    try {
      if (type === "id") await exportCards([farmer], snapshot.settings.logo);
      else await memberPDF(farmer, type, snapshot.settings.logo);
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setWorking(false);
    }
  };
  const upload = async (file: File, portrait = false) => {
    if (file.size > 4 * 1024 * 1024) {
      notify("Please select a document under 4 MB", true);
      return;
    }
    setWorking(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploaded = await api("/api/files/" + farmer.id, {
        method: "POST",
        body: JSON.stringify({ name: file.name, mime: file.type, base64 }),
      });
      if (portrait)
        await save("farmers", {
          id: farmer.id,
          photo: "/api/files/" + uploaded.id,
        });
      await refresh();
      notify(portrait ? "Member portrait saved" : "Document saved");
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <Link className="back-link" to="/farmers">
        <ArrowLeft size={15} />
        Farmer registry
      </Link>
      <PageHeading
        eyebrow={farmer.farmerID}
        title={names(farmer)}
        description={`${farmer.state} chapter · ${farmer.lga}`}
        actions={
          <>
            <button
              className="button"
              onClick={() => {
                try {
                  printCards([farmer.id]);
                } catch (e: any) {
                  notify(e.message, true);
                }
              }}
            >
              <Printer size={16} />
              Print ID card
            </button>
            <button
              className="button"
              disabled={working}
              onClick={() => download("id")}
            >
              <FileBadge size={16} />
              Member ID
            </button>
            <button
              className="button"
              disabled={working}
              onClick={() => download("certificate")}
            >
              <Download size={16} />
              Certificate
            </button>
            {writable && (
              <button
                className="button primary"
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} />
                Edit profile
              </button>
            )}
          </>
        }
      />
      <div className="profile-summary panel">
        <div className="portrait-block">
          <div className="avatar profile-avatar">
            {farmer.photo ? (
              <img src={farmer.photo} alt="Member portrait" />
            ) : (
              <>
                {farmer.firstName[0]}
                {farmer.lastName[0]}
              </>
            )}
          </div>
          {writable && (
            <label className="portrait-upload">
              Update portrait
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="visually-hidden"
                disabled={working}
                onChange={(e) => {
                  if (e.target.files?.[0]) upload(e.target.files[0], true);
                }}
              />
            </label>
          )}
        </div>
        <div>
          <h2>{names(farmer)}</h2>
          <p>{farmer.farmerID}</p>
          {farmer.sourceDob && !farmer.dob && (
            <p className="small-text gold-text">
              Birth-date century needs review: {farmer.sourceDob}
            </p>
          )}
          <div className="profile-badges">
            <Badge>{farmer.profileStatus}</Badge>
            <Badge tone={farmer.kycComplete ? "green" : "gold"}>
              {farmer.kycComplete
                ? "Identity verified"
                : "Verification pending"}
            </Badge>
            <Badge tone="neutral">
              {farmer.paymentStatus || "Fee status not recorded"}
            </Badge>
          </div>
        </div>
        <div className="profile-summary-stats">
          <div>
            <small>Farm area</small>
            <strong>
              {farmer.farmSize !== undefined
                ? format(farmer.farmSize) + " ha"
                : "Not recorded"}
            </strong>
          </div>
          <div>
            <small>Main crop</small>
            <strong>{farmer.crop || "Not recorded"}</strong>
          </div>
          <div>
            <small>Member since</small>
            <strong>
              {farmer.registrationDate ||
                farmer.registrationYear ||
                "Not recorded"}
            </strong>
          </div>
        </div>
      </div>
      <div className="tabs">
        {[
          "Overview",
          "Member ID card",
          "Farm & location",
          "Interventions",
          "Resources",
          "Documents",
          "Membership & finance",
          "Participation & location history",
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
      {tab === "Member ID card" && (
        <section className="panel detail-panel id-preview-panel">
          <div>
            <h3>Farmer membership identity card</h3>
            <p>
              Generated from the current profile. Print directly or export a
              PDF. The QR code contains the member reference only; it is not an
              identity verification certificate.
            </p>
            <div className="heading-actions">
              <button
                className="button primary"
                onClick={() => printCards([farmer.id])}
              >
                <Printer size={16} />
                Print this card
              </button>
              <button
                className="button"
                disabled={working}
                onClick={() => download("id")}
              >
                <Download size={16} />
                Export PDF
              </button>
            </div>
          </div>
          <MemberCard farmer={farmer} logo={snapshot.settings.logo} />
        </section>
      )}
      {tab === "Participation & location history" && (
        <HistoryPanel entity="farmers" id={farmer.id} />
      )}
      {tab === "Overview" && (
        <div className="detail-grid">
          <DetailPanel
            title="Personal & contact details"
            fields={farmerFields.slice(0, 17)}
            row={farmer}
          />
          <section className="panel detail-panel">
            <h3>Association & programme</h3>
            <dl>
              <dt>Cooperative</dt>
              <dd>
                {snapshot.data.organizations.find(
                  (o) => o.id === farmer.organizationId,
                )?.name || "Not assigned"}
              </dd>
              <dt>Programme</dt>
              <dd>
                {snapshot.data.programs.find((p) => p.id === farmer.programId)
                  ?.name || "Not assigned"}
              </dd>
              <dt>Field officer</dt>
              <dd>{farmer.agent || "Not assigned"}</dd>
              <dt>Season / phase</dt>
              <dd>{farmer.phase || "Not recorded"}</dd>
              <dt>Notes</dt>
              <dd>{farmer.remarks || "No notes recorded"}</dd>
            </dl>
          </section>
        </div>
      )}
      {tab === "Farm & location" && (
        <>
          <DetailPanel
            title="Farm & production"
            fields={farmerFields.filter((f) =>
              [
                "latitude",
                "longitude",
                "crop",
                "farmSize",
                "farmingType",
                "variety",
                "landOwnership",
                "soilType",
                "soilFertility",
                "irrigation",
                "mechanization",
                "experience",
                "plantingDate",
                "harvestDate",
                "yield_amount",
              ].includes(f.key),
            )}
            row={farmer}
          />
          <div className="info-strip">
            <MapPin size={18} />
            <span>
              {Number.isFinite(farmer.latitude) &&
              Number.isFinite(farmer.longitude)
                ? "This farm has recorded coordinates."
                : "No verified farm coordinates recorded. No location has been invented."}
            </span>
            <Link to="/map">Open farm intelligence →</Link>
          </div>
          {writable && (
            <section className="panel detail-panel section-spacing">
              <h3>Farm boundary</h3>
              <p>
                Upload GeoJSON, KML, GPX or a zipped shapefile. Boundaries are
                stored separately from point coordinates.
              </p>
              <input
                aria-label="Upload farm boundary"
                type="file"
                accept=".geojson,.json,.kml,.gpx,.zip"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const { parseBoundary } = await import("../lib/geodata");
                    const data = await parseBoundary(file);
                    await save("farmers", {
                      id: farmer.id,
                      farmBoundary: data,
                    });
                  } catch (err: any) {
                    notify(err.message, true);
                  }
                }}
              />
              {farmer.farmBoundary && <Badge>Boundary saved</Badge>}
            </section>
          )}
        </>
      )}
      {["Interventions", "Resources"].includes(tab) &&
        (() => {
          const entity =
            tab === "Interventions" ? "interventions" : "resources";
          const rows = snapshot.data[entity].filter(
            (r) => r.farmerId === farmer.id,
          );
          return (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>{tab}</h3>
                  <p>Recorded support and inputs for this farmer.</p>
                </div>
                {entity === "resources" && canEdit(session.role, entity) && (
                  <button
                    className="button primary"
                    onClick={() =>
                      setAdd({
                        entity,
                        row: { farmerId: farmer.id, status: "Planned" },
                      })
                    }
                  >
                    <Plus size={16} />
                    Add {entity === "resources" ? "resource" : "intervention"}
                  </button>
                )}
              </div>
              <DataTable
                rows={rows}
                columns={[
                  { key: "name", label: "Name" },
                  { key: "type", label: "Type" },
                  ...(entity === "resources"
                    ? [
                        {
                          key: "quantity",
                          label: "Quantity",
                          render: (r: Row) => `${r.quantity} ${r.unit}`,
                        },
                      ]
                    : [
                        { key: "dateApplied", label: "Date" },
                        {
                          key: "status",
                          label: "Status",
                          render: (r: Row) => <Badge>{r.status}</Badge>,
                        },
                      ]),
                  {
                    key: "action",
                    label: "Manage",
                    render: (r) =>
                      canEdit(session.role, entity) ? (
                        <button
                          className="icon-button"
                          aria-label={"Edit " + r.name}
                          onClick={() => setAdd({ entity, row: r })}
                        >
                          <Pencil size={15} />
                        </button>
                      ) : null,
                  },
                ]}
              />
            </section>
          );
        })()}
      {tab === "Documents" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Member documents</h3>
              <p>
                Files are stored in your RIFAN database, not temporary browser
                links.
              </p>
            </div>
            {writable && (
              <label className="button primary">
                <Upload size={16} />
                {working ? "Uploading…" : "Upload document"}
                <input
                  className="visually-hidden"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  disabled={working}
                  onChange={(e) => {
                    if (e.target.files?.[0]) upload(e.target.files[0]);
                  }}
                />
              </label>
            )}
          </div>
          <DataTable
            rows={farmer.documents || []}
            columns={[
              {
                key: "name",
                label: "Document",
                render: (r) => (
                  <a className="text-link" href={r.url}>
                    {r.name}
                    <Download size={14} />
                  </a>
                ),
              },
              {
                key: "uploadDate",
                label: "Uploaded",
                render: (r) =>
                  new Date(r.uploadDate).toLocaleDateString("en-NG"),
              },
              {
                key: "status",
                label: "Verification",
                render: (r) => <Badge>{r.status}</Badge>,
              },
              {
                key: "actions",
                label: "Actions",
                render: (r) =>
                  writable ? (
                    <div className="row-actions">
                      <button
                        className="button small-button"
                        onClick={async () => {
                          try {
                            await save("farmers", {
                              id: farmer.id,
                              documents: farmer.documents.map((d: Row) =>
                                d.id === r.id
                                  ? { ...d, status: "Verified" }
                                  : d,
                              ),
                            });
                          } catch {}
                        }}
                      >
                        Verify
                      </button>
                      <button
                        className="icon-button delete"
                        aria-label={"Remove document " + r.name}
                        onClick={async () => {
                          try {
                            await api("/api/files/" + r.id, {
                              method: "DELETE",
                            });
                            await refresh();
                          } catch (e: any) {
                            notify(e.message, true);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : null,
              },
            ]}
          />
        </section>
      )}
      {tab === "Membership & finance" && (
        <section className="panel section-spacing">
          <div className="panel-heading">
            <h3>Payment records</h3>
          </div>
          <DataTable
            rows={snapshot.data.payments.filter(
              (p) => p.farmerId === farmer.id,
            )}
            columns={[
              { key: "reference", label: "Reference" },
              { key: "type", label: "Fee type" },
              {
                key: "amount",
                label: "Amount",
                render: (r) => money(r.amount),
              },
              {
                key: "provider",
                label: "Source",
                render: (r) => r.provider || "Manual",
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge>{r.status}</Badge>,
              },
            ]}
          />
        </section>
      )}
      {tab === "Membership & finance" && (
        <div className="detail-grid">
          <DetailPanel
            title="Finance & insurance"
            fields={farmerFields.filter((f) =>
              [
                "bvn",
                "nin",
                "bankName",
                "accountNumber",
                "loanReq",
                "loanApproved",
                "insurance",
                "insurer",
                "anchor",
              ].includes(f.key),
            )}
            row={farmer}
          />
          <section className="panel detail-panel">
            <h3>Membership & fees</h3>
            <dl>
              <dt>Membership status</dt>
              <dd>{farmer.membershipStatus || "Not assessed"}</dd>
              <dt>Payment status</dt>
              <dd>{farmer.paymentStatus || "Not recorded"}</dd>
              <dt>Verified payments</dt>
              <dd>
                {money(
                  snapshot.data.payments
                    .filter(
                      (p) =>
                        p.farmerId === farmer.id && p.status === "Verified",
                    )
                    .reduce((a, p) => a + p.amount, 0),
                )}
              </dd>
            </dl>
            <p>
              Membership payments are tracked in a verified ledger. Credit
              eligibility is not inferred from an invented score.
            </p>
            <Link className="button" to={"/membership?farmer=" + farmer.id}>
              Manage membership & fees →
            </Link>
          </section>
        </div>
      )}
      {["Super Admin", "Admin", "Manager"].includes(session.role) && (
        <div className="record-danger-zone">
          <span>Record administration</span>
          <button
            className="text-button delete"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={14} />
            Remove farmer
          </button>
        </div>
      )}
      {editing && (
        <RecordForm
          entity="farmers"
          fields={farmerFields}
          initial={farmer}
          title="Edit farmer profile"
          onSave={(r) => save("farmers", r)}
          onClose={() => setEditing(false)}
        />
      )}
      {add && (
        <RecordForm
          entity={add.entity}
          fields={entityFields[add.entity] || []}
          initial={add.row}
          title={add.row.id ? "Edit record" : "Add record"}
          onSave={(r) => save(add.entity, r)}
          onClose={() => setAdd(null)}
        />
      )}
      {deleting && (
        <Confirm
          title="Remove farmer?"
          description="Linked interventions, resources, applications, payments and documents must be resolved first. The deletion is permanently recorded in your audit trail."
          onConfirm={async () => {
            await remove("farmers", farmer.id);
            navigate("/farmers");
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}
function DetailPanel({
  title,
  fields,
  row,
}: {
  title: string;
  fields: { key: string; label: string }[];
  row: Row;
}) {
  return (
    <section className="panel detail-panel">
      <h3>{title}</h3>
      <dl>
        {fields.map((f) => (
          <React.Fragment key={f.key}>
            <dt>{f.label}</dt>
            <dd>
              {["bvn", "nin", "accountNumber"].includes(f.key) && row[f.key]
                ? "••••••" + String(row[f.key]).slice(-4)
                : typeof row[f.key] === "boolean"
                  ? row[f.key]
                    ? "Yes"
                    : "No"
                  : (row[f.key] ?? "Not recorded")}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}
