import React, { useState } from "react";
import { api } from "../lib/workspace";
import type { Session } from "../model";
export default function InitialPassword({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [email, setEmail] = useState(session.email),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <img src="/rifan-logo.png" alt="RIFAN" />
          <strong>RIFAN Connect</strong>
        </div>
        <div className="auth-copy">
          <h1>Your account is ready.</h1>
          <p>
            Set your own password once. Your account and records will remain
            available across deployments.
          </p>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">FIRST SIGN-IN</span>
          <h2>Secure your administrator account.</h2>
          <p>
            Replace the initial password and confirm the email address you will
            use to sign in.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (password !== confirm)
                  throw new Error("The new passwords do not match.");
                if (password === current)
                  throw new Error(
                    "Choose a different password from the initial password.",
                  );
                await api("/api/profile/password", {
                  method: "PUT",
                  body: JSON.stringify({
                    currentPassword: current,
                    password,
                    email,
                  }),
                });
                onLogout();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>Account email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Initial password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy ? "Saving…" : "Save password and sign in"}
            </button>
          </form>
          <button
            className="text-button section-spacing"
            onClick={async () => {
              await api("/api/auth/logout", { method: "POST" });
              onLogout();
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
