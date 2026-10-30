import dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "../server/database.ts";
import {
  dataQualitySummary,
  recheckSources,
  reconcileImport,
} from "../server/features/data-quality.ts";
import { validate } from "../server/validation.ts";
import { phoneKeys } from "../src/lib/phone.ts";
import type { Row, Session } from "../src/model.ts";
dotenv.config({ path: process.env.RIFAN_ENV_FILE || ".env", quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL to audit the PostgreSQL database");
const store = await openDatabase(process.env.DATABASE_URL);
const space = process.env.RIFAN_DATA_SPACE || "workspace";
const apply = process.argv.includes("--apply");
const actor = {
  id: "data-maintenance",
  name: "Data maintenance",
  email: "",
  role: "Super Admin",
  space,
  demo: false,
} as Session;
try {
  const before = await dataQualitySummary(store, space);
  const registry = {
    checked: 0,
    valid: 0,
    needsReview: 0,
    reasons: {} as Record<string, number>,
  };
  for await (const item of store.db
    .prepare(
      "SELECT data FROM records WHERE space=? AND entity='farmers' ORDER BY rowid",
    )
    .iterate(space)) {
    registry.checked++;
    try {
      validate("farmers", JSON.parse(item.data));
      registry.valid++;
    } catch (error) {
      registry.needsReview++;
      const reason = (error as Error).message;
      registry.reasons[reason] = (registry.reasons[reason] || 0) + 1;
    }
  }
  const totals = {
    checked: 0,
    ready: 0,
    invalid: 0,
    duplicates: 0,
    updated: 0,
  };
  if (apply) {
    const duplicate = async (space: string, row: Row) => {
      for (const key of ["primaryPhone", "bvn", "nin", "farmerID"]) {
        if (!row[key]) continue;
        const values =
          key === "primaryPhone" ? phoneKeys(row[key]) : [row[key]];
        const hit = await store.db
          .prepare(
            `SELECT data FROM records WHERE space=? AND entity='farmers' AND json_extract(data,'$.${key}') IN (${values.map(() => "?").join(",")}) LIMIT 1`,
          )
          .get(space, ...values);
        if (hit) return JSON.parse(hit.data);
      }
      return undefined;
    };
    await store.withActor(actor, async () => {
      let afterId = 0;
      while (true) {
        const result = await recheckSources(
          store,
          actor,
          { afterId },
          duplicate,
        );
        for (const key of Object.keys(totals) as (keyof typeof totals)[])
          totals[key] += result[key];
        if (!result.remaining) break;
        afterId = result.afterId;
      }
      for (const row of await store.db
        .prepare("SELECT id FROM records WHERE space=? AND entity='imports'")
        .all(space))
        await reconcileImport(store, space, row.id);
      await store.audit(
        actor,
        "DATA_QUALITY",
        "farmers",
        "registry",
        `Audited ${registry.checked} farmers; rechecked ${totals.checked} rejected rows. Original source values retained.`,
      );
    });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    provider: "postgres",
    mode: apply ? "Recheck rejected source metadata" : "Registry audit only",
    registry,
    before,
    recheck: apply ? totals : undefined,
    after: apply ? await dataQualitySummary(store, space) : undefined,
  };
  const directory = path.resolve(".data/quality-reports");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    path.join(directory, "postgres-quality-" + Date.now() + ".json"),
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await store.db.close();
}
