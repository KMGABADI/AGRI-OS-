import { test, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { createTestApi as createApi } from "./database";
import { GOOGLE_SCOPES, GMAIL_SCOPE } from "../server/features/google";
const fixtures: any[] = [];
const origin = "https://rifan-oauth.example.test";
async function fixture(configured: boolean) {
  const saved = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    PUBLIC_URL: process.env.PUBLIC_URL,
    RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
  };
  if (configured) {
    process.env.GOOGLE_CLIENT_ID = "fixture.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "fixture-secret-not-live";
    process.env.PUBLIC_URL = origin;
  } else {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.PUBLIC_URL;
  }
  delete process.env.RENDER_EXTERNAL_URL;
  const state: any = {
    tokens: {
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
      expiry_date: Date.now() + 3600000,
      scope: GOOGLE_SCOPES.join(" "),
    },
    exchanges: [],
    authorizations: [],
    refreshes: 0,
    failRefresh: "",
    failExchange: false,
  };
  class Client extends EventEmitter {
    credentials: any;
    setCredentials(c: any) {
      this.credentials = c;
    }
    generateAuthUrl(options: any) {
      state.authorizations.push(options);
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      for (const [key, value] of Object.entries({
        ...options,
        client_id: "fixture.apps.googleusercontent.com",
        redirect_uri: origin + "/api/google/callback",
      }))
        url.searchParams.set(
          key,
          Array.isArray(value) ? value.join(" ") : String(value),
        );
      return url.href;
    }
    async getToken(options: any) {
      state.exchanges.push(options);
      if (state.failExchange)
        throw new Error("provider-internal-secret-do-not-expose");
      return { tokens: { ...state.tokens } };
    }
    async getAccessToken() {
      state.refreshes++;
      if (state.failRefresh)
        throw { response: { data: { error: state.failRefresh } } };
      this.emit("tokens", {
        access_token: "fixture-refreshed",
        refresh_token: "fixture-rotated",
        expiry_date: Date.now() + 3600000,
      });
      return { token: "fixture-refreshed" };
    }
  }
  const created = await createApi({
    filename: ":memory:",
    demo: true,
    googleOAuthFactory: async () => ({
      client: new Client(),
      google: {
        drive: () => ({
          files: { list: async () => ({ data: { files: [] } }) },
        }),
      },
    }),
  });
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const server = created.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  let cookie = "";
  async function call(
    path: string,
    method = "GET",
    body?: any,
    session = cookie,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: session },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const bodyText = await response.text();
    return {
      status: response.status,
      body: response.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(bodyText)
        : bodyText,
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
      location: response.headers.get("location"),
    };
  }
  const owner = await call("/api/auth/setup", "POST", {
    name: "OAuth fixture",
    email: "oauth@example.test",
    password: "fixture-password-123",
  });
  assert.equal(owner.status, 201);
  cookie = owner.cookie;
  const f = {
    ...created,
    server,
    state,
    call,
    cookie,
    actor: owner.body,
    async begin(capability?: string) {
      const r = await call("/api/google/connect", "POST", { capability });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return new URL(r.body.url);
    },
    async callback(url: URL, query = "code=fixture-code") {
      return await call(
        "/api/google/callback?state=" +
          url.searchParams.get("state") +
          "&" +
          query,
      );
    },
  };
  fixtures.push(f);
  return f;
}
after(async () => {
  for (const f of fixtures) {
    await new Promise<void>((r) => f.server.close(() => r()));
    await f.store.db.close();
  }
});
test("missing Google configuration stays inside the app and exposes no credentials", async () => {
  const f = await fixture(false);
  const status = await f.call("/api/google/status");
  assert.equal(status.body.configured, false);
  assert.ok(status.body.missing.includes("GOOGLE_CLIENT_ID"));
  const post = await f.call("/api/google/connect", "POST", {});
  assert.equal(post.status, 503);
  assert.equal(post.body.code, "GOOGLE_NOT_CONFIGURED");
  assert.match(post.body.error, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(post.body.error, /service could not complete/);
  const legacy = await f.call("/api/google/connect");
  assert.equal(legacy.status, 302);
  assert.equal(legacy.location, "/connections?google=not_configured");
  assert.equal(
    (await f.call("/api/google/status", "GET", undefined, "")).status,
    401,
  );
});
test("OAuth authorization, PKCE, callbacks, refresh and disconnect", async (t) => {
  const f = await fixture(true);
  await t.test(
    "connect requests offline access with hashed, bound state and PKCE",
    async () => {
      const url = await f.begin();
      assert.equal(url.hostname, "accounts.google.com");
      assert.equal(
        url.searchParams.get("redirect_uri"),
        origin + "/api/google/callback",
      );
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert.ok(!url.searchParams.get("scope")!.includes(GMAIL_SCOPE));
      const stored = (await f.store.db
        .prepare("SELECT * FROM oauth_states")
        .get()) as any;
      assert.notEqual(stored.state_hash, url.searchParams.get("state"));
      assert.equal(
        stored.state_hash,
        createHash("sha256")
          .update(url.searchParams.get("state")!)
          .digest("hex"),
      );
      assert.equal(
        createHash("sha256").update(stored.verifier).digest("base64url"),
        url.searchParams.get("code_challenge"),
      );
      assert.equal(
        (await f.callback(url)).location,
        "/connections?google=connected",
      );
      assert.equal(f.state.exchanges[0].codeVerifier, stored.verifier);
      assert.equal((await f.call("/api/google/status")).body.connected, true);
      const snapshot = await f.call("/api/snapshot");
      assert.equal(snapshot.body.integrations.googleConnected, true);
      assert.doesNotMatch(
        JSON.stringify(snapshot.body),
        /fixture-access|fixture-refresh|fixture-secret|state_hash|codeVerifier/,
      );
      assert.equal(
        (await f.callback(url)).location,
        "/connections?google=invalid_state",
      );
    },
  );
  await t.test(
    "cancellation is single-use and retains an existing connection",
    async () => {
      const url = await f.begin();
      assert.equal(
        (await f.callback(url, "error=access_denied")).location,
        "/connections?google=access_denied",
      );
      assert.equal(
        (await f.callback(url)).location,
        "/connections?google=invalid_state",
      );
      assert.equal((await f.call("/api/google/status")).body.connected, true);
    },
  );
  await t.test(
    "expired state, missing code and lost RIFAN session return recovery URLs",
    async () => {
      let url = await f.begin();
      await f.store.db.prepare("UPDATE oauth_states SET expires=0").run();
      assert.equal(
        (await f.callback(url)).location,
        "/connections?google=invalid_state",
      );
      url = await f.begin();
      assert.equal(
        (await f.callback(url, "")).location,
        "/connections?google=missing_code",
      );
      assert.equal(
        (
          await f.call(
            "/api/google/callback?code=fixture&state=invalid",
            "GET",
            undefined,
            "",
          )
        ).location,
        "/connections?google=sign_in_required",
      );
    },
  );
  await t.test(
    "token exchange failure is safe and a prior refresh token is preserved on reconnect",
    async () => {
      let url = await f.begin();
      f.state.failExchange = true;
      const failed = await f.callback(url);
      assert.equal(
        failed.location,
        "/connections?google=token_exchange_failed",
      );
      assert.doesNotMatch(JSON.stringify(failed), /provider-internal/);
      f.state.failExchange = false;
      f.state.tokens.refresh_token = undefined;
      url = await f.begin();
      assert.equal(
        (await f.callback(url)).location,
        "/connections?google=connected",
      );
      assert.equal(
        (
          (await f.store.db
            .prepare("SELECT refresh_token FROM integrations WHERE space=?")
            .get("workspace")) as any
        ).refresh_token,
        "fixture-refresh",
      );
    },
  );
  await t.test(
    "refresh persists rotated credentials and handles revoked grants",
    async () => {
      await f.store.db.prepare("UPDATE integrations SET expires=0").run();
      assert.equal((await f.call("/api/google/folders")).status, 200);
      assert.equal(f.state.refreshes, 1);
      assert.equal(
        (
          (await f.store.db
            .prepare("SELECT refresh_token FROM integrations")
            .get()) as any
        ).refresh_token,
        "fixture-rotated",
      );
      await f.store.db.prepare("UPDATE integrations SET expires=0").run();
      f.state.failRefresh = "invalid_grant";
      const failed = await f.call("/api/google/folders");
      assert.equal(failed.status, 409);
      assert.equal(failed.body.code, "GOOGLE_RECONNECT_REQUIRED");
      assert.equal((await f.call("/api/google/status")).body.connected, false);
      f.state.failRefresh = "";
    },
  );
  await t.test(
    "Gmail authorization is optional and disconnect retains registry records",
    async () => {
      f.state.tokens.refresh_token = "fixture-refresh";
      f.state.tokens.scope = [...GOOGLE_SCOPES, GMAIL_SCOPE].join(" ");
      const url = await f.begin("email");
      assert.ok(url.searchParams.get("scope")!.includes(GMAIL_SCOPE));
      await f.callback(url);
      assert.equal(
        (await f.call("/api/google/status")).body.gmailAuthorized,
        true,
      );
      await f.store.put("workspace", "workbooks", {
        id: "fixture-workbook",
        name: "Retain workbook",
        url: "https://docs.google.com/spreadsheets/d/fixture/edit",
      });
      const pending = await f.begin();
      assert.ok(pending);
      const disconnected = await f.call("/api/google/disconnect", "POST", {});
      assert.equal(disconnected.status, 200);
      assert.equal((await f.call("/api/google/status")).body.connected, false);
      assert.equal(
        (
          (await f.store.db
            .prepare("SELECT count(*) AS n FROM oauth_states")
            .get()) as any
        ).n,
        0,
      );
      assert.ok(
        await f.store.get("workspace", "workbooks", "fixture-workbook"),
      );
    },
  );
  await t.test(
    "shared demo cannot store real authorization and callback state is user-bound",
    async () => {
      const url = await f.begin();
      const demo = await f.call("/api/auth/demo", "POST", {});
      assert.equal(
        (await f.call("/api/google/connect", "POST", {}, demo.cookie)).status,
        400,
      );
      assert.equal(
        (
          await f.call(
            "/api/google/callback?state=" +
              url.searchParams.get("state") +
              "&code=fixture",
            "GET",
            undefined,
            demo.cookie,
          )
        ).location,
        "/connections?google=invalid_state",
      );
      assert.equal(
        (await f.callback(url)).location,
        "/connections?google=connected",
      );
    },
  );
});
