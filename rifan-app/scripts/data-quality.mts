import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "../server/database.ts";
import {
  dataQualitySummary,
  recheckSources,
  reconcileImport,
} from "../server/features/data-quality.ts";
import { validate } from "../server/validation.ts";
import { phoneKeys } from "../src/lib/phone.ts";
import type { Session, Row } from "../src/model.ts";
const filename = path.resolve(
  process.env.RIFAN_DB_PATH || ".data/rifan.sqlite",
);
const space = process.env.RIFAN_DATA_SPACE || "workspace",
  apply = process.argv.includes("--apply");
const readonly = new DatabaseSync(filename, { readOnly: true });
if (
  ((await readonly.prepare("PRAGMA quick_check").get()) as any).quick_check !==
  "ok"
)
  throw new Error("SQLite integrity check failed. No changes made.");
const before = await dataQualitySummary({ db: readonly }, space);
const registry = {
  checked: 0,
  valid: 0,
  needsReview: 0,
  normalizable: 0,
  reasons: {} as Record<string, number>,
};
for await (const item of readonly
  .prepare(
    "SELECT data FROM records WHERE space=? AND entity='farmers' ORDER BY rowid",
  )
  .iterate(space) as any) {
  registry.checked++;
  const original = JSON.parse(item.data);
  try {
    const cleaned = validate("farmers", original);
    for (const [key, entity] of [
      ["organizationId", "organizations"],
      ["programId", "programs"],
    ])
      if (
        cleaned[key] &&
        !(await readonly
          .prepare("SELECT id FROM records WHERE space=? AND entity=? AND id=?")
          .get(space, entity, cleaned[key]))
      )
        throw new Error(`${key} points to a missing record`);
    registry.valid++;
    if (JSON.stringify(cleaned) !== JSON.stringify(original))
      registry.normalizable++;
  } catch (error) {
    registry.needsReview++;
    const reason = (error as Error).message;
    registry.reasons[reason] = (registry.reasons[reason] || 0) + 1;
  }
}
let outcome: any = null,
  backupPath: string | undefined;
if (apply) {
  const directory = path.join(path.dirname(filename), "backups");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  backupPath = path.join(
    directory,
    "before-data-recheck-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".sqlite",
  );
  await backup(readonly, backupPath);
  chmodSync(backupPath, 0o600);
  await readonly.close();
  const s = await openDatabase(filename);
  const actor = {
    id: "data-maintenance",
    name: "Data maintenance",
    email: "",
    role: "Super Admin",
    space,
    demo: false,
  } as Session;
  const duplicate = async (space: string, row: Row) => {
    for (const key of ["primaryPhone", "bvn", "nin", "farmerID"]) {
      if (!row[key]) continue;
      const values = key === "primaryPhone" ? phoneKeys(row[key]) : [row[key]];
      const hit = (await s.db
        .prepare(
          `SELECT data FROM records WHERE space=? AND entity='farmers' AND json_extract(data,'$.${key}') IN (${values.map(() => "?").join(",")}) LIMIT 1`,
        )
        .get(space, ...values)) as any;
      if (hit) return JSON.parse(hit.data);
    }
    return undefined;
  };
  const totals = {
    checked: 0,
    ready: 0,
    invalid: 0,
    duplicates: 0,
    updated: 0,
  };
  let afterId = 0;
  s.withActor(actor, async () => {
    while (true) {
      const result = await recheckSources(s, actor, { afterId }, duplicate);
      for (const key of Object.keys(totals) as (keyof typeof totals)[])
        totals[key] += result[key];
      if (!result.remaining) break;
      afterId = result.afterId;
    }
    await s.transaction(async () => {
      for (const row of (await s.db
        .prepare("SELECT id FROM records WHERE space=? AND entity='imports'")
        .all(space)) as any[])
        await reconcileImport(s, space, row.id);
      await s.audit(
        actor,
        "DATA_QUALITY",
        "farmers",
        "registry",
        `Audited ${registry.checked} farmers: ${registry.valid} valid, ${registry.needsReview} need review. No farmer records deleted, merged or inferred.`,
      );
    });
  });
  outcome = { recheck: totals, after: await dataQualitySummary(s, space) };
  await s.db.close();
} else await readonly.close();
const report = {
  generatedAt: new Date().toISOString(),
  mode: apply
    ? "Rechecked archived rejects; originals and registered farmers preserved"
    : "Audit only",
  registry,
  before,
  ...(outcome || {}),
  backupCreated: !!backupPath,
};
const reports = path.join(path.dirname(filename), "quality-reports");
mkdirSync(reports, { recursive: true, mode: 0o700 });
const reportPath = path.join(
  reports,
  "data-quality-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json",
);
writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
console.log("Private aggregate report: " + reportPath);
if (backupPath) console.log("Consistent backup: " + backupPath);
