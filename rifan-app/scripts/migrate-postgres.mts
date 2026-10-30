import dotenv from "dotenv";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, chmodSync, writeFileSync } from "node:fs";
import { migrateSqliteToPostgres } from "../server/db/migrate.ts";
dotenv.config({ path: process.env.RIFAN_ENV_FILE || ".env", quiet: true });
const databaseUrl =
  process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "Set DATABASE_MIGRATION_URL or DATABASE_URL through secure environment configuration",
  );
const source = path.resolve(
  process.env.RIFAN_SQLITE_SOURCE ||
    process.env.RIFAN_DB_PATH ||
    ".data/rifan.sqlite",
);
const dryRun = !process.argv.includes("--apply");
async function main() {
  let selected = source;
  if (!dryRun) {
    const directory = path.join(path.dirname(source), "backups");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    selected = path.join(
      directory,
      "before-postgres-" +
        new Date().toISOString().replace(/[:.]/g, "-") +
        ".sqlite",
    );
    const db = new DatabaseSync(source, { readOnly: true });
    try {
      await backup(db, selected);
      chmodSync(selected, 0o600);
    } finally {
      db.close();
    }
  }
  const result = await migrateSqliteToPostgres(selected, databaseUrl!, {
    dryRun,
    onProgress: (p) => {
      if (p.rows === p.total || p.rows % 25000 === 0)
        console.log(`${p.table}: ${p.rows}/${p.total}`);
    },
  });
  const directory = path.join(path.dirname(source), "migration-reports");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    path.join(directory, "postgres-" + Date.now() + ".json"),
    JSON.stringify({ ...result, backupCreated: !dryRun }, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(result));
}
main().catch((error) => {
  console.error("PostgreSQL migration stopped: " + error.message);
  process.exitCode = 1;
});
