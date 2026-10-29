import React, { useState } from "react";
import { Bell, Plus, Sparkles, Check, Mail, MessageSquare } from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import { PageHeading, Badge, RecordForm, Empty, Modal } from "../components/ui";
import { entityFields, canEdit } from "../model";
export default function Alerts() {
  const { snapshot, session, save, refresh, notify } = useWorkspace();
  const [filter, setFilter] = useState("Open"),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<any>(null);
  const writable = canEdit(session.role, "alerts");
  const rows = snapshot.data.alerts.filter(
    (a) => filter === "All" || a.status === filter,
  );
  return (
    <>
      <PageHeading
        title="Alerts & follow-ups"
        eyebrow="THE RIGHT ACTION, AT THE RIGHT TIME"
        description="Keep verification, harvest and chapter priorities in view."
        actions={
          writable && (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api("/api/alerts/generate", {
                      method: "POST",
                    });
                    await refresh();
                    notify(`${r.count} new alerts generated`);
                  } catch (e: any) {
                    notify(e.message, true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles size={16} />
                Check priorities
              </button>
              <button
                className="button primary"
                onClick={() => setAdding(true)}
              >
                <Plus size={16} />
                Create alert
              </button>
            </>
          )
        }
      />
      <div className="tabs">
        {["Open", "Resolved", "All"].map((t) => (
          <button
            key={t}
            className={filter === t ? "active" : ""}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="alert-list">
        {rows.map((a) => (
          <article className="panel alert-card" key={a.id}>
            <div className={"alert-symbol " + a.severity?.toLowerCase()}>
              <Bell size={21} />
            </div>
            <div className="alert-copy">
              <div>
                <Badge>{a.severity || "Low"}</Badge>
                <small>{a.category}</small>
                {a.dueDate && <small>Due {a.dueDate}</small>}
              </div>
              <h3>{a.title}</h3>
              <p>{a.message}</p>
              {a.status === "Resolved" && <Badge>Resolved</Badge>}
            </div>
            {writable && (
              <button
                className="icon-button"
                aria-label={"Email alert " + a.title}
                onClick={() => setEmail(a)}
              >
                <Mail size={17} />
              </button>
            )}
            {writable && a.status !== "Resolved" && (
              <button
                className="button"
                onClick={() =>
                  save("alerts", { id: a.id, status: "Resolved" }).catch(
                    () => {},
                  )
                }
              >
                <Check size={15} />
                Resolve
              </button>
            )}
          </article>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title="You’re all caught up"
          description="No alerts match this view."
        />
      )}
      <div className="info-strip">
        <MessageSquare size={18} />
        <span>
          Email delivery requires an authorized Google connection. SMS delivery
          is not configured. No delivery is marked successful without a provider
          response.
        </span>
      </div>
      {email && (
        <Modal title="Send alert by email" onClose={() => setEmail(null)}>
          <p>
            Review the message and recipient before sending through your
            connected Google account.
          </p>
          <h3>{email.title}</h3>
          <p>{email.message}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const to = new FormData(e.currentTarget).get("to");
              setBusy(true);
              try {
                await api("/api/google/alerts/" + email.id + "/email", {
                  method: "POST",
                  body: JSON.stringify({ to }),
                });
                await refresh();
                notify("Google accepted the email for delivery");
                setEmail(null);
              } catch (e: any) {
                notify(e.message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>Recipient email</span>
              <input name="to" type="email" required />
            </label>
            <div className="form-actions">
              <button
                className="button"
                type="button"
                onClick={() => setEmail(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                Send this email
              </button>
            </div>
          </form>
        </Modal>
      )}
      {adding && (
        <RecordForm
          entity="alerts"
          fields={entityFields.alerts || []}
          title="Create an alert"
          onSave={(r) => save("alerts", r)}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
