import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createTestApi as createApi } from "./database";
import { analyse } from "../server/features/intelligence";
import { validateBoundary } from "../server/features/operations";
const mail: any[] = [];
let paid: any = {};
const secret = "fixture-secret-never-a-live-key";
const { app, store } = await createApi({
  filename: ":memory:",
  demo: true,
  mailer: {
    send: async (m) => {
      mail.push(m);
    },
  },
  paystackSecret: secret,
  paystack: {
    initialize: async (p) => {
      paid = { ...p, status: "success", id: 100 };
      return { authorization_url: "https://checkout.paystack.com/fixture" };
    },
    verify: async (reference) => ({ ...paid, reference }),
  },
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + (server.address() as any).port;
let cookie = "",
  space = "",
  farmerId = "",
  programId = "",
  seasonId = "",
  interventionId = "",
  ownerId = "";
const password = "fixture-password-12345";
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await store.db.close();
});
async function call(
  path: string,
  method = "GET",
  body?: any,
  session = cookie,
) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: session },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    body: (await r.json()) as any,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function create(entity: string, row: any) {
  const r = await call("/api/records/" + entity, "POST", row);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
test("connected programme, cohort, history, planner and payment workflows", async (t) => {
  await t.test("create private workspace and hierarchy", async () => {
    const r = await call("/api/auth/setup", "POST", {
      name: "Fixture Owner",
      email: "fixture@example.test",
      password,
    });
    assert.equal(r.status, 201);
    cookie = r.cookie;
    ownerId = r.body.id;
    space = r.body.space;
    farmerId = (
      await create("farmers", {
        firstName: "Amina",
        lastName: "Bello",
        primaryPhone: "08012345678",
        state: "Kebbi",
        lga: "Birnin Kebbi",
        country: "Nigeria",
        gender: "Female",
        farmSize: 2,
        crop: "Rice",
      })
    ).id;
    programId = (
      await create("programs", { name: "Fixture programme", status: "Active" })
    ).id;
    seasonId = (
      await create("seasons", {
        name: "Fixture season",
        programId,
        type: "Wet",
        year: 2026,
        crop: "Rice",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "Active",
      })
    ).id;
    interventionId = (
      await create("interventions", {
        name: "Fixture support",
        programId,
        seasonId,
        type: "Seed support",
        dateApplied: "2026-02-01",
        status: "Planned",
      })
    ).id;
  });
  await t.test(
    "bulk enrolment is repeat-safe and appears in farmer history",
    async () => {
      const preview = await call("/api/operations/cohorts/preview", "POST", {
        target: { interventionId },
        filters: { crop: "Rice" },
      });
      assert.equal(preview.status, 200, JSON.stringify(preview.body));
      assert.equal(preview.body.eligible, 1);
      let r = await call(
        "/api/operations/cohorts/" + preview.body.jobId + "/commit",
        "POST",
        {},
      );
      assert.equal(r.status, 200);
      assert.equal(r.body.enrolled, 1);
      r = await call(
        "/api/operations/cohorts/" + preview.body.jobId + "/commit",
        "POST",
        {},
      );
      assert.equal(r.body.enrolled, 0);
      const again = await call("/api/operations/cohorts/preview", "POST", {
        target: { interventionId },
        filters: { crop: "Rice" },
      });
      assert.equal(again.body.duplicates, 1);
      const h = await call("/api/history/farmers/" + farmerId);
      assert.equal(h.body.related.participations.length, 1);
      assert.equal(h.body.related.seasons[0].id, seasonId);
      assert.equal(
        (await call("/api/records/participations", "POST", { farmerId }))
          .status,
        404,
      );
    },
  );
  await t.test(
    "historical farm observations and editable tasks remain linked",
    async () => {
      const location = await create("farmLocations", {
        farmerId,
        programId,
        seasonId,
        interventionId,
        state: "Kano",
        lga: "Kura",
        crop: "Rice",
        farmSize: 2,
        latitude: 11.77,
        longitude: 8.43,
        address: "Fixture field",
        observedAt: "2026-03-01",
      });
      assert.equal(
        (
          await call("/api/records/farmLocations/" + location.id, "PUT", {
            address: "Overwrite",
          })
        ).status,
        409,
      );
      const task = await create("harvestTasks", {
        name: "Harvest fixture",
        programId,
        seasonId,
        interventionId,
        farmerId,
        locationId: location.id,
        stage: "Harvest",
        startDate: "2026-10-01",
        endDate: "2026-10-02",
        status: "Planned",
        expectedYield: 5000,
      });
      const edit = await call("/api/records/harvestTasks/" + task.id, "PUT", {
        ...task,
        status: "Completed",
        actualYield: 4800,
        expectedUpdatedAt: task.updatedAt,
      });
      assert.equal(edit.status, 200, JSON.stringify(edit.body));
      const h = await call("/api/history/harvestTasks/" + task.id);
      assert.ok(h.body.versions.length >= 2);
      const calendar = await call("/api/operations/calendar?month=2026-10");
      assert.equal(calendar.body.length, 1);
      const ics = await fetch(base + "/api/operations/calendar.ics", {
        headers: { Cookie: cookie },
      });
      assert.match(await ics.text(), /DTEND;VALUE=DATE:20261003/);
      const history = await call("/api/history/farmers/" + farmerId);
      assert.equal(history.body.related.farmLocations[0].state, "Kano");
    },
  );
  await t.test("relationship and geometry errors are rejected", async () => {
    const r = await call("/api/records/interventions", "POST", {
      name: "Bad",
      programId: "missing",
      seasonId,
      dateApplied: "2026-01-01",
    });
    assert.equal(r.status, 400);
    assert.throws(() =>
      validateBoundary({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [0, 1],
            [1, 0],
          ],
        ],
      }),
    );
    assert.throws(() =>
      validateBoundary({ type: "Point", coordinates: [8, 9] }),
    );
    assert.ok(
      validateBoundary({
        type: "Polygon",
        coordinates: [
          [
            [8, 9],
            [8, 10],
            [9, 10],
            [8, 9],
          ],
        ],
      }),
    );
  });
  await t.test(
    "provider verification checks amount, signature and replay",
    async () => {
      await call("/api/settings", "PUT", {
        registrationFee: 1000,
        membershipFee: 0,
      });
      const init = await call("/api/payments/paystack/initialize", "POST", {
        farmerId,
        type: "Registration",
        email: "payer@example.test",
        amount: 1,
      });
      assert.equal(init.status, 201, JSON.stringify(init.body));
      assert.equal(paid.amount, 100000);
      const reference = init.body.reference;
      paid.amount = 1;
      assert.equal(
        (
          await call(
            "/api/payments/paystack/" + reference + "/verify",
            "POST",
            {},
          )
        ).status,
        409,
      );
      paid.amount = 100000;
      const raw = JSON.stringify({
        event: "charge.success",
        data: { reference },
      });
      let response = await fetch(base + "/api/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": "0".repeat(128),
        },
        body: raw,
      });
      assert.equal(response.status, 401);
      for (let i = 0; i < 2; i++) {
        response = await fetch(base + "/api/paystack/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-paystack-signature": createHmac("sha512", secret)
              .update(raw)
              .digest("hex"),
          },
          body: raw,
        });
        assert.equal(response.status, 200, await response.text());
      }
      const ledger = await call("/api/operations/records/payments");
      assert.equal(ledger.body.rows.length, 1);
      assert.equal(ledger.body.rows[0].status, "Verified");
    },
  );
  await t.test(
    "failed-source export contains every row and reasons beyond the review page",
    async () => {
      const actor = (await store.db
        .prepare("SELECT space FROM users WHERE id=?")
        .get(ownerId)) as any;
      await store.put(actor.space, "imports", {
        id: "failure-fixture",
        name: "Synthetic source",
      });
      await store.transaction(async () => {
        const stmt = store.db.prepare(
          "INSERT INTO source_records(batch_id,space,source_row,raw,status,reason) VALUES(?,?,?,?,?,?)",
        );
        for (let i = 1; i <= 751; i++)
          await stmt.run(
            "failure-fixture",
            actor.space,
            i,
            JSON.stringify({ name: "Synthetic row " + i }),
            i % 2 ? "Invalid" : "Duplicate",
            i === 1 ? "=unsafe-formula" : "Missing required field",
          );
      });
      const response = await fetch(
        base + "/api/import/failures/failure-fixture.csv",
        { headers: { Cookie: cookie } },
      );
      assert.equal(response.status, 200);
      const csv = await response.text();
      assert.equal(csv.trim().split("\r\n").length, 752);
      assert.match(csv, /'=unsafe-formula/);
      assert.match(csv, /Synthetic row 751/);
      assert.equal(
        (await fetch(base + "/api/import/failures/failure-fixture.csv")).status,
        401,
      );
    },
  );
  await t.test(
    "planner privileges are enforced for field agents until approved",
    async () => {
      const user = await call("/api/users", "POST", {
        name: "Fixture officer",
        email: "officer@example.test",
        password,
        role: "Field Agent",
      });
      assert.equal(user.status, 201, JSON.stringify(user.body));
      let login = await call(
        "/api/auth/login",
        "POST",
        { email: "officer@example.test", password },
        "",
      );
      const task = {
        name: "Officer activity",
        programId,
        seasonId,
        stage: "Scouting",
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "Planned",
      };
      assert.equal(
        (await call("/api/records/harvestTasks", "POST", task, login.cookie))
          .status,
        403,
      );
      const updated = await call("/api/users/" + user.body.id, "PUT", {
        plannerApproved: true,
      });
      assert.equal(updated.status, 200, JSON.stringify(updated.body));
      login = await call(
        "/api/auth/login",
        "POST",
        { email: "officer@example.test", password },
        "",
      );
      assert.equal(
        (await call("/api/records/harvestTasks", "POST", task, login.cookie))
          .status,
        201,
      );
      assert.equal(
        (
          await call(
            "/api/records/fieldValidations",
            "POST",
            {
              farmerId,
              programId,
              seasonId,
              state: "Kebbi",
              lga: "Birnin Kebbi",
              validationDate: "2026-03-01",
              status: "Verified",
              crop: "Rice",
              notes: "Synthetic field evidence",
            },
            login.cookie,
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "OTP enablement, password challenge and single-use login",
    async () => {
      let r = await call("/api/security/2fa/change", "POST", {
        enabled: true,
        currentPassword: password,
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const code = mail.at(-1).text.match(/code is (\d{6})/)[1];
      assert.match(mail.at(-1).html, /#194c2b/);
      assert.equal(
        (
          await call("/api/security/2fa/confirm", "POST", {
            enabled: true,
            challengeId: r.body.challengeId,
            code: "abcdef",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/api/security/2fa/confirm", "POST", {
            enabled: true,
            challengeId: r.body.challengeId,
            code,
          })
        ).status,
        200,
      );
      assert.equal((await call("/api/snapshot")).status, 401);
      r = await call(
        "/api/auth/login",
        "POST",
        { email: "fixture@example.test", password },
        "",
      );
      assert.equal(r.body.requiresOtp, true);
      assert.equal(r.cookie, "");
      const loginCode = mail.at(-1).text.match(/code is (\d{6})/)[1];
      const verified = await call(
        "/api/auth/otp/verify",
        "POST",
        { challengeId: r.body.challengeId, code: loginCode },
        "",
      );
      assert.equal(verified.status, 200);
      cookie = verified.cookie;
      assert.equal(
        (
          await call(
            "/api/auth/otp/verify",
            "POST",
            { challengeId: r.body.challengeId, code: loginCode },
            "",
          )
        ).status,
        401,
      );
    },
  );
});
test("forecast requires measured history and does not fabricate yield", () => {
  const input = {
    farmers: [],
    locations: [],
    tasks: [],
    validations: [],
    participations: [],
    seasons: [],
  };
  assert.equal(analyse(input).forecast.medianKgPerHa, null);
  const measured = {
    ...input,
    locations: [
      { id: "a", farmSize: 2 },
      { id: "b", farmSize: 2 },
      { id: "c", farmSize: 2 },
    ],
    tasks: ["a", "b", "c"].map((id, i) => ({
      id,
      locationId: id,
      farmerId: id,
      seasonId: "s",
      stage: "Harvest",
      status: "Completed",
      actualYield: 4000 + i * 1000,
    })),
  };
  assert.equal(analyse(measured).forecast.medianKgPerHa, 2500);
});
