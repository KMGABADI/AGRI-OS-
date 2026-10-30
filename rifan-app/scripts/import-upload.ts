/** Import authorized uploaded files through the same staging/commit HTTP API used by the UI.
 * Never prints source values. Raw rows are retained in the private source_records archive.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { createApi } from "../server/api";
import {
  parseUpload,
  suggestMapping,
  normalizeInput,
} from "../src/lib/importing";
const file = process.argv[2];
if (!file) throw new Error("Pass a local spreadsheet or ZIP path");
const { app, store } = await createApi({
  filename: process.env.RIFAN_DB_PATH || ".data/rifan.sqlite",
  demo: false,
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as {
  port: number;
};
const base = `http://127.0.0.1:${address.port}`;
const token = randomBytes(32).toString("hex"),
  id = "import-service-" + randomUUID();
const actor = {
  id,
  name: "AUTHORIZED DATA IMPORT",
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
    Date.now() + 3600000,
    JSON.stringify(actor),
  );
const call = async (url: string, body: any) => {
  const r = await fetch(base + url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "rifan_session=" + token,
    },
    body: JSON.stringify(body),
  });
  const out = (await r.json()) as any;
  if (!r.ok)
    throw new Error(
      `Import endpoint ${url} failed (${r.status}): ${out.error}`,
    );
  return out;
};
const report: any = {
  source: path.basename(file),
  sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
  startedAt: new Date().toISOString(),
  worksheets: [],
};
try {
  mkdirSync(".data/source", { recursive: true, mode: 0o700 });
  const preserved = path.join(".data/source", path.basename(file));
  if (path.resolve(file) !== path.resolve(preserved))
    copyFileSync(file, preserved);
  chmodSync(preserved, 0o600);
  let parsed;
  try {
    parsed = await parseUpload(
      new File([readFileSync(file)], path.basename(file)),
    );
  } catch (e: any) {
    report.status = "Blocked: invalid source file";
    report.error = e.message;
    await store.put("workspace", "imports", {
      id: "blocked-" + report.sha256.slice(0, 20),
      name: report.source,
      date: new Date().toISOString(),
      status: "Blocked: damaged workbook",
      count: 0,
      summary: { SourceFile: 1 },
    });
    console.log(
      JSON.stringify({
        source: report.source,
        status: report.status,
        error: report.error,
      }),
    );
    throw e;
  }
  for (const sheet of parsed.sheets) {
    const batchId =
      "file-" + report.sha256.slice(0, 24) + "-" + parsed.sheets.indexOf(sheet);
    const mapping = suggestMapping(sheet.headers);
    const total = sheet.rows.length;
    console.log(
      JSON.stringify({
        source: report.source,
        worksheet: sheet.name,
        rows: total,
        encoding: parsed.encoding,
        batchId,
      }),
    );
    const previous = (await store.db
      .prepare("SELECT count(*) AS n FROM source_records WHERE batch_id=?")
      .get(batchId)) as any;
    const reviewRows = new Set(
      (
        (await store.db
          .prepare(
            "SELECT source_row FROM source_records WHERE batch_id=? AND status='Invalid'",
          )
          .all(batchId)) as any[]
      ).map((r) => r.source_row),
    );
    for (let offset = 0; offset < total; offset += 500) {
      const chunk = sheet.rows
        .slice(offset, offset + 500)
        .map((raw, i) => ({
          sourceRow: offset + i + 2,
          raw,
          data: normalizeInput(raw, mapping).data,
        }))
        .filter((r) => !previous.n || reviewRows.has(r.sourceRow));
      if (!chunk.length) continue;
      await call("/api/import/stage", {
        batchId,
        source: report.source,
        revalidate: true,
        rows: chunk,
      });
      if (offset % 10000 === 0)
        console.log(
          JSON.stringify({
            phase: "staging",
            processed: Math.min(offset + 500, total),
            total,
          }),
        );
    }
    let remaining = 1,
      result: any;
    while (remaining) {
      result = await call("/api/import/staged/" + batchId + "/commit", {});
      remaining = result.remaining;
      if (remaining % 10000 < 1000)
        console.log(
          JSON.stringify({
            phase: "committing",
            remaining,
            counts: result.summary,
          }),
        );
    }
    const issueCounts = await store.db
      .prepare(
        "SELECT reason,count(*) AS count FROM source_records WHERE batch_id=? AND status='Invalid' GROUP BY reason ORDER BY count DESC",
      )
      .all(batchId);
    report.worksheets.push({
      name: sheet.name,
      batchId,
      rows: total,
      summary: result.summary,
      validationReasons: issueCounts,
      idempotentRerun: previous.n > 0,
    });
    console.log(
      JSON.stringify({
        phase: "complete",
        summary: result.summary,
        rows: total,
      }),
    );
  }
  report.status = "Completed with retained review records";
} catch (e: any) {
  report.error = e.message;
  report.status ||= "Failed";
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  const name = report.sha256.slice(0, 20) + "-report.json";
  writeFileSync(
    path.join(".data/source", name),
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  await store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  await store.db.prepare("DELETE FROM users WHERE id=?").run(id);
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  await store.db.close();
  console.log(
    JSON.stringify({
      report: path.join(".data/source", name),
      status: report.status,
    }),
  );
}
