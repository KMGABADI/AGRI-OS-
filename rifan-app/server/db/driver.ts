import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolClient } from "pg";
import Cursor from "pg-cursor";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
export interface Statement {
  get(...args: any[]): Promise<any>;
  all(...args: any[]): Promise<any[]>;
  run(
    ...args: any[]
  ): Promise<{ changes: number; lastInsertRowid?: number | bigint }>;
  iterate(...args: any[]): AsyncIterable<any>;
}
export interface Driver {
  kind: "sqlite" | "postgres";
  prepare(sql: string): Statement;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;
  locked<T>(key: string, fn: () => Promise<T> | T): Promise<T>;
  inTransaction(): boolean;
  revision(): Promise<string>;
}
/** The application query boundary; placeholder conversion never touches quoted literals. */
export function postgresSQL(sql: string) {
  let output = sql
    .replace(
      /json_extract\(\s*([\w.]+)\s*,\s*'\$\.([^']+)'\s*\)/gi,
      (_, column, key) =>
        key === "kycComplete"
          ? `(CASE WHEN ${column}->>'${key}' IN ('true','1') THEN 1 ELSE 0 END)`
          : `(${column}->>'${key}')`,
    )
    .replace(
      /json_type\(\s*([\w.]+)\s*,\s*'\$\.([^']+)'\s*\)/gi,
      (_, column, key) =>
        `(CASE jsonb_typeof(${column}->'${key}') WHEN 'number' THEN 'real' ELSE jsonb_typeof(${column}->'${key}') END)`,
    )
    .replace(/\bLIKE\b/gi, "ILIKE")
    .replace(/\browid\b/gi, "seq")
    .replace(/\bAS REAL\b/gi, "AS DOUBLE PRECISION");
  const ignore = /^\s*INSERT OR IGNORE\b/i.test(output);
  if (ignore) {
    output = output.replace(/INSERT OR IGNORE/i, "INSERT");
    const at = output.search(/\bRETURNING\b/i);
    output =
      at < 0
        ? output.replace(/;?\s*$/, " ON CONFLICT DO NOTHING")
        : output.slice(0, at) + " ON CONFLICT DO NOTHING " + output.slice(at);
  }
  output = output.replace(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g, (all, name) =>
    /[a-z]/.test(name) && /[A-Z]/.test(name) ? `AS "${name}"` : all,
  );
  let result = "",
    quote = "",
    index = 0;
  for (let i = 0; i < output.length; i++) {
    const c = output[i];
    if (quote) {
      result += c;
      if (c === quote) {
        if (output[i + 1] === quote) {
          result += output[++i];
        } else quote = "";
      }
    } else if (c === "'" || c === '"') {
      quote = c;
      result += c;
    } else if (c === "?") result += "$" + ++index;
    else result += c;
  }
  return result;
}
export function postgresOptions(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must use postgresql://");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const mode =
    env.DATABASE_SSL_MODE || url.searchParams.get("sslmode") || "verify-full";
  if (mode === "disable" && !local)
    throw new Error("Remote PostgreSQL connections require verified TLS");
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslpassword",
  ])
    url.searchParams.delete(key);
  const ca =
    env.DATABASE_CA_CERT?.replace(/\\n/g, "\n") ||
    (env.DATABASE_CA_CERT_PATH
      ? readFileSync(env.DATABASE_CA_CERT_PATH, "utf8")
      : undefined);
  const max = Number(env.DATABASE_POOL_MAX || 10);
  if (!Number.isInteger(max) || max < 1 || max > 50)
    throw new Error("DATABASE_POOL_MAX must be between 1 and 50");
  return {
    connectionString: url.href,
    max,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 60000,
    application_name: "rifan-connect",
    ssl:
      mode === "disable"
        ? false
        : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}
