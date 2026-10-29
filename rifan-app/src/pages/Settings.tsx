import React, { useState } from "react";
import {
  Save,
  Palette,
  ShieldCheck,
  Globe,
  Wallet,
  Image,
  LayoutDashboard,
  Settings as SettingsIcon,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import { PageHeading, Badge, Empty } from "../components/ui";
export default function Settings() {
  const { snapshot, session, refresh, notify } = useWorkspace();
  const [values, setValues] = useState({ ...snapshot.settings }),
    [tab, setTab] = useState("Brand identity"),
    [pending, setPending] = useState(false);
  if (!["Super Admin", "Admin"].includes(session.role))
    return (
      <Empty
        title="Administrator access required"
        description="Your role cannot change workspace settings."
      />
    );
  const change = (key: string, value: any) =>
    setValues((v) => ({ ...v, [key]: value }));
  const save = async () => {
    setPending(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      await refresh();
      notify("Workspace settings saved");
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Workspace settings"
        eyebrow="MAKE IT YOUR ASSOCIATION’S HOME"
        description="Manage the RIFAN identity, membership fees and the tools your team uses."
        actions={
          <button className="button primary" disabled={pending} onClick={save}>
            <Save size={16} />
            {pending ? "Saving…" : "Save settings"}
          </button>
        }
      />
      <div className="tabs">
        {[
          "Brand identity",
          "Membership fees",
          "Modules & dashboard",
          "Farmer website",
        ].map((t) => (
          <button
            key={t}
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Brand identity" && (
        <div className="settings-grid">
          <section className="panel detail-panel">
            <h3>Association identity</h3>
            <label className="field">
              <span>Platform name</span>
              <input
                value={values.appName}
                onChange={(e) => change("appName", e.target.value)}
                maxLength={60}
              />
            </label>
            <label className="field">
              <span>Tagline</span>
              <input
                value={values.tagline}
                onChange={(e) => change("tagline", e.target.value)}
                maxLength={140}
              />
            </label>
            <label className="field">
              <span>Forest green</span>
              <div className="color-input">
                <input
                  type="color"
                  value={values.primaryColor}
                  onChange={(e) => change("primaryColor", e.target.value)}
                />
                <code>{values.primaryColor}</code>
              </div>
            </label>
            <label className="field">
              <span>Appearance</span>
              <select
                value={values.theme}
                onChange={(e) => change("theme", e.target.value)}
              >
                <option value="light">RIFAN light</option>
                <option value="dark">RIFAN dark</option>
              </select>
            </label>
            <p className="small-text muted">
              A subtle RIFAN emblem watermark appears on every workspace page
              and exported member document.
            </p>
          </section>
          <section className="panel detail-panel brand-preview">
            <img
              src={values.logo || "/rifan-logo.png"}
              alt="RIFAN brand preview"
            />
            <h2>{values.appName}</h2>
            <p>{values.tagline}</p>
            <label className="button">
              <Image size={16} />
              Upload official logo
              <input
                type="file"
                className="visually-hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1024 * 1024) {
                    notify("Keep the logo under 1 MB", true);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => change("logo", reader.result);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <small>
              The current asset is a cleaned reproduction of the supplied RIFAN
              emblem. You can replace it with the official master file.
            </small>
          </section>
        </div>
      )}
      {tab === "Membership fees" && (
        <section className="panel detail-panel">
          <h3>A clear fee schedule</h3>
          <p>
            No fee amount has been assumed. Set the association-approved amounts
            before recording collections.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>One-time registration fee (₦)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.registrationFee}
                onChange={(e) =>
                  change("registrationFee", Number(e.target.value))
                }
              />
            </label>
            <label className="field">
              <span>Membership fee (₦)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.membershipFee}
                onChange={(e) =>
                  change("membershipFee", Number(e.target.value))
                }
              />
            </label>
            <label className="field">
              <span>Membership billing cycle</span>
              <select
                value={values.membershipCycle}
                onChange={(e) => change("membershipCycle", e.target.value)}
              >
                <option>Annual</option>
              </select>
            </label>
          </div>
          <div className="info-strip">
            <Wallet size={18} />
            <span>
              Amounts are in Nigerian naira. The ledger records received
              payments; online charging requires a payment-provider integration.
            </span>
          </div>
          <h3>Payment verification</h3>
          <p>
            A recorded payment stays pending until an authorized administrator
            verifies it. Failed or rejected payments do not activate membership.
          </p>
          <Badge tone="gold">Online payment provider not configured</Badge>
        </section>
      )}
      {tab === "Modules & dashboard" && (
        <div className="settings-grid">
          <section className="panel detail-panel">
            <h3>Workspace modules</h3>
            {[
              ["enableFoodBank", "Food bank & warehouses"],
              ["enableMap", "Farm intelligence map"],
              ["enableMonitoring", "Programmes & impact"],
              ["enableActivityLog", "Audit trail"],
              ["enableFarmerTemplate", "Registration templates"],
            ].map(([key, label]) => (
              <label className="toggle-row" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={!!values[key]}
                  onChange={(e) => change(key, e.target.checked)}
                />
              </label>
            ))}
          </section>
          <section className="panel detail-panel">
            <h3>Overview sections</h3>
            {[
              ["showStats", "Association statistics"],
              ["showGrowth", "Registration trend"],
              ["showRegions", "State distribution"],
              ["showActivity", "Recent member activity"],
            ].map(([key, label]) => (
              <label className="toggle-row" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={!!values[key]}
                  onChange={(e) => change(key, e.target.checked)}
                />
              </label>
            ))}
            <p className="small-text muted">
              Custom charts and dashboard widgets can be configured in Reports &
              insights.
            </p>
          </section>
        </div>
      )}
      {tab === "Farmer website" && (
        <section className="panel detail-panel">
          <div className="connection-heading">
            <Globe size={28} />
            <div>
              <h3>Prepared for a future public website</h3>
              <p>Public registration is disabled by default.</p>
            </div>
            <Badge tone="gold">Not launched</Badge>
          </div>
          <p>
            The registration endpoint creates a pending membership application,
            preserves consent, calculates configured fees and assigns a unique
            member reference. It does not automatically verify identities or
            accept money.
          </p>
          <label className="toggle-row">
            <span>Allow public membership applications after deployment</span>
            <input
              type="checkbox"
              checked={!!values.publicRegistrationEnabled}
              onChange={(e) =>
                change("publicRegistrationEnabled", e.target.checked)
              }
            />
          </label>
          <div className="info-strip">
            <ShieldCheck size={18} />
            <span>
              The deployment must also explicitly enable public registration.
              This switch alone does not publish a website or start collecting
              payments.
            </span>
          </div>
        </section>
      )}
    </>
  );
}
