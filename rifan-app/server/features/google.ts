import { createHash, randomBytes } from "node:crypto";
import type { Express } from "express";
import type { Store } from "../database";
import type { Session } from "../../src/model";
import { route } from "./context";
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/forms.body",
];
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export type GoogleOAuthFactory = (redirectUri: string) => Promise<{
  google: any;
  client: any;
}>;
export function googleError(
  status: number,
  code: string,
  message: string,
): never {
  throw Object.assign(new Error(message), {
    status,
    code,
    publicMessage: message,
  });
}
export function createGoogleConnection(
  s: Store,
  publicUrl: string,
  factory?: GoogleOAuthFactory,
) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim(),
    secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  let redirectUri: string | null = null;
  try {
    if (publicUrl)
      redirectUri = new URL("/api/google/callback", publicUrl).href;
  } catch {}
  const missing = [
    ...(!clientId ? ["GOOGLE_CLIENT_ID"] : []),
    ...(!secret ? ["GOOGLE_CLIENT_SECRET"] : []),
    ...(!redirectUri ? ["PUBLIC_URL (or RENDER_EXTERNAL_URL)"] : []),
  ];
  const configurationError =
    clientId && !clientId.endsWith(".apps.googleusercontent.com")
      ? "Use the client ID from a Google Cloud OAuth Web application; an API key or service account is not an OAuth client."
      : redirectUri &&
          new URL(redirectUri).protocol !== "https:" &&
          !["localhost", "127.0.0.1", "[::1]"].includes(
            new URL(redirectUri).hostname,
          )
        ? "Google sign-in requires an HTTPS public application URL outside localhost."
        : null;
  const configured = missing.length === 0 && !configurationError;
  const row = async (a: Session) =>
    (await s.db
      .prepare("SELECT * FROM integrations WHERE space=? AND user_id=?")
      .get(a.space, a.id)) as any;
  const usable = (token: any) =>
    !!token?.access_token &&
    (!token.client_id || token.client_id === clientId) &&
    (!!token.refresh_token || Number(token.expires) > Date.now() + 30000);
  const status = async (a: Session) => {
    const token = await row(a);
    return {
      configured,
      connected: configured && usable(token),
      canConnect: configured && !a.demo,
      demo: a.demo,
      missing,
      configurationError,
      redirectUri,
      requiresReconnect: !!token && (!configured || !usable(token)),
      gmailAuthorized:
        !!token?.scopes &&
        String(token.scopes).split(" ").includes(GMAIL_SCOPE),
      publicUrl: redirectUri ? new URL(redirectUri).origin : null,
    };
  };
  const oauthClient = async () => {
    if (!configured)
      googleError(
        503,
        "GOOGLE_NOT_CONFIGURED",
        configurationError ||
          `Google sign-in is not configured. Set ${missing.join(", ")} in Render Environment, then register the callback URL shown in Connections.`,
      );
    if (factory) return factory(redirectUri!);
    const { google } = await import("googleapis");
    return {
      google,
      client: new google.auth.OAuth2(clientId, secret, redirectUri!),
    };
  };
  const finish = (res: any, code: string) =>
    res.redirect("/connections?google=" + encodeURIComponent(code));
  const start = async (req: any) => {
    if (req.actor.demo)
      googleError(
        400,
        "GOOGLE_PRIVATE_ACCOUNT_REQUIRED",
        "Sign in to your private RIFAN workspace to connect a real Google account.",
      );
    const { client } = await oauthClient();
    await s.db
      .prepare("DELETE FROM oauth_states WHERE expires<?")
      .run(Date.now());
    if (
      (
        (await s.db
          .prepare(
            "SELECT count(*) AS n FROM oauth_states WHERE space=? AND user_id=?",
          )
          .get(req.actor.space, req.actor.id)) as any
      ).n >= 10
    )
      googleError(
        429,
        "GOOGLE_TOO_MANY_ATTEMPTS",
        "Several Google authorization attempts are pending. Complete the latest attempt or wait ten minutes before retrying.",
      );
    const state = randomBytes(32).toString("hex"),
      verifier = randomBytes(48).toString("base64url"),
      challenge = createHash("sha256").update(verifier).digest("base64url");
    const scopes = [
      ...GOOGLE_SCOPES,
      ...(req.body?.capability === "email" || req.query.capability === "email"
        ? [GMAIL_SCOPE]
        : []),
    ];
    await s.db
      .prepare("DELETE FROM oauth_states WHERE expires<?")
      .run(Date.now());
    await s.db
      .prepare(
        "INSERT INTO oauth_states(state_hash,user_id,space,expires,redirect_uri,verifier,scopes) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        createHash("sha256").update(state).digest("hex"),
        req.actor.id,
        req.actor.space,
        Date.now() + 600000,
        redirectUri,
        verifier,
        scopes.join(" "),
      );
    return {
      url: client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: true,
        state,
        scope: scopes,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    };
  };
  const mount = (app: Express) => {
    app.get(
      "/api/google/status",
      route(async (req, res) => res.json(await status(req.actor))),
    );
    app.post(
      "/api/google/connect",
      route(async (req, res) => res.json(await start(req))),
    );
    app.get(
      "/api/google/connect",
      route(async (req, res) => {
        try {
          res.redirect((await start(req)).url);
        } catch (e: any) {
          finish(
            res,
            e.code === "GOOGLE_NOT_CONFIGURED"
              ? "not_configured"
              : e.code === "GOOGLE_PRIVATE_ACCOUNT_REQUIRED"
                ? "private_account_required"
                : "connection_failed",
          );
        }
      }),
    );
    app.get(
      "/api/google/callback",
      route(async (req, res) => {
        const value =
          typeof req.query.state === "string" ? req.query.state : "";
        if (!/^[a-f0-9]{64}$/.test(value)) {
          finish(res, "invalid_state");
          return;
        }
        const state = (await s.db
          .prepare(
            "DELETE FROM oauth_states WHERE state_hash=? AND user_id=? AND space=? RETURNING *",
          )
          .get(
            createHash("sha256").update(value).digest("hex"),
            req.actor.id,
            req.actor.space,
          )) as any;
        if (
          !state ||
          state.expires < Date.now() ||
          state.redirect_uri !== redirectUri
        ) {
          finish(res, "invalid_state");
          return;
        }
        if (req.query.error) {
          finish(
            res,
            req.query.error === "access_denied"
              ? "access_denied"
              : "authorization_failed",
          );
          return;
        }
        if (
          typeof req.query.code !== "string" ||
          !req.query.code ||
          req.query.code.length > 4096
        ) {
          finish(res, "missing_code");
          return;
        }
        try {
          const { client } = await oauthClient();
          const { tokens } = await client.getToken({
            code: req.query.code,
            codeVerifier: state.verifier,
            redirect_uri: state.redirect_uri,
          });
          if (!tokens?.access_token) {
            finish(res, "missing_token");
            return;
          }
          const previous = await row(req.actor);
          const sameClient =
            previous &&
            (!previous.client_id || previous.client_id === clientId);
          const refreshToken =
            tokens.refresh_token ||
            (sameClient ? previous.refresh_token : null);
          await s.transaction(async () => {
            await s.db
              .prepare(
                "INSERT INTO integrations(space,user_id,access_token,refresh_token,expires,client_id,scopes) VALUES(?,?,?,?,?,?,?) ON CONFLICT(space,user_id) DO UPDATE SET access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires=excluded.expires,client_id=excluded.client_id,scopes=excluded.scopes",
              )
              .run(
                req.actor.space,
                req.actor.id,
                tokens.access_token,
                refreshToken || null,
                tokens.expiry_date || Date.now() + 3600000,
                clientId!,
                tokens.scope || state.scopes,
              );
            await s.audit(
              req.actor,
              "GOOGLE_CONNECTED",
              "integrations",
              req.actor.id,
              "Google Workspace authorization completed; credentials retained on the server",
            );
          });
          finish(res, "connected");
        } catch (error: any) {
          finish(
            res,
            error.code === "GOOGLE_NOT_CONFIGURED"
              ? "not_configured"
              : "token_exchange_failed",
          );
        }
      }),
    );
    app.post(
      "/api/google/disconnect",
      route(async (req, res) => {
        await s.transaction(async () => {
          await s.db
            .prepare("DELETE FROM integrations WHERE space=? AND user_id=?")
            .run(req.actor.space, req.actor.id);
          await s.db
            .prepare("DELETE FROM oauth_states WHERE space=? AND user_id=?")
            .run(req.actor.space, req.actor.id);
          await s.audit(
            req.actor,
            "GOOGLE_DISCONNECTED",
            "integrations",
            req.actor.id,
            "Removed this account connection; farmer records and linked workbooks retained",
          );
        });
        res.json({ success: true });
      }),
    );
  };
  const googleFor = async (a: Session, requiredScope?: string) => {
    const saved = await row(a);
    if (!saved)
      googleError(
        409,
        "GOOGLE_RECONNECT_REQUIRED",
        "Connect your Google account in Connections before using Google Workspace.",
      );
    if (!configured) await oauthClient();
    if (saved.client_id && saved.client_id !== clientId)
      googleError(
        409,
        "GOOGLE_RECONNECT_REQUIRED",
        "The Google OAuth client changed. Reconnect your Google account in Connections.",
      );
    if (
      requiredScope &&
      saved.scopes &&
      !String(saved.scopes).split(" ").includes(requiredScope)
    )
      googleError(
        409,
        "GOOGLE_SCOPE_REQUIRED",
        "Authorize Gmail alerts in Connections before sending email.",
      );
    const { google, client } = await oauthClient();
    client.setCredentials({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token || undefined,
      expiry_date: saved.expires,
    });
    let tokenWrite: Promise<void> = Promise.resolve();
    client.on("tokens", (tokens: any) => {
      tokenWrite = tokenWrite.then(async () => {
        const current = await row(a);
        if (!current || (current.client_id && current.client_id !== clientId))
          return;
        await s.db
          .prepare(
            "UPDATE integrations SET access_token=?,refresh_token=?,expires=?,client_id=?,scopes=? WHERE space=? AND user_id=?",
          )
          .run(
            tokens.access_token || current.access_token,
            tokens.refresh_token || current.refresh_token || null,
            tokens.expiry_date || current.expires,
            clientId!,
            tokens.scope || current.scopes || null,
            a.space,
            a.id,
          );
      });
    });
    if (!saved.access_token || Number(saved.expires) <= Date.now() + 30000) {
      if (!saved.refresh_token)
        googleError(
          409,
          "GOOGLE_RECONNECT_REQUIRED",
          "Your Google session expired without offline access. Reconnect your Google account in Connections.",
        );
      try {
        await client.getAccessToken();
        await tokenWrite;
      } catch (error: any) {
        const reason = error?.response?.data?.error;
        if (
          reason === "invalid_grant" ||
          reason === "invalid_client" ||
          error?.code === 401
        ) {
          await s.db
            .prepare("DELETE FROM integrations WHERE space=? AND user_id=?")
            .run(a.space, a.id);
          googleError(
            409,
            "GOOGLE_RECONNECT_REQUIRED",
            "Google authorization expired or was revoked. Reconnect your Google account in Connections.",
          );
        }
        googleError(
          502,
          "GOOGLE_TEMPORARILY_UNAVAILABLE",
          "Google could not refresh the connection. Check connectivity and try again.",
        );
      }
    }
    return { google, auth: client };
  };
  return { configured, status, mount, googleFor };
}
export function googleApiFailure(error: any) {
  const reason = error?.response?.data?.error;
  const code = typeof reason === "string" ? reason : reason?.status;
  if (
    code === "invalid_grant" ||
    code === "UNAUTHENTICATED" ||
    (error?.response?.status === 401 &&
      error?.config?.url?.includes("googleapis.com"))
  )
    return {
      status: 409,
      code: "GOOGLE_RECONNECT_REQUIRED",
      message:
        "Google authorization expired or was revoked. Reconnect your Google account in Connections.",
    };
  if (
    error?.response?.status === 403 &&
    error?.config?.url?.includes("googleapis.com")
  )
    return {
      status: 403,
      code: "GOOGLE_PERMISSION_REQUIRED",
      message:
        "Google denied access. Check sharing permissions, enabled Google APIs and granted scopes, then reconnect in Connections if needed.",
    };
  return null;
}
