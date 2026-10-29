import React, { useState } from "react";
import { UserRound, ShieldCheck } from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import { PageHeading, Badge } from "../components/ui";
import TwoFactorPanel from '../components/TwoFactorPanel';
export default function Profile() {
  const { session, notify, logout } = useWorkspace();
  const [name, setName] = useState(session.name);
  return (
    <>
      <PageHeading
        title="My account"
        eyebrow="YOUR PLACE IN THE COMMUNITY"
        description="Manage your profile and workspace password."
      />
      <div className="settings-grid">
        <section className="panel detail-panel">
          <div className="profile-account">
            <div className="avatar profile-avatar">{session.name[0]}</div>
            <div>
              <h2>{session.name}</h2>
              <p>{session.email}</p>
              <Badge>{session.role}</Badge>
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/api/profile", {
                  method: "PUT",
                  body: JSON.stringify({ name }),
                });
                notify(
                  "Profile saved. Sign in again to refresh your displayed name.",
                );
              } catch (e: any) {
                notify(e.message, true);
              }
            }}
          >
            <label className="field">
              <span>Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                required
              />
            </label>
            <button className="button primary" disabled={session.demo}>
              Save profile
            </button>
          </form>
        </section>
        <section className="panel detail-panel">
          <h3>Password & security</h3>
          <p>
            Use a unique password of at least 12 characters. Changing it signs
            out all current sessions.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              if (values.password !== values.confirm) {
                notify("New passwords do not match", true);
                return;
              }
              try {
                await api("/api/profile/password", {
                  method: "PUT",
                  body: JSON.stringify(values),
                });
                location.reload();
              } catch (e: any) {
                notify(e.message, true);
              }
            }}
          >
            <label className="field">
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label className="field">
              <span>New password</span>
              <input
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                name="confirm"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <button disabled={session.demo} className="button primary">
              Change password
            </button>
          </form>
        </section>
      </div>
      <TwoFactorPanel/>
    </>
  );
}
