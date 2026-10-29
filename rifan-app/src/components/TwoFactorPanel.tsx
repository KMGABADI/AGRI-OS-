import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, useWorkspace } from "../lib/workspace";
import { Modal, Badge } from "./ui";
import type { Row } from "../model";
export default function TwoFactorPanel() {
  const { session, notify } = useWorkspace();
  const [status, setStatus] = useState<any>(null),
    [target, setTarget] = useState<boolean | null>(null),
    [challenge, setChallenge] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/api/security/2fa")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel detail-panel section-spacing">
      <div className="connection-heading">
        <ShieldCheck size={25} />
        <div>
          <h3>Email two-factor authentication</h3>
          <p>
            Password plus a branded, single-use email OTP. Codes expire after
            five minutes.
          </p>
        </div>
        <Badge>{status?.enabled ? "Enabled" : "Disabled"}</Badge>
      </div>
      {status && (
        <>
          <label className="toggle-row">
            <span>
              Enable email OTP for my account
              {status.required ? " (required by administrator)" : ""}
            </span>
            <input
              type="checkbox"
              checked={status.enabled || status.required}
              disabled={
                session.demo || status.required || !status.emailConfigured
              }
              onChange={(e) => {
                setTarget(e.target.checked);
                setChallenge("");
                setCode("");
                setPassword("");
                setError("");
              }}
            />
          </label>
          {!status.emailConfigured && (
            <p className="small-text muted">
              An administrator must configure Resend or SMTP delivery before 2FA
              can be enabled. It is never bypassed when delivery fails.
            </p>
          )}
        </>
      )}
      {error && target === null && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {target !== null && (
        <Modal
          title={target ? "Enable email 2FA" : "Disable optional email 2FA"}
          onClose={() => setTarget(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError("");
              try {
                if (!challenge) {
                  const r = await api("/api/security/2fa/change", {
                    method: "POST",
                    body: JSON.stringify({
                      enabled: target,
                      currentPassword: password,
                    }),
                  });
                  setChallenge(r.challengeId);
                } else {
                  await api("/api/security/2fa/confirm", {
                    method: "POST",
                    body: JSON.stringify({
                      enabled: target,
                      challengeId: challenge,
                      code,
                    }),
                  });
                  location.reload();
                }
              } catch (e: any) {
                setError(e.message);
              } finally {
                setPending(false);
              }
            }}
          >
            {!challenge ? (
              <label className="field">
                <span>Confirm your current password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : (
              <label className="field">
                <span>Six-digit code sent to your account email</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button"
                onClick={() => setTarget(null)}
              >
                Cancel
              </button>
              <button disabled={pending} className="button primary">
                {pending
                  ? "Please wait…"
                  : challenge
                    ? "Confirm security change"
                    : "Send verification code"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
export function AdminTwoFactor({
  user,
  onClose,
}: {
  user: Row;
  onClose: () => void;
}) {
  const { refresh, notify } = useWorkspace();
  const [enabled, setEnabled] = useState(!!user.twoFactorEnabled),
    [required, setRequired] = useState(!!user.twoFactorRequired),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={"Account security: " + user.name} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError("");
          try {
            const data = new FormData(e.currentTarget);
            await api("/api/security/users/" + user.id + "/2fa", {
              method: "PUT",
              body: JSON.stringify({
                enabled,
                required,
                currentPassword: data.get("password"),
              }),
            });
            await refresh();
            notify("Account 2FA policy updated; existing sessions revoked");
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="toggle-row">
          <span>Enable email OTP</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Require 2FA (user cannot turn it off)</span>
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => {
              setRequired(e.target.checked);
              if (e.target.checked) setEnabled(true);
            }}
          />
        </label>
        <label className="field">
          <span>Your administrator password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <p className="small-text muted">
          A configured email service is required. Changes revoke the target
          account’s sessions.
        </p>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={pending}>
            Save security policy
          </button>
        </div>
      </form>
    </Modal>
  );
}
