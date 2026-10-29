import React, { useState } from "react";
import { Plus, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  DataTable,
  Badge,
  Modal,
  Empty,
  Confirm,
} from "../components/ui";
import { ROLES, type Row } from "../model";
import { AdminTwoFactor } from "../components/TwoFactorPanel";
export default function Users() {
  const { snapshot, session, refresh, notify } = useWorkspace();
  const [securityUser, setSecurityUser] = useState<Row | null>(null);
  const [edit, setEdit] = useState<Partial<Row> | null>(null),
    [deleting, setDeleting] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  if (!["Super Admin", "Admin"].includes(session.role))
    return (
      <Empty
        title="Administrator access required"
        description="Your role cannot manage team accounts."
      />
    );
  return (
    <>
      <PageHeading
        title="Team & access"
        eyebrow="THE PEOPLE BEHIND THE PROGRESS"
        description="Give every team member the access and chapter scope they need."
        actions={
          <button
            className="button primary"
            onClick={() => {
              setEdit({ role: "Viewer" });
              setError("");
            }}
          >
            <Plus size={16} />
            Add team member
          </button>
        }
      />
      {session.demo && (
        <div className="info-strip">
          <ShieldCheck size={18} />
          <span>
            You are using a shared sample account. Create a private workspace to
            add real team members and test role restrictions.
          </span>
        </div>
      )}
      <section className="panel">
        <DataTable
          rows={snapshot.users}
          columns={[
            {
              key: "name",
              label: "Team member",
              render: (r) => (
                <span className="two-lines">
                  <strong>{r.name}</strong>
                  <small>{r.email}</small>
                </span>
              ),
            },
            {
              key: "role",
              label: "Role",
              render: (r) => <Badge tone="green">{r.role}</Badge>,
            },
            {
              key: "organizationId",
              label: "Chapter scope",
              render: (r) =>
                snapshot.data.organizations.find(
                  (o) => o.id === r.organizationId,
                )?.name || "All assigned locations",
            },
            {
              key: "states",
              label: "State access",
              render: (r) => r.states?.join(", ") || "All states",
            },
            {
              key: "actions",
              label: "Actions",
              render: (r) => (
                <div className="row-actions">
                  <button
                    className="button small-button"
                    onClick={() => setSecurityUser(r)}
                  >
                    2FA
                  </button>
                  <button
                    className="icon-button"
                    aria-label={"Edit account " + r.name}
                    onClick={() => {
                      setEdit(r);
                      setError("");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  {r.id !== session.id && (
                    <button
                      className="icon-button delete"
                      aria-label={"Remove account " + r.name}
                      onClick={() => setDeleting(r)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </section>
      <section className="panel detail-panel section-spacing">
        <h3>Roles & responsibilities</h3>
        <div className="role-grid">
          {[
            [
              "Super Admin",
              "Full workspace administration and administrator appointments.",
            ],
            [
              "Admin",
              "Operational administration and management of lower-level accounts.",
            ],
            [
              "Manager",
              "Chapter operations, programmes, storage, imports and fee recording.",
            ],
            [
              "Field Agent",
              "Farmer registration, field visits and input records within assigned locations.",
            ],
            [
              "Enumerator",
              "Farmer registration and field records within assigned locations.",
            ],
            [
              "Data Entry Officer",
              "Validated member entry and spreadsheet imports.",
            ],
            ["Viewer", "Read-only records and permitted report exports."],
          ].map(([role, description]) => (
            <div key={role}>
              <h4>{role}</h4>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>
      {securityUser && (
        <AdminTwoFactor
          user={securityUser}
          onClose={() => setSecurityUser(null)}
        />
      )}
      {edit && (
        <Modal
          title={edit.id ? "Manage team member" : "Add team member"}
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError("");
              const values: any = Object.fromEntries(
                new FormData(e.currentTarget),
              );
              values.states = String(values.states || "")
                .split(",")
                .map((v: string) => v.trim())
                .filter(Boolean);
              values.lgas = String(values.lgas || "")
                .split(",")
                .map((v: string) => v.trim())
                .filter(Boolean);
              values.plannerApproved = new FormData(e.currentTarget).has(
                "plannerApproved",
              );
              values.warehouseIds = String(values.warehouseIds || "")
                .split(",")
                .map((v: string) => v.trim())
                .filter(Boolean);
              if (!values.password) delete values.password;
              try {
                await api("/api/users" + (edit.id ? "/" + edit.id : ""), {
                  method: edit.id ? "PUT" : "POST",
                  body: JSON.stringify(values),
                });
                await refresh();
                notify("Team account saved");
                setEdit(null);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="form-grid">
              {!edit.id && (
                <>
                  <label className="field">
                    <span>Full name</span>
                    <input name="name" required minLength={2} />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input name="email" type="email" required />
                  </label>
                </>
              )}
              <label className="field">
                <span>Role</span>
                <select name="role" defaultValue={edit.role}>
                  {ROLES.filter(
                    (r) =>
                      session.role === "Super Admin" ||
                      !["Super Admin", "Admin"].includes(r),
                  ).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {edit.id ? "New password (optional)" : "Initial password"}
                </span>
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  required={!edit.id}
                  autoComplete="new-password"
                />
              </label>
              <label className="field full">
                <span>Cooperative / organization scope</span>
                <select
                  name="organizationId"
                  defaultValue={edit.organizationId || ""}
                >
                  <option value="">All organizations</option>
                  {snapshot.data.organizations.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>States (comma separated)</span>
                <input
                  name="states"
                  defaultValue={edit.states?.join(", ")}
                  placeholder="Kebbi, Kano"
                />
              </label>
              <label className="field">
                <span>LGAs (comma separated)</span>
                <input name="lgas" defaultValue={edit.lgas?.join(", ")} />
              </label>
              <label className="field full">
                <span>Assigned warehouse IDs (comma separated)</span>
                <input
                  name="warehouseIds"
                  defaultValue={edit.warehouseIds?.join(", ")}
                />
              </label>
              <label className="toggle-row field full">
                <span>Approved harvest-planning officer</span>
                <input
                  type="checkbox"
                  name="plannerApproved"
                  defaultChecked={!!edit.plannerApproved}
                />
              </label>
            </div>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button disabled={pending} className="button primary">
                {pending ? "Saving…" : "Save account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title="Remove team member?"
          description="The account and all its active sessions will be removed. Its existing audit history remains."
          onConfirm={async () => {
            await api("/api/users/" + deleting.id, { method: "DELETE" });
            await refresh();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
