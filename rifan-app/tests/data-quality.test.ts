import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createTestApi as createApi } from "./database";
import { normalizeInput, suggestMapping } from "../src/lib/importing";
import { validate } from "../server/validation";
import { normalizePhone, canonicalPhone } from "../src/lib/phone";
import {
  sourceCandidate,
  reconcileImport,
} from "../server/features/data-quality";
let sheetRows: any[][] = [];
const { app, store } = await createApi({
  filename: ":memory:",
  demo: false,
  sheetsAdapter: { read: async () => sheetRows, write: async () => {} },
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + (server.address() as any).port;
let cookie = "";
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await store.db.close();
});
async function call(url: string, method = "GET", body?: any, session = cookie) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", Cookie: session },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as any,
    cookie: res.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
const farmer = {
  firstName: "Fixture",
  lastName: "Farmer",
  primaryPhone: "08012345678",
  state: "Kebbi",
  lga: "Birnin Kebbi",
  country: "Nigeria",
  gender: "Female",
  crop: "Rice",
};
test("non-lossy contact normalization and identity rules", () => {
  assert.equal(normalizePhone("0801 (234) 5678"), "08012345678");
  assert.equal(normalizePhone("8034567890"), "08034567890");
  assert.equal(normalizePhone("7123456789", "Kenya"), "7123456789");
  assert.equal(canonicalPhone("+2348012345678"), canonicalPhone("08012345678"));
  assert.equal(
    normalizeInput({ phone: "8.01235E+09" }, suggestMapping(["phone"])).data
      .primaryPhone,
    "8.01235E+09",
  );
  assert.throws(
    () => validate("farmers", { ...farmer, primaryPhone: "8.01235E+09" }),
    /scientific notation/,
  );
  assert.throws(
    () => validate("farmers", { ...farmer, primaryPhone: 8012345678 }),
    /as text/,
  );
  assert.throws(() => validate("farmers", { ...farmer, bvn: 12345678901 }));
  assert.equal(
    validate("farmers", { ...farmer, bvn: " 01234567890 " }).bvn,
    "01234567890",
  );
});
test("whole-database checks, preserved mappings and repeat-safe revalidation", async (t) => {
  await t.test(
    "owner initializes and equivalent contact formats cannot duplicate a member",
    async () => {
      const setup = await call("/api/auth/setup", "POST", {
        name: "Fixture owner",
        email: "quality@example.test",
        password: "fixture-password-123",
      });
      assert.equal(setup.status, 201);
      cookie = setup.cookie;
      assert.equal(
        (await call("/api/records/farmers", "POST", farmer)).status,
        201,
      );
      assert.equal(
        (
          await call("/api/records/farmers", "POST", {
            ...farmer,
            primaryPhone: "+2348012345678",
          })
        ).status,
        409,
      );
      const preview = await call("/api/import/preview", "POST", {
        rows: [
          { ...farmer, primaryPhone: "08022345678" },
          { ...farmer, primaryPhone: "+2348022345678" },
        ],
      });
      assert.equal(preview.body.duplicates, 1);
    },
  );
  await t.test(
    "staging retains submitted custom mapping even when validation fails",
    async () => {
      const data = { ...farmer, primaryPhone: "8.33333E+09" };
      const raw = {
        "Custom Name": "Fixture source",
        "Custom Phone": "8.33333E+09",
      };
      const r = await call("/api/import/stage", "POST", {
        batchId: "quality-batch",
        source: "Fixture",
        rows: [{ sourceRow: 2, raw, data }],
      });
      assert.equal(r.status, 200);
      const source = (await store.db
        .prepare("SELECT * FROM source_records WHERE batch_id='quality-batch'")
        .get()) as any;
      assert.deepEqual(JSON.parse(source.raw), raw);
      assert.deepEqual(JSON.parse(source.submitted), data);
      const recheck = await call("/api/data-quality/recheck", "POST", {});
      assert.equal(recheck.body.invalid, 1);
      assert.equal(recheck.body.ready, 0);
      assert.deepEqual(
        JSON.parse(
          (
            (await store.db
              .prepare("SELECT raw FROM source_records WHERE id=?")
              .get(source.id)) as any
          ).raw,
        ),
        raw,
      );
      assert.throws(
        () => sourceCandidate({ raw: JSON.stringify(raw) }),
        /custom mapping/,
      );
    },
  );
  await t.test(
    "old recoverable rows are revalidated and imported once, with exact ledger counts",
    async () => {
      await store.put("workspace", "imports", {
        id: "legacy-batch",
        count: 999,
        status: "Completed with review",
      });
      const row = { ...farmer, primaryPhone: "08032345678" };
      await store.db
        .prepare(
          "INSERT INTO source_records(batch_id,space,source_row,raw,status,reason) VALUES(?,?,?,?,?,?)",
        )
        .run(
          "legacy-batch",
          "workspace",
          2,
          JSON.stringify(row),
          "Invalid",
          "Old validation rule",
        );
      let r = await call("/api/data-quality/recheck", "POST", {
        batchId: "legacy-batch",
      });
      assert.equal(r.body.ready, 1, JSON.stringify(r.body));
      assert.equal(
        (await store.get("workspace", "imports", "legacy-batch"))?.status,
        "Ready to import",
      );
      r = await call("/api/import/staged/legacy-batch/commit", "POST", {});
      assert.equal(r.body.imported, 1);
      assert.equal(
        (await store.get("workspace", "imports", "legacy-batch"))?.count,
        1,
      );
      assert.equal(
        (await store.get("workspace", "imports", "legacy-batch"))?.status,
        "Completed",
      );
      assert.equal(
        (await call("/api/import/staged/legacy-batch/commit", "POST", {})).body
          .imported,
        0,
      );
      assert.equal(
        (
          await call("/api/data-quality/recheck", "POST", {
            batchId: "legacy-batch",
          })
        ).body.checked,
        0,
      );
    },
  );
  await t.test(
    "summary distinguishes unknown evidence and audits the whole registry without mutating it",
    async () => {
      const summary = await call("/api/data-quality");
      assert.equal(summary.body.farmers.total, 2);
      assert.equal(summary.body.farmers.missingCoordinates, 2);
      assert.equal(summary.body.orphanedSources, 0);
      assert.equal(summary.body.duplicateGroups.primaryPhone, 0);
      const records = await store.all("workspace", "farmers");
      const audit = await call("/api/data-quality/audit", "POST", {});
      assert.equal(audit.body.valid, 2);
      assert.equal(audit.body.needsReview, 0);
      assert.deepEqual(await store.all("workspace", "farmers"), records);
      assert.equal(
        (await call("/api/data-quality/audit", "POST", { version: "stale" }))
          .status,
        409,
      );
      assert.equal(
        (await call("/api/data-quality/recheck", "POST", { afterId: -1 }))
          .status,
        400,
      );
      assert.equal(
        (await call("/api/data-quality", "GET", undefined, "")).status,
        401,
      );
    },
  );
  await t.test(
    "Google Sheets preserves blank-row positions, rejected originals and equivalent phones",
    async () => {
      sheetRows = [
        ["firstName", "lastName", "primaryPhone", "state", "lga", "gender"],
        [
          "Fixture",
          "Farmer",
          "+2348012345678",
          "Kebbi",
          "Birnin Kebbi",
          "Female",
        ],
        [],
        ["Broken", "Source", "8.12345E+09", "Kebbi", "Birnin Kebbi", "Female"],
        ["New", "Member", "08042345678", "Kebbi", "Birnin Kebbi", "Female"],
        ["New", "Member", "+2348042345678", "Kebbi", "Birnin Kebbi", "Female"],
      ];
      const preview = await call("/api/google/sheets/sync/preview", "POST", {
        url: "https://docs.google.com/spreadsheets/d/quality-fixture/edit",
      });
      assert.equal(preview.status, 200);
      assert.equal(preview.body.updates, 1);
      assert.equal(preview.body.additions, 1);
      assert.equal(preview.body.invalid, 2);
      assert.equal(preview.body.rows[1].sourceRow, 4);
      assert.equal(preview.body.rows[1].submitted, undefined);
      const applied = await call("/api/google/sheets/sync/commit", "POST", {
        previewId: preview.body.previewId,
      });
      assert.equal(applied.status, 200, JSON.stringify(applied.body));
      const rows = (await store.db
        .prepare(
          "SELECT * FROM source_records WHERE batch_id=? ORDER BY source_row",
        )
        .all("sheet-preview-" + preview.body.previewId)) as any[];
      assert.equal(rows.length, 4);
      assert.equal(rows[1].status, "Invalid");
      assert.equal(JSON.parse(rows[1].raw).primaryPhone, "8.12345E+09");
      assert.equal(JSON.parse(rows[1].submitted).primaryPhone, "8.12345E+09");
      assert.equal(
        (
          await store.get(
            "workspace",
            "imports",
            "sheet-preview-" + preview.body.previewId,
          )
        )?.status,
        "Completed with review",
      );
    },
  );
  await t.test(
    "an original damaged-file failure is not relabelled completed",
    async () => {
      await store.put("workspace", "imports", {
        id: "damaged-file",
        status: "Rejected",
        count: 0,
      });
      await reconcileImport(store, "workspace", "damaged-file");
      assert.equal(
        (await store.get("workspace", "imports", "damaged-file"))?.status,
        "Rejected",
      );
    },
  );
  await t.test(
    "viewers and scoped managers cannot inspect unscoped source quality",
    async () => {
      for (const [role, email, scope] of [
        ["Viewer", "viewer@example.test", {}],
        ["Manager", "scoped@example.test", { states: ["Kebbi"] }],
      ] as const) {
        const user = await call("/api/users", "POST", {
          name: "Fixture reviewer",
          email,
          password: "fixture-password-123",
          role,
          ...scope,
        });
        assert.equal(user.status, 201, JSON.stringify(user.body));
        const login = await call(
          "/api/auth/login",
          "POST",
          { email, password: "fixture-password-123" },
          "",
        );
        assert.equal(
          (await call("/api/data-quality", "GET", undefined, login.cookie))
            .status,
          403,
        );
        assert.equal(
          (await call("/api/data-quality/recheck", "POST", {}, login.cookie))
            .status,
          403,
        );
      }
    },
  );
});
