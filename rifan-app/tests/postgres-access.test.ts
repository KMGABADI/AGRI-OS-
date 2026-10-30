import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createTestApi } from "./database";
import { createApi } from "../server/api";
import { ensureBootstrapAdmin } from "../server/bootstrap";
import { postgresOptions, postgresSQL } from "../server/db/driver";
const mail: any[] = [];
let transaction: any;
const options = {
  filename: ":memory:",
  bootstrap: false,
  demo: false,
  mailer: {
    send: async (message: any) => {
      mail.push(message);
    },
  },
  paystackSecret: "fixture-paystack-secret",
  paystack: {
    initialize: async (p: any) => {
      transaction = { ...p, id: 1, status: "success" };
      return { authorization_url: "https://checkout.paystack.com/fixture" };
    },
    verify: async () => transaction,
  },
};
const f = await createTestApi(options);
const server = f.app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + (server.address() as any).port;
let second: any, other: any;
let cookie = "",
  adminEmail = "admin@rifan.local";
const initialPassword = "fixture-initial-password-123",
  password = "fixture-personal-password-456";
const env = {
  BOOTSTRAP_ADMIN_PASSWORD: initialPassword,
  BOOTSTRAP_ADMIN_EMAIL: adminEmail,
};
after(async () => {
  if (other) await new Promise<void>((r) => other.close(() => r()));
  if (second) await second.store.db.close();
  await new Promise<void>((r) => server.close(() => r()));
  await f.store.db.close();
});
async function call(
  path: string,
  method = "GET",
  body?: any,
  session = cookie,
  origin = base,
  headers: any = {},
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: session,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
test("PostgreSQL configuration requires verified remote TLS and safely binds values", () => {
  assert.throws(
    () =>
      postgresOptions(
        "postgresql://user:secret@db.example.test/rifan?sslmode=disable",
      ),
    /verified TLS/,
  );
  const options = postgresOptions(
    "postgresql://user:secret@db.example.test/rifan?sslmode=require",
  );
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal(
    new URL(options.connectionString).searchParams.get("sslmode"),
    null,
  );
  assert.equal(
    postgresSQL("SELECT '?' AS label WHERE id=? AND value='It''s ?'"),
    "SELECT '?' AS label WHERE id=$1 AND value='It''s ?'",
  );
});
test("initial administrator persists and does not reset after an email/password change", async () => {
  const seeded = await ensureBootstrapAdmin(f.store, env);
  assert.equal(seeded.created, true);
  assert.equal((await call("/api/auth/status")).body.needsSetup, false);
  let login = await call(
    "/api/auth/login",
    "POST",
    { email: adminEmail, password: initialPassword },
    "",
  );
  assert.equal(login.status, 200);
  assert.equal(login.body.mustChangePassword, true);
  assert.equal(
    (await call("/api/snapshot", "GET", undefined, login.cookie)).status,
    403,
  );
  adminEmail = "owner@example.test";
  assert.equal(
    (
      await call(
        "/api/profile/password",
        "PUT",
        { currentPassword: initialPassword, password, email: adminEmail },
        login.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await ensureBootstrapAdmin(f.store, env)).created, false);
  assert.equal(
    (
      await f.store.db
        .prepare("SELECT count(*) AS n FROM users WHERE space='workspace'")
        .get()
    ).n,
    1,
  );
  login = await call(
    "/api/auth/login",
    "POST",
    { email: adminEmail, password },
    "",
  );
  assert.equal(login.status, 200);
  assert.equal(login.body.mustChangePassword, false);
  cookie = login.cookie;
  assert.equal((await call("/api/snapshot")).status, 200);
});
test(
  "shared PostgreSQL supports independent concurrent sessions, writes and one-time verification",
  { skip: !process.env.RIFAN_TEST_POSTGRES_URL },
  async (t) => {
    assert.ok(f.databaseUrl);
    second = await createApi({ ...options, filename: f.databaseUrl });
    other = second.app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => other.once("listening", r));
    const otherBase = "http://127.0.0.1:" + other.address().port;
    let sessions: string[] = [];
    let farmerId = "";
    await t.test(
      "multiple browsers and two different users stay signed in on two app instances",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            call(
              "/api/auth/login",
              "POST",
              { email: adminEmail, password },
              "",
              i % 2 ? otherBase : base,
            ),
          ),
        );
        assert.ok(results.every((r) => r.status === 200));
        sessions = results.map((r) => r.cookie);
        assert.equal(new Set(sessions).size, 6);
        const reads = await Promise.all(
          sessions.map((s, i) =>
            call("/api/auth/me", "GET", undefined, s, i % 2 ? base : otherBase),
          ),
        );
        assert.ok(reads.every((r) => r.status === 200));
        const created = await call("/api/users", "POST", {
          name: "Other viewer",
          email: "other@example.test",
          password,
          role: "Viewer",
        });
        assert.equal(created.status, 201);
        const viewer = await call(
          "/api/auth/login",
          "POST",
          { email: "other@example.test", password },
          "",
          otherBase,
        );
        assert.equal(viewer.status, 200);
        assert.equal(
          (await call("/api/snapshot", "GET", undefined, viewer.cookie, base))
            .status,
          200,
        );
        assert.equal(
          (
            await call(
              "/api/records/programs",
              "POST",
              { name: "Forbidden" },
              viewer.cookie,
              otherBase,
            )
          ).status,
          403,
        );
        await call("/api/auth/logout", "POST", {}, sessions[0]);
        assert.equal(
          (await call("/api/auth/me", "GET", undefined, sessions[0], otherBase))
            .status,
          401,
        );
        assert.equal(
          (await call("/api/auth/me", "GET", undefined, sessions[1])).status,
          200,
        );
      },
    );
    await t.test(
      "registry audit versions are stable across application instances",
      async () => {
        const a = await call(
          "/api/data-quality/audit",
          "POST",
          { offset: 0 },
          sessions[1],
          base,
        );
        const b = await call(
          "/api/data-quality/audit",
          "POST",
          { offset: 0, version: a.body.version },
          sessions[1],
          otherBase,
        );
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        assert.equal(a.body.version, b.body.version);
      },
    );
    await t.test(
      "concurrent warehouse receipts retain both ledger entries and the correct balance",
      async () => {
        const warehouse = await call("/api/records/warehouses", "POST", {
          name: "Concurrent store",
          capacity: 100,
          status: "Active",
        });
        assert.equal(warehouse.status, 201);
        const results = await Promise.all(
          [base, otherBase].map((origin, i) =>
            call(
              "/api/stock",
              "POST",
              {
                warehouseId: warehouse.body.id,
                type: "Receipt",
                quantity: 30,
                reference: "receipt-" + i,
              },
              sessions[1],
              origin,
            ),
          ),
        );
        assert.ok(
          results.every((r) => r.status === 201),
          JSON.stringify(results.map((r) => r.status)),
        );
        const stored = await f.store.get(
          "workspace",
          "warehouses",
          warehouse.body.id,
        );
        assert.equal(stored?.currentInventory, 60);
      },
    );
    await t.test(
      "concurrent duplicate creates have one winner and no duplicate identities",
      async () => {
        const farmer = {
          firstName: "Concurrent",
          lastName: "Fixture",
          primaryPhone: "08012345678",
          country: "Nigeria",
          state: "Kebbi",
          lga: "Birnin Kebbi",
          gender: "Female",
        };
        const results = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            call(
              "/api/records/farmers",
              "POST",
              farmer,
              sessions[1],
              i % 2 ? otherBase : base,
            ),
          ),
        );
        assert.equal(
          results.filter((r) => r.status === 201).length,
          1,
          JSON.stringify(results.map((r) => r.status)),
        );
        assert.ok(
          results
            .filter((r) => r.status !== 201)
            .every((r) => r.status === 409),
        );
        farmerId = results.find((r) => r.status === 201)!.body.id;
      },
    );
    await t.test(
      "concurrent edits reject a stale version instead of overwriting it",
      async () => {
        const farmer = (await call("/api/farmers/" + farmerId)).body;
        await new Promise((r) => setTimeout(r, 3));
        const results = await Promise.all(
          ["First change", "Second change"].map((remarks, i) =>
            call(
              "/api/records/farmers/" + farmerId,
              "PUT",
              {
                remarks,
                expectedUpdatedAt: farmer.updatedAt || farmer.createdAt,
              },
              sessions[1],
              i ? otherBase : base,
            ),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      },
    );
    await t.test(
      "provider verification remains idempotent under concurrent requests",
      async () => {
        await call("/api/settings", "PUT", {
          registrationFee: 1000,
          membershipFee: 0,
        });
        const checkout = await call(
          "/api/payments/paystack/initialize",
          "POST",
          { farmerId, type: "Registration", email: "payer@example.test" },
        );
        assert.equal(checkout.status, 201);
        const results = await Promise.all([
          call(
            "/api/payments/paystack/" + checkout.body.reference + "/verify",
            "POST",
            {},
          ),
          call(
            "/api/payments/paystack/" + checkout.body.reference + "/verify",
            "POST",
            {},
            sessions[1],
            otherBase,
          ),
        ]);
        assert.ok(results.every((r) => r.status === 200));
        const audit = await f.store.db
          .prepare(
            "SELECT count(*) AS n FROM audit WHERE action='PAYMENT_VERIFIED'",
          )
          .get();
        assert.equal(audit.n, 1);
      },
    );
    await t.test(
      "login attempt limits are shared between application instances",
      async () => {
        f.app.set("trust proxy", 1);
        second.app.set("trust proxy", 1);
        for (let i = 0; i < 20; i++)
          assert.equal(
            (
              await call(
                "/api/auth/login",
                "POST",
                { email: "unknown@example.test", password: "incorrect" },
                "",
                i % 2 ? base : otherBase,
                { "X-Forwarded-For": "192.0.2.77" },
              )
            ).status,
            401,
          );
        assert.equal(
          (
            await call(
              "/api/auth/login",
              "POST",
              { email: "unknown@example.test", password: "incorrect" },
              "",
              otherBase,
              { "X-Forwarded-For": "192.0.2.77" },
            )
          ).status,
          429,
        );
      },
    );
    await t.test(
      "one OTP cannot authorize two simultaneous sessions",
      async () => {
        const change = await call("/api/security/2fa/change", "POST", {
          enabled: true,
          currentPassword: password,
        });
        assert.equal(change.status, 200);
        const code = mail.at(-1).text.match(/code is (\d{6})/)[1];
        assert.equal(
          (
            await call("/api/security/2fa/confirm", "POST", {
              enabled: true,
              challengeId: change.body.challengeId,
              code,
            })
          ).status,
          200,
        );
        const login = await call(
          "/api/auth/login",
          "POST",
          { email: adminEmail, password },
          "",
        );
        assert.equal(login.body.requiresOtp, true);
        const otp = mail.at(-1).text.match(/code is (\d{6})/)[1];
        const results = await Promise.all(
          [base, otherBase].map((origin) =>
            call(
              "/api/auth/otp/verify",
              "POST",
              { challengeId: login.body.challengeId, code: otp },
              "",
              origin,
            ),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
      },
    );
  },
);
