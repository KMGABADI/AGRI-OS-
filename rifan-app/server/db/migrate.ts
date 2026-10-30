import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { openDatabase } from "../database";
const TABLES = [
  "records",
  "users",
  "sessions",
  "audit",
  "settings",
  "files",
  "source_records",
  "integrations",
  "record_history",
  "cohort_jobs",
  "cohort_members",
  "otp_challenges",
  "oauth_states",
  "auth_attempts",
  "bootstrap_admin",
];
const KEYS: Record<string, string[]> = {
  records: ["space", "entity", "id"],
  users: ["id"],
  sessions: ["token"],
  audit: ["id"],
  settings: ["space"],
  files: ["id"],
  source_records: ["id"],
  integrations: ["space", "user_id"],
  record_history: ["version"],
  cohort_jobs: ["id"],
  cohort_members: ["job_id", "farmer_id"],
  otp_challenges: ["id"],
  oauth_states: ["state_hash"],
  auth_attempts: ["key"],
  bootstrap_admin: ["space"],
};
const JSON_COLUMNS: Record<string, string[]> = {
  records: ["data"],
  users: ["scope"],
  sessions: ["data"],
  settings: ["data"],
  record_history: ["data"],
  cohort_jobs: ["target", "filters"],
};
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
function canonical(value: any): any {
  if (ArrayBuffer.isView(value))
    return {
      binary: Buffer.from(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      ).toString("base64"),
    };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function rowText(table: string, row: any, columns: string[]) {
  return JSON.stringify(
    columns.map((column) => {
      let value = row[column];
      if (JSON_COLUMNS[table]?.includes(column) && typeof value === "string")
        value = JSON.parse(value);
      return canonical(value);
    }),
  );
}
export async function migrateSqliteToPostgres(
  sourceFile: string,
  databaseUrl: string,
  options: {
    dryRun?: boolean;
    onProgress?: (progress: {
      table: string;
      rows: number;
      total: number;
    }) => void;
  } = {},
) {
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl))
    throw new Error("A PostgreSQL target DATABASE_URL is required");
  const source = new DatabaseSync(sourceFile, { readOnly: true });
  if (
    (source.prepare("PRAGMA quick_check").get() as any).quick_check !== "ok"
  ) {
    source.close();
    throw new Error("SQLite integrity check failed; migration was not started");
  }
  source.exec("BEGIN");
  let target: Awaited<ReturnType<typeof openDatabase>> | undefined;
  try {
    const names = (
      source
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as any[]
    ).map((t) => t.name);
    if (
      !["records", "users", "source_records"].every((table) =>
        names.includes(table),
      )
    )
      throw new Error(
        "The source is not a RIFAN application database; migration was not started",
      );
    const unsupported = names.filter((name) => !TABLES.includes(name));
    if (unsupported.length)
      throw new Error(
        "The source has unsupported tables; migration stopped to avoid omitting data",
      );
    const plan: Record<
      string,
      { count: number; digest: string; columns: string[] }
    > = {};
    const fingerprint = createHash("sha256");
    for (const table of TABLES.filter((name) => names.includes(name))) {
      const columns = (
        source.prepare("PRAGMA table_info(" + quote(table) + ")").all() as any[]
      ).map((c) => c.name);
      if (table === "records") columns.push("seq");
      const selected = columns
        .map((c) =>
          c === "seq" && table === "records" ? "rowid AS seq" : quote(c),
        )
        .join(",");
      const hash = createHash("sha256");
      let count = 0;
      for (const row of source
        .prepare(
          "SELECT " +
            selected +
            " FROM " +
            quote(table) +
            " ORDER BY " +
            KEYS[table].map(quote).join(","),
        )
        .iterate()) {
        hash.update(rowText(table, row, columns) + "\n");
        count++;
      }
      const digest = hash.digest("hex");
      plan[table] = { columns, count, digest };
      fingerprint.update(table + ":" + count + ":" + digest + "\n");
    }
    const sourceFingerprint = fingerprint.digest("hex");
    if (options.dryRun)
      return {
        dryRun: true,
        sourceFingerprint,
        counts: Object.fromEntries(
          Object.entries(plan).map(([name, p]) => [name, p.count]),
        ),
        verified: false,
        alreadyMigrated: false,
      };
    target = await openDatabase(databaseUrl, { migrate: true });
    const db = target.db;
    if (db.kind !== "postgres")
      throw new Error("Migration target is not PostgreSQL");
    return await target.locked("rifan-sqlite-import", async () => {
      await db.exec(
        "CREATE TABLE IF NOT EXISTS migration_runs(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,completed_at TEXT NOT NULL,summary JSONB NOT NULL)",
      );
      const previous = await db
        .prepare(
          "SELECT fingerprint FROM migration_runs WHERE id='sqlite-import-v1'",
        )
        .get();
      if (previous && previous.fingerprint !== sourceFingerprint)
        throw new Error(
          "This database was migrated from a different source; refusing to overwrite it",
        );
      if (!previous) {
        for (const table of TABLES) {
          const existing = await db
            .prepare("SELECT count(*) AS n FROM " + quote(table))
            .get();
          if (existing.n)
            throw new Error(
              "PostgreSQL already contains application data; refusing to merge or overwrite records",
            );
        }
        for (const [table, p] of Object.entries(plan)) {
          const selected = p.columns
            .map((c) =>
              c === "seq" && table === "records" ? "rowid AS seq" : quote(c),
            )
            .join(",");
          let batch: any[] = [],
            copied = 0;
          const flush = async () => {
            if (!batch.length) return;
            const values = batch.flatMap((row) =>
              p.columns.map((c) =>
                ArrayBuffer.isView(row[c])
                  ? Buffer.from(
                      row[c].buffer,
                      row[c].byteOffset,
                      row[c].byteLength,
                    )
                  : row[c],
              ),
            );
            const groups = batch
              .map(() => "(" + p.columns.map(() => "?").join(",") + ")")
              .join(",");
            await db
              .prepare(
                "INSERT INTO " +
                  quote(table) +
                  " (" +
                  p.columns.map(quote).join(",") +
                  ") VALUES " +
                  groups,
              )
              .run(...values);
            copied += batch.length;
            options.onProgress?.({ table, rows: copied, total: p.count });
            batch = [];
          };
          for (const row of source
            .prepare(
              "SELECT " +
                selected +
                " FROM " +
                quote(table) +
                " ORDER BY " +
                KEYS[table].map(quote).join(","),
            )
            .iterate()) {
            batch.push(row);
            if (batch.length >= 500) await flush();
          }
          await flush();
        }
      }
      const counts: Record<string, number> = {};
      for (const [table, p] of Object.entries(plan)) {
        const hash = createHash("sha256");
        let count = 0;
        for await (const row of db
          .prepare(
            "SELECT " +
              p.columns.map(quote).join(",") +
              " FROM " +
              quote(table) +
              " ORDER BY " +
              KEYS[table].map(quote).join(","),
          )
          .iterate()) {
          hash.update(rowText(table, row, p.columns) + "\n");
          count++;
        }
        if (count !== p.count || hash.digest("hex") !== p.digest)
          throw new Error(
            "Post-migration verification failed for " +
              table +
              "; the import was rolled back",
          );
        counts[table] = count;
      }
      for (const [table, column] of [
        ["records", "seq"],
        ["source_records", "id"],
        ["audit", "id"],
        ["record_history", "version"],
      ])
        await db.exec(
          `SELECT setval(pg_get_serial_sequence('${table}','${column}'),greatest(coalesce((SELECT max(${column}) FROM ${table}),0),1),(SELECT count(*)>0 FROM ${table}))`,
        );
      await db
        .prepare(
          "INSERT INTO migration_runs(id,fingerprint,completed_at,summary) VALUES('sqlite-import-v1',?,?,?) ON CONFLICT(id) DO NOTHING",
        )
        .run(
          sourceFingerprint,
          new Date().toISOString(),
          JSON.stringify(counts),
        );
      return {
        dryRun: false,
        sourceFingerprint,
        counts,
        verified: true,
        alreadyMigrated: !!previous,
      };
    });
  } finally {
    if (target) await target.db.close();
    source.exec("ROLLBACK");
    source.close();
  }
}
