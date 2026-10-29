import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileSpreadsheet,
  Link2,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Unplug,
  Mail,
} from "lucide-react";
import { api, useWorkspace } from "../../lib/workspace";
import { Badge, Modal } from "../ui";
const messages: Record<string, string> = {
  not_configured:
    "Google sign-in is not configured yet. Complete the server settings shown below.",
  private_account_required:
    "Sign in to the private RIFAN workspace before connecting Google.",
  sign_in_required:
    "Your RIFAN session expired during Google authorization. Sign in again, then retry the connection.",
  access_denied:
    "Google authorization was cancelled. No connection was saved. You can try again.",
  authorization_failed:
    "Google did not authorize this account. Check the OAuth consent-screen audience and test users, then try again.",
  invalid_state:
    "This authorization link expired or has already been used. Start a new connection from this page.",
  missing_code:
    "Google did not return an authorization code. Start the connection again.",
  missing_token:
    "Google did not return an access token. Check OAuth consent settings and try again.",
  token_exchange_failed:
    "Google could not complete authorization. Check the OAuth Web client ID, client secret and exact redirect URI in Render and Google Cloud, then reconnect.",
  connection_failed:
    "Google sign-in could not start. Check the connection settings and try again.",
};
export default function GoogleConnectionCard() {
  const { snapshot, session, refresh, notify } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [disconnect, setDisconnect] = useState(false);
  const load = async () => {
    const status = await api("/api/google/status");
    setInfo(status);
    return status;
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [snapshot]);
  useEffect(() => {
    const code = params.get("google");
    if (!code && !params.get("connected")) return;
    if (code === "connected" || params.get("connected") === "1") {
      setNotice(
        "Google Workspace is connected. You can now preview and synchronize an authorized workbook.",
      );
      refresh().catch((e) => setError(e.message));
    } else setError(messages[code || ""] || messages.connection_failed);
    const next = new URLSearchParams(params);
    next.delete("google");
    next.delete("connected");
    setParams(next, { replace: true });
  }, [params]);
  const mismatch =
    !!info?.publicUrl && info.publicUrl !== window.location.origin;
  const callback =
    info?.redirectUri || window.location.origin + "/api/google/callback";
  const connected = !!info?.connected;
  const connect = async (capability?: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/google/connect", {
        method: "POST",
        body: JSON.stringify({ capability }),
      });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
        throw new Error("The server returned an invalid Google sign-in URL.");
      window.location.assign(url.href);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
      await load().catch(() => {});
    }
  };
  return (
    <section className="panel detail-panel">
      <div className="connection-heading">
        <span className="stat-icon green">
          <FileSpreadsheet size={26} />
        </span>
        <div>
          <h2>Google Workspace</h2>
          <p>Private registers, shared reports and collection forms.</p>
        </div>
        <Badge tone={connected ? "green" : "gold"}>
          {connected
            ? "Connected"
            : info?.requiresReconnect
              ? "Reconnect required"
              : "Not connected"}
        </Badge>
      </div>
      <p>
        Connect the Google account authorized to use your registers. Google
        authorization stays separate from your RIFAN password.
      </p>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="info-strip" role="status">
          {notice}
        </div>
      )}
      {session.demo && (
        <div className="info-strip">
          Use a private RIFAN workspace account to connect Google. The shared
          demonstration cannot store a real Google authorization.
        </div>
      )}
      {mismatch && (
        <div className="error-box" role="alert">
          This site address differs from the configured Google callback address.
          Set PUBLIC_URL in Render to <strong>{window.location.origin}</strong>,
          or{" "}
          <a href={info.publicUrl + "/connections"}>
            open the configured RIFAN address
          </a>
          , sign in there and connect.
        </div>
      )}
      <div className="heading-actions section-spacing">
        <button
          className="button primary"
          disabled={busy || !info?.canConnect || mismatch}
          onClick={() => connect()}
        >
          <Link2 size={16} />
          {busy
            ? "Connecting…"
            : connected
              ? "Reconnect Google account"
              : "Connect Google account"}
          <ArrowUpRight size={16} />
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setError("");
            try {
              await load();
              notify("Google configuration checked");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <RefreshCw size={16} />
          Check configuration
        </button>
        {connected && (
          <button
            className="button"
            disabled={busy}
            onClick={() => setDisconnect(true)}
          >
            <Unplug size={16} />
            Disconnect
          </button>
        )}
      </div>
      {info && !info.configured && (
        <div className="google-setup section-spacing">
          <h3>Finish Google sign-in setup</h3>
          <p>
            {info.configurationError ||
              "An administrator must configure a Google Cloud OAuth Web application for this deployment."}
          </p>
          <ol>
            <li>
              In{" "}
              <a
                className="text-link"
                href="https://console.cloud.google.com/auth/clients"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud → Google Auth Platform → Clients ↗
              </a>
              , create an OAuth client of type <strong>Web application</strong>.
            </li>
            <li>
              Set <strong>GOOGLE_CLIENT_ID</strong> and{" "}
              <strong>GOOGLE_CLIENT_SECRET</strong> in{" "}
              <strong>Render → your service → Environment</strong>. Set{" "}
              <strong>PUBLIC_URL</strong> to{" "}
              <strong>{window.location.origin}</strong> when using this address.
              Render’s default address can use RENDER_EXTERNAL_URL
              automatically.
            </li>
            <li>
              Add the exact redirect URI below to that Google OAuth client. Save
              Render’s environment changes and redeploy.
            </li>
          </ol>
          <p>
            <strong>Missing:</strong>{" "}
            {info.missing.length
              ? info.missing.join(", ")
              : "Review the configuration error above."}
          </p>
        </div>
      )}
      <div className="section-spacing">
        <label className="field">
          <span>Authorized redirect URI in Google Cloud</span>
          <input readOnly value={callback} onFocus={(e) => e.target.select()} />
        </label>
        <button
          className="button small-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(callback);
              notify("Google callback URL copied");
            } catch {
              notify("Select the callback URL above and copy it.");
            }
          }}
        >
          <Copy size={14} />
          Copy callback URL
        </button>
      </div>
      <details className="section-spacing">
        <summary>Google permissions and setup help</summary>
        <p>
          Enable the Google Sheets, Drive, Docs and Forms APIs in the same
          Google Cloud project. Configure the consent-screen audience. While the
          app is in Testing, add your connecting account as a test user. A
          redirect_uri_mismatch error means the URI above must be registered
          exactly. Keep client secrets in Render; do not paste them into chat or
          source files.
        </p>
        <p>
          Initial authorization supports registers and documents. Gmail sending
          is optional and is requested separately.
        </p>
        {connected && !info.gmailAuthorized && (
          <button
            className="button"
            disabled={busy || mismatch}
            onClick={() => connect("email")}
          >
            <Mail size={16} />
            Authorize Gmail alerts
          </button>
        )}
        {info?.gmailAuthorized && (
          <Badge tone="green">Gmail alerts authorized</Badge>
        )}
      </details>
      {disconnect && (
        <Modal
          title="Disconnect Google Workspace"
          onClose={() => setDisconnect(false)}
        >
          <p>
            Remove your saved Google authorization from this RIFAN workspace.
            Farmer records and linked workbook records are retained. You can
            reconnect later.
          </p>
          <div className="form-actions">
            <button className="button" onClick={() => setDisconnect(false)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("/api/google/disconnect", { method: "POST" });
                  setDisconnect(false);
                  await refresh();
                  await load();
                  setNotice(
                    "Google authorization removed from this workspace.",
                  );
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Disconnect this account
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
