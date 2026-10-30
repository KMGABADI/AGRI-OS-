import dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DigitalOcean,
  databasePlan,
  trustedSources,
  provisionDatabase,
} from "../server/db/digitalocean.ts";
import { openDatabase } from "../server/database.ts";
dotenv.config({ path: process.env.RIFAN_ENV_FILE || ".env", quiet: true });
const plan = databasePlan();
async function main() {
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify(
        {
          action:
            "Create or reuse a billable DigitalOcean Managed PostgreSQL cluster",
          plan,
          trustedSourcesRequired: true,
          requiredCredentials: ["DIGITALOCEAN_ACCESS_TOKEN"],
          note: "No resources created. Run with --apply after secure access and trusted source configuration are supplied.",
        },
        null,
        2,
      ),
    );
    return;
  }
  const token = process.env.DIGITALOCEAN_ACCESS_TOKEN;
  if (!token)
    throw new Error(
      "DIGITALOCEAN_ACCESS_TOKEN is missing. Supply it in secure environment settings.",
    );
  const rules = trustedSources(process.env.DO_DATABASE_TRUSTED_CIDRS);
  let last = "";
  const result = await provisionDatabase(
    new DigitalOcean(token),
    plan,
    rules,
    (status) => {
      if (status !== last) {
        console.log("Managed PostgreSQL status: " + status);
        last = status;
      }
    },
  );
  const directory = path.resolve(".data/digitalocean");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const caFile = path.join(directory, "database-ca.crt");
  writeFileSync(caFile, result.ca, { mode: 0o600 });
  process.env.DATABASE_CA_CERT = result.ca;
  process.env.DATABASE_AUTO_MIGRATE = "true";
  const store = await openDatabase(result.migrationUrl, { migrate: true });
  try {
    await store.db.exec(
      "GRANT USAGE ON SCHEMA public TO rifan_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO rifan_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO rifan_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO rifan_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO rifan_app;",
    );
  } finally {
    await store.db.close();
  }
  const file = path.join(directory, "postgres.env");
  const env =
    [
      "DATABASE_PROVIDER=postgres",
      "DATABASE_URL=" + JSON.stringify(result.applicationUrl),
      "DATABASE_MIGRATION_URL=" + JSON.stringify(result.migrationUrl),
      "DATABASE_CA_CERT=" + JSON.stringify(result.ca),
      "DATABASE_AUTO_MIGRATE=false",
      "DATABASE_POOL_MAX=10",
    ].join("\n") + "\n";
  writeFileSync(file, env, { mode: 0o600 });
  writeFileSync(
    path.join(directory, "cluster.json"),
    JSON.stringify(
      {
        id: result.id,
        name: result.name,
        plan,
        trustedSources: rules.length,
        ready: true,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    "DigitalOcean PostgreSQL is online with verified TLS and restricted trusted sources. Connection secrets were saved privately to " +
      file +
      ". No secret values were printed.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