export async function openPostgres(connectionString: string): Promise<Driver> {
  types.setTypeParser(20, (v) => {
    const n = Number(v);
    if (!Number.isSafeInteger(n))
      throw new Error("PostgreSQL integer exceeds safe numeric range");
    return n;
  });
  types.setTypeParser(1700, (v) => Number(v));
  types.setTypeParser(114, (v) => v);
  types.setTypeParser(3802, (v) => v);
  const pool = new Pool(postgresOptions(connectionString));
  pool.on("error", () => {
    console.error(
      "PostgreSQL pool connection lost; subsequent requests will reconnect.",
    );
  });
  try {
    await pool.query("SELECT 1");
  } catch {
    await pool.end();
    throw new Error(
      "Unable to connect to PostgreSQL. Check DATABASE_URL, the trusted CA and database firewall rules.",
    );
  }
  const clients = new AsyncLocalStorage<PoolClient>();
  let savepoint = 0;
  const connection = () => clients.getStore() || pool;
  const driver: Driver = {
    kind: "postgres",
    prepare(sql) {
      const query = postgresSQL(sql);
      return {
        async get(...args) {
          return (
            await connection().query(
              query,
              args.map((v) => (v === undefined ? null : v)),
            )
          ).rows[0];
        },
        async all(...args) {
          return (
            await connection().query(
              query,
              args.map((v) => (v === undefined ? null : v)),
            )
          ).rows;
        },
        async run(...args) {
          const r = await connection().query(
            query,
            args.map((v) => (v === undefined ? null : v)),
          );
          return { changes: r.rowCount || 0 };
        },
        async *iterate(...args) {
          const current = clients.getStore(),
            client = current || (await pool.connect());
          const cursor = client.query(
            new Cursor(
              query,
              args.map((v) => (v === undefined ? null : v)),
            ),
          );
          try {
            while (true) {
              const rows = await cursor.read(500);
              if (!rows.length) break;
              yield* rows;
            }
          } finally {
            await cursor.close();
            if (!current) client.release();
          }
        },
      };
    },
    async exec(sql) {
      await connection().query(sql);
    },
    async close() {
      await pool.end();
    },
    inTransaction() {
      return !!clients.getStore();
    },
    async transaction(fn) {
      const current = clients.getStore();
      if (current) {
        const name = "rifan_sp_" + ++savepoint;
        await current.query("SAVEPOINT " + name);
        try {
          const value = await fn();
          await current.query("RELEASE SAVEPOINT " + name);
          return value;
        } catch (e) {
          await current.query("ROLLBACK TO SAVEPOINT " + name);
          throw e;
        }
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        return await clients.run(client, async () => {
          try {
            const value = await fn();
            await client.query("COMMIT");
            return value;
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          }
        });
      } finally {
        client.release();
      }
    },
    async locked(key, fn) {
      return driver.transaction(async () => {
        await connection().query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          key,
        ]);
        return fn();
      });
    },
    async revision() {
      return String(
        (
          await connection().query(
            "SELECT coalesce(max(id),0) AS value FROM record_changes",
          )
        ).rows[0].value,
      );
    },
  };
  return driver;
}
export async function openSqlite(filename: string): Promise<Driver> {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(path.resolve(filename)), {
      recursive: true,
      mode: 0o700,
    });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000",
  );
  const nesting = new AsyncLocalStorage<boolean>();
  let queue: Promise<any> = Promise.resolve();
  let savepoint = 0;
  const driver: Driver = {
    kind: "sqlite",
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        async get(...args) {
          return statement.get(...args);
        },
        async all(...args) {
          return statement.all(...args) as any[];
        },
        async run(...args) {
          const r = statement.run(...args);
          return {
            changes: Number(r.changes),
            lastInsertRowid: r.lastInsertRowid,
          };
        },
        async *iterate(...args) {
          yield* statement.iterate(...args);
        },
      };
    },
    async exec(sql) {
      db.exec(sql);
    },
    async close() {
      await queue;
      db.close();
    },
    inTransaction() {
      return !!nesting.getStore();
    },
    async transaction(fn) {
      if (nesting.getStore()) {
        const name = "rifan_sp_" + ++savepoint;
        db.exec("SAVEPOINT " + name);
        try {
          const result = await fn();
          db.exec("RELEASE SAVEPOINT " + name);
          return result;
        } catch (e) {
          db.exec("ROLLBACK TO SAVEPOINT " + name);
          throw e;
        }
      }
      const task = queue.then(() =>
        nesting.run(true, async () => {
          db.exec("BEGIN IMMEDIATE");
          try {
            const result = await fn();
            db.exec("COMMIT");
            return result;
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        }),
      );
      queue = task.catch(() => {});
      return task;
    },
    async locked(_key, fn) {
      return driver.transaction(fn);
    },
    async revision() {
      return String(
        (db.prepare("PRAGMA data_version").get() as any).data_version,
      );
    },
  };
  return driver;
}
