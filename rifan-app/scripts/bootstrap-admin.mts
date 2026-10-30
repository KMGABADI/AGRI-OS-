import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "../server/database.ts";
import { ensureBootstrapAdmin } from "../server/bootstrap.ts";
dotenv.config({ path: process.env.RIFAN_ENV_FILE || ".env", quiet: true });
const location =
  process.env.DATABASE_URL || process.env.RIFAN_DB_PATH || ".data/rifan.sqlite";
const password =
  process.env.BOOTSTRAP_ADMIN_PASSWORD || randomBytes(24).toString("base64url");
const store = await openDatabase(location);
try {
  const result = await ensureBootstrapAdmin(store, {
    ...process.env,
    BOOTSTRAP_ADMIN_PASSWORD: password,
  });
  if (result.created) {
    const directory = path.resolve(".data");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const original = path.join(directory, "initial-admin-credentials.txt");
    const file = existsSync(original)
      ? path.join(directory, "initial-admin-credentials-" + Date.now() + ".txt")
      : original;
    const content = [
      "RIFAN CONNECT INITIAL ADMINISTRATOR",
      "Email: " + result.email,
      "Initial password: " + password,
      "",
      "Change this password after the first sign-in. The database retains the account across deployments. Never commit this file or put it in application logs.",
      "",
    ].join("\n");
    writeFileSync(file, content, { mode: 0o600, flag: "wx" });
    console.log(
      "Persistent administrator created. Initial credentials saved privately to " +
        file,
    );
  } else
    console.log(
      "The persistent administrator already exists; its password was not changed.",
    );
} finally {
  await store.db.close();
}
