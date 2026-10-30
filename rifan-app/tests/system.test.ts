import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createTestApi as createApi } from "./database";
import {
  parseUpload,
  normalizeInput,
  suggestMapping,
} from "../src/lib/importing";
import { validate } from "../server/validation";
import { zipSync, strToU8 } from "fflate";
import XLSX from "xlsx";
let sheetValues: any[][] = [
  ["First Name", "Last Name", "Phone", "State", "LGA", "Gender", "Farm Size"],
  ["Amina", "Bello", "08012345678", "Kebbi", "Birnin Kebbi", "Female", "2"],
];
const { app, store } = await createApi({
  filename: ":memory:",
  demo: true,
  sheetsAdapter: {
    read: async () => sheetValues,
    write: async (_url, values) => {
      sheetValues = values;
    },
  },
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + (server.address() as any).port;
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await store.db.close();
});
let cookie = "",
  ownerId = "",
  farmerId = "",
  warehouseId = "",
  viewerCookie = "",
  fieldCookie = "",
  organizationId = "";
const call = async (
  url: string,
  method = "GET",
  body?: any,
  session = cookie,
) => {
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
};
const farmer = {
  firstName: "Amina",
  lastName: "Bello",
  primaryPhone: "08012345678",
  gender: "Female",
  country: "Nigeria",
  state: "Kebbi",
  lga: "Birnin Kebbi",
  farmSize: 2,
  bvn: "12345678901",
};
test("authentication, access policy, record integrity and membership workflow", async (t) => {
  await t.test("unauthenticated access is rejected", async () => {
    assert.equal((await call("/api/snapshot")).status, 401);
  });
  await t.test("first owner creates a private database workspace", async () => {
    const r = await call("/api/auth/setup", "POST", {
      name: "Test Owner",
      email: "owner@example.test",
      password: "test-password-only-123",
    });
    assert.equal(r.status, 201);
    cookie = r.cookie;
    ownerId = r.body.id;
    assert.equal(r.body.demo, false);
    assert.equal((await call("/api/auth/setup", "POST", {})).status, 409);
  });
  await t.test("cross-origin writes are rejected", async () => {
    const res = await fetch(base + "/api/settings", {
      method: "PUT",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: "{}",
    });
    assert.equal(res.status, 403);
  });
  await t.test(
    "new member validates and saves capitalized alphabetic text",
    async () => {
      const r = await call("/api/records/farmers", "POST", farmer);
      assert.equal(r.status, 201);
      assert.equal(r.body.firstName, "AMINA");
      assert.equal(r.body.lastName, "BELLO");
      assert.ok(r.body.farmerID.startsWith("RIFAN-"));
      assert.equal(r.body.latitude, undefined);
      farmerId = r.body.id;
    },
  );
  await t.test("duplicate phone and BVN are rejected", async () => {
    assert.equal(
      (await call("/api/records/farmers", "POST", farmer)).status,
      409,
    );
    assert.equal(
      (
        await call("/api/records/farmers", "POST", {
          ...farmer,
          primaryPhone: "08012345679",
        })
      ).status,
      409,
    );
  });
  await t.test(
    "bad identities, impossible dates, locations and coordinates are rejected",
    async () => {
      for (const patch of [
        { bvn: "123" },
        { nin: "123" },
        { primaryPhone: "1.2345E+10" },
        { dob: "2030-01-01" },
        { dob: "1980-02-30" },
        { latitude: 91, longitude: 7 },
        { latitude: 5 },
        { state: "Kebbi", lga: "Makurdi" },
        { farmSize: -1 },
        { plantingDate: "2026-10-01", harvestDate: "2026-09-01" },
      ])
        assert.equal(
          (await call("/api/records/farmers/" + farmerId, "PUT", patch)).status,
          400,
          JSON.stringify(Object.keys(patch)),
        );
    },
  );
  await t.test(
    "organization and programme relations prevent orphan deletion",
    async () => {
      const org = await call("/api/records/organizations", "POST", {
        name: "Kebbi Cooperative",
        type: "Cooperative",
        status: "Active",
      });
      organizationId = org.body.id;
      const p = await call("/api/records/programs", "POST", {
        name: "Rice Support",
        organizationId,
        status: "Active",
      });
      assert.equal(p.status, 201);
      assert.equal(
        (await call("/api/records/organizations/" + organizationId, "DELETE"))
          .status,
        409,
      );
      assert.equal(
        (
          await call("/api/records/farmers/" + farmerId, "PUT", {
            programId: "missing",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "warehouse ledger enforces stock and capacity boundaries",
    async () => {
      const r = await call("/api/records/warehouses", "POST", {
        name: "Kebbi Store",
        capacity: 100,
        status: "Active",
        currentInventory: 99,
      });
      assert.equal(r.status, 201);
      warehouseId = r.body.id;
      assert.equal(r.body.currentInventory, 0);
      assert.equal(
        (
          await call("/api/stock", "POST", {
            warehouseId,
            type: "Receipt",
            quantity: 60,
            reference: "receipt-1",
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await call("/api/stock", "POST", {
            warehouseId,
            type: "Receipt",
            quantity: 50,
            reference: "receipt-2",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/api/stock", "POST", {
            warehouseId,
            type: "Dispatch",
            quantity: 61,
            reference: "dispatch-1",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/api/records/warehouses/" + warehouseId, "PUT", {
            currentInventory: 0,
          })
        ).body.currentInventory,
        60,
      );
      assert.equal(
        (await call("/api/records/warehouses/" + warehouseId, "DELETE")).status,
        409,
      );
    },
  );
  await t.test(
    "payment recording requires fees and unique references; only verified funds count",
    async () => {
      const pay = {
        farmerId,
        amount: 1000,
        reference: "REF-0001",
        type: "Registration",
        method: "Bank transfer",
        period: String(new Date().getFullYear()),
      };
      assert.equal(
        (await call("/api/membership/payments", "POST", pay)).status,
        400,
      );
      await call("/api/settings", "PUT", {
        registrationFee: 1000,
        membershipFee: 2000,
      });
      const r = await call("/api/membership/payments", "POST", pay);
      assert.equal(r.status, 201);
      assert.equal(r.body.status, "Pending verification");
      assert.equal(
        (await call("/api/membership/payments", "POST", pay)).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/api/membership/payments/" + r.body.id + "/verify",
            "POST",
            { approve: true },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            "/api/membership/payments/" + r.body.id + "/verify",
            "POST",
            { approve: true },
          )
        ).status,
        409,
      );
      const f = await call("/api/farmers/" + farmerId);
      assert.equal(f.body.paymentStatus, "Part paid");
      assert.equal(
        (await call("/api/records/payments", "POST", pay)).status,
        404,
      );
      assert.equal(
        (await call("/api/records/farmers/" + farmerId, "DELETE")).status,
        409,
      );
    },
  );
  await t.test(
    "documents survive reload and are authorization protected",
    async () => {
      const upload = await call("/api/files/" + farmerId, "POST", {
        name: "test-document.pdf",
        mime: "application/pdf",
        base64: Buffer.from("%PDF-1.4\nTest fixture only").toString("base64"),
      });
      assert.equal(upload.status, 201);
      const doc = await fetch(base + "/api/files/" + upload.body.id, {
        headers: { Cookie: cookie },
      });
      assert.equal(doc.status, 200);
      assert.equal(await doc.text(), "%PDF-1.4\nTest fixture only");
      assert.equal(
        (await fetch(base + "/api/files/" + upload.body.id)).status,
        401,
      );
    },
  );
  await t.test(
    "viewer cannot mutate data and sensitive values are redacted",
    async () => {
      assert.equal(
        (
          await call("/api/users", "POST", {
            name: "Read Only",
            email: "viewer@example.test",
            password: "viewer-test-only-123",
            role: "Viewer",
          })
        ).status,
        201,
      );
      const login = await call("/api/auth/login", "POST", {
        email: "viewer@example.test",
        password: "viewer-test-only-123",
      });
      viewerCookie = login.cookie;
      assert.equal(
        (await call("/api/records/farmers", "POST", farmer, viewerCookie))
          .status,
        403,
      );
      assert.equal(
        (await call("/api/settings", "PUT", { appName: "bad" }, viewerCookie))
          .status,
        403,
      );
      const r = await call(
        "/api/farmers/" + farmerId,
        "GET",
        undefined,
        viewerCookie,
      );
      assert.equal(r.body.bvn, undefined);
      const snap = await call("/api/snapshot", "GET", undefined, viewerCookie);
      assert.equal(snap.body.activity.length, 0);
    },
  );
  await t.test(
    "geographic and organization scopes apply to queries and writes",
    async () => {
      await call("/api/users", "POST", {
        name: "Field Officer",
        email: "field@example.test",
        password: "field-test-only-123",
        role: "Field Agent",
        states: ["Kano"],
      });
      fieldCookie = (
        await call("/api/auth/login", "POST", {
          email: "field@example.test",
          password: "field-test-only-123",
        })
      ).cookie;
      assert.equal(
        (await call("/api/farmers/" + farmerId, "GET", undefined, fieldCookie))
          .status,
        404,
      );
      assert.equal(
        (await call("/api/farmers", "GET", undefined, fieldCookie)).body.total,
        0,
      );
      assert.equal(
        (
          await call(
            "/api/records/farmers",
            "POST",
            { ...farmer, primaryPhone: "08012345680", bvn: undefined },
            fieldCookie,
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "public registration stays disabled until deliberately enabled",
    async () => {
      assert.equal(
        (
          await call(
            "/api/public/applications",
            "POST",
            { ...farmer, consent: true },
            "",
          )
        ).status,
        503,
      );
    },
  );
  await t.test(
    "unconfigured AI and Google services fail honestly",
    async () => {
      assert.equal(
        (
          await call("/api/advisor", "POST", {
            messages: [{ role: "user", text: "Test" }],
          })
        ).status,
        503,
      );
      assert.equal((await call("/api/google/folders")).status, 409);
    },
  );
  await t.test("search and pagination use database-wide records", async () => {
    const r = await call("/api/farmers?q=amina&limit=1");
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 1);
    assert.equal(r.body.rows.length, 1);
    assert.equal((await call("/api/summary")).body.totalFarmers, 1);
  });
  await t.test(
    "audit trail contains mutations without secret identity values",
    async () => {
      const snap = (await call("/api/snapshot")).body;
      assert.ok(snap.activity.length > 5);
      assert.ok(!JSON.stringify(snap.activity).includes(farmer.bvn));
      assert.equal(
        snap.users.some((u: any) => "hash" in u || "salt" in u),
        false,
      );
    },
  );
});
test("CSV, ZIP and Excel parsing, staged uploads and safe sheet synchronization", async (t) => {
  await t.test(
    "CSV and ZIP are parsed with the same mapping rules",
    async () => {
      const text =
        "First Name,Last Name,Phone,State,LGA,Gender\r\nZainab,Umar,08099990001,Kano,Kura,Female\r\n";
      const csv = await parseUpload(new File([text], "members.csv"));
      assert.equal(csv.sheets[0].rows.length, 1);
      const zip = zipSync({ "members.csv": strToU8(text) });
      const parsed = await parseUpload(new File([zip], "members.zip"));
      assert.deepEqual(parsed.sheets[0].rows, csv.sheets[0].rows);
      const mapping = suggestMapping(parsed.sheets[0].headers);
      const normalized = normalizeInput(parsed.sheets[0].rows[0], mapping);
      assert.equal(
        validate("farmers", { ...normalized.data, id: "fixture" }).firstName,
        "ZAINAB",
      );
    },
  );
  await t.test(
    "a real multi-sheet Excel workbook parses with textual identity preservation",
    async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([
          {
            firstName: "Zainab",
            lastName: "Umar",
            primaryPhone: "08099990001",
            bvn: "01234567890",
            state: "Kano",
            lga: "Kura",
          },
        ]),
        "Members",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([["Label"], ["Other sheet"]]),
        "Reference",
      );
      const data = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const parsed = await parseUpload(new File([data], "real-workbook.xlsx"));
      assert.equal(parsed.sheets.length, 2);
      assert.equal(parsed.sheets[0].rows[0].bvn, "01234567890");
    },
  );
  await t.test(
    "damaged Excel is rejected without guessing missing data",
    async () => {
      await assert.rejects(
        async () =>
          await parseUpload(
            new File([new Uint8Array([80, 75, 3, 4, 0, 0])], "broken.xlsx"),
          ),
        /incomplete|damaged/,
      );
    },
  );
  await t.test(
    "legacy normalization preserves ambiguous originals and source verification claims",
    () => {
      const r = normalizeInput(
        {
          phone: "803 456 7890",
          kycComplete: "TRUE",
          regDate: "2020",
          dob: "01-Jan-80",
          irrigation: "Rainfed",
          marital: "divorce",
        },
        suggestMapping([
          "phone",
          "kycComplete",
          "regDate",
          "dob",
          "irrigation",
          "marital",
        ]),
      );
      assert.equal(r.data.primaryPhone, "08034567890");
      assert.equal(r.data.kycComplete, false);
      assert.equal(r.data.sourceKycComplete, true);
      assert.equal(r.data.registrationYear, 2020);
      assert.equal(r.data.registrationDate, undefined);
      assert.equal(r.data.dob, undefined);
      assert.equal(r.data.sourceDob, "01-Jan-80");
      assert.equal(r.data.irrigation, "Rain-fed");
    },
  );
  await t.test(
    "full upload preserves invalid and duplicate source rows and commits valid records once",
    async () => {
      const batchId = "test-batch-1";
      const valid = {
        ...farmer,
        primaryPhone: "08099990001",
        bvn: undefined,
        firstName: "Zainab",
        lastName: "Umar",
        state: "Kano",
        lga: "Kura",
      };
      const rows = [
        { sourceRow: 2, raw: valid, data: valid },
        { sourceRow: 3, raw: valid, data: valid },
        {
          sourceRow: 4,
          raw: { phone: "broken" },
          data: { ...valid, primaryPhone: "broken" },
        },
      ];
      const stage = await call("/api/import/stage", "POST", {
        batchId,
        source: "test.csv",
        rows,
      });
      assert.equal(stage.status, 200);
      assert.equal(stage.body.staged, 3);
      assert.equal(stage.body.invalid, 1);
      const repeat = await call("/api/import/stage", "POST", {
        batchId,
        source: "test.csv",
        rows,
      });
      assert.equal(repeat.body.staged, 0);
      const commit = await call(
        "/api/import/staged/" + batchId + "/commit",
        "POST",
        {},
      );
      assert.equal(commit.body.summary.Imported, 1);
      assert.equal(commit.body.summary.Duplicate, 1);
      assert.equal(commit.body.summary.Invalid, 1);
      assert.equal(
        (await call("/api/import/staged/" + batchId + "/commit", "POST", {}))
          .body.imported,
        0,
      );
      assert.equal(
        (await call("/api/import/issues/" + batchId)).body.rows.length,
        2,
      );
    },
  );
  await t.test(
    "Google Sheets source previews additions and updates, then persists reviewed changes",
    async () => {
      sheetValues = [
        [
          "First Name",
          "Last Name",
          "Phone",
          "State",
          "LGA",
          "Gender",
          "Farm Size",
        ],
        [
          "Amina",
          "Bello",
          "08012345678",
          "Kebbi",
          "Birnin Kebbi",
          "Female",
          "3",
        ],
        ["Maryam", "Adamu", "08099990002", "Kano", "Kura", "Female", "4"],
        ["Broken", "Record", "bad", "Kano", "Kura", "Female", "4"],
      ];
      const preview = await call("/api/google/sheets/sync/preview", "POST", {
        url: "https://docs.google.com/spreadsheets/d/test-sheet/edit",
      });
      assert.equal(preview.status, 200);
      assert.equal(preview.body.updates, 1);
      assert.equal(preview.body.additions, 1);
      assert.equal(preview.body.invalid, 1);
      const commit = await call("/api/google/sheets/sync/commit", "POST", {
        previewId: preview.body.previewId,
      });
      assert.equal(commit.status, 200);
      assert.equal(commit.body.updated, 1);
      assert.equal(commit.body.created, 1);
      assert.equal((await call("/api/farmers/" + farmerId)).body.farmSize, 3);
      assert.equal(
        (
          await call("/api/google/sheets/sync/commit", "POST", {
            previewId: preview.body.previewId,
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "sheet synchronization refuses to overwrite a member edited after preview",
    async () => {
      const p = await call("/api/google/sheets/sync/preview", "POST", {
        url: "https://docs.google.com/spreadsheets/d/test-sheet/edit",
      });
      await call("/api/records/farmers/" + farmerId, "PUT", { farmSize: 8 });
      const r = await call("/api/google/sheets/sync/commit", "POST", {
        previewId: p.body.previewId,
      });
      assert.equal(r.status, 409);
      assert.equal((await call("/api/farmers/" + farmerId)).body.farmSize, 8);
    },
  );
  await t.test(
    "Google Sheets database adapter exports the member registry without private identity fields",
    async () => {
      const r = await call("/api/google/sheets/export", "POST", {
        url: "https://docs.google.com/spreadsheets/d/test-sheet/edit",
      });
      assert.equal(r.status, 200);
      assert.ok(r.body.count >= 3);
      assert.equal(r.body.worksheet, "RIFAN Registry");
      assert.ok(sheetValues[0].includes("primaryPhone"));
      assert.ok(!sheetValues[0].includes("bvn"));
      assert.ok(sheetValues.length > 1);
    },
  );
  await t.test(
    "membership-card export returns only authorized non-sensitive profile fields",
    async () => {
      const r = await call("/api/cards/records", "POST", { ids: [farmerId] });
      assert.equal(r.status, 200);
      assert.equal(r.body.length, 1);
      assert.equal(r.body[0].bvn, undefined);
      assert.equal(r.body[0].nin, undefined);
      assert.ok(r.body[0].farmerID);
      assert.equal(
        (
          await call(
            "/api/cards/records",
            "POST",
            { ids: [farmerId] },
            fieldCookie,
          )
        ).status,
        404,
      );
      assert.equal(
        (await call("/api/cards/records", "POST", { ids: [] })).status,
        400,
      );
    },
  );
  await t.test(
    "source review correction preserves original data and reruns full validation",
    async () => {
      const r = await call("/api/import/review/test-batch-1");
      assert.equal(r.status, 200);
      assert.equal(r.body.total, 2);
      const corrected = await call(
        "/api/import/correct/test-batch-1/4",
        "PUT",
        {
          ...farmer,
          firstName: "Corrected",
          lastName: "Record",
          primaryPhone: "08099990003",
          bvn: undefined,
        },
      );
      assert.equal(corrected.status, 200);
      assert.equal(corrected.body.firstName, "CORRECTED");
      assert.equal(corrected.body.kycComplete, false);
      const raw = (await store.db
        .prepare(
          "SELECT raw FROM source_records WHERE batch_id='test-batch-1' AND source_row=4",
        )
        .get()) as any;
      assert.equal(JSON.parse(raw.raw).phone, "broken");
    },
  );
  await t.test(
    "duplicate mapping targets and forged document content are rejected",
    async () => {
      assert.throws(
        () =>
          normalizeInput(
            { a: "one", b: "two" },
            { a: "firstName", b: "firstName" },
          ),
        /only once/,
      );
      assert.equal(
        (
          await call("/api/files/" + farmerId, "POST", {
            name: "fake.pdf",
            mime: "application/pdf",
            base64: Buffer.from("not a PDF").toString("base64"),
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "demo records remain isolated from the private database",
    async () => {
      const demo = (await call("/api/auth/demo", "POST", {}, "")).cookie;
      assert.equal(
        (await call("/api/summary", "GET", undefined, demo)).body.totalFarmers,
        84,
      );
      assert.notEqual((await call("/api/summary")).body.totalFarmers, 84);
    },
  );
});
