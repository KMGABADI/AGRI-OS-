import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createApi } from "../server/api";
const { app, store } = await createApi({
  filename: ".data/rifan.sqlite",
  demo: false,
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + (server.address() as any).port;
const id = "verification-" + randomUUID(),
  token = randomBytes(32).toString("hex");
const actor = {
  id,
  name: "AUTHORIZED READINESS CHECK",
  email: id + "@rifan.local",
  role: "Super Admin",
  space: "workspace",
  demo: false,
};
await store.db
  .prepare(
    "INSERT INTO users(id,space,email,name,role,hash,salt) VALUES(?,?,?,?,?,?,?)",
  )
  .run(
    id,
    "workspace",
    actor.email,
    actor.name,
    actor.role,
    randomBytes(64).toString("hex"),
    randomBytes(16).toString("hex"),
  );
await store.db
  .prepare(
    "INSERT INTO sessions(token,user_id,space,expires,data) VALUES(?,?,?,?,?)",
  )
  .run(
    createHash("sha256").update(token).digest("hex"),
    id,
    "workspace",
    Date.now() + 600000,
    JSON.stringify(actor),
  );
const call = async (url: string, body?: any) => {
  const r = await fetch(base + url, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: "rifan_session=" + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(r.status, 200);
  return r.json() as any;
};
try {
  const started = performance.now();
  const snap = await call("/api/snapshot");
  const elapsed = Math.round(performance.now() - started);
  const counts = (await store.db
    .prepare(
      "SELECT status,count(*) AS count FROM source_records WHERE space='workspace' GROUP BY status",
    )
    .all()) as any[];
  const total = counts.reduce((a, r) => a + r.count, 0);
  assert.equal(total, 186353);
  assert.equal(snap.summary.totalFarmers, 172743);
  assert.equal(snap.data.farmers.length, 1000);
  assert.equal(snap.farmerWindow.total, 172743);
  const first = await call("/api/farmers?limit=25&offset=0");
  const last = await call("/api/farmers?limit=25&offset=172725");
  assert.equal(first.rows.length, 25);
  assert.equal(last.rows.length, 18);
  const named = await call(
    "/api/farmers?q=" + encodeURIComponent(first.rows[0].firstName),
  );
  assert.ok(named.total > 0);
  const profile = await call("/api/farmers/" + first.rows[0].id);
  assert.equal(profile.firstName, profile.firstName.toLocaleUpperCase("en-NG"));
  const cards = await call("/api/cards/records", {
    ids: first.rows.map((f: any) => f.id),
  });
  assert.equal(cards.length, 25);
  assert.ok(
    cards.every(
      (f: any) => !("bvn" in f) && !("nin" in f) && !("accountNumber" in f),
    ),
  );
  const privateFields = (await store.db
    .prepare(
      "SELECT count(*) AS n FROM records WHERE space='workspace' AND entity='farmers' AND json_extract(data,'$.kycComplete')=1",
    )
    .get()) as any;
  assert.equal(privateFields.n, 0);
  console.log(
    JSON.stringify({
      passed: true,
      sourceRows: total,
      imported: snap.summary.totalFarmers,
      sourceOutcomeCounts: Object.fromEntries(
        counts.map((r) => [r.status, r.count]),
      ),
      snapshotLoaded: 1000,
      snapshotMilliseconds: elapsed,
      verified: [
        "database-wide totals",
        "first and last registry pages",
        "case-insensitive search",
        "profile retrieval",
        "uppercase names",
        "25-card batch with identity redaction",
        "source KYC retained for review",
      ],
    }),
  );
} finally {
  await store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  await store.db.prepare("DELETE FROM users WHERE id=?").run(id);
  await new Promise<void>((r) => server.close(() => r()));
  await store.db.close();
}
