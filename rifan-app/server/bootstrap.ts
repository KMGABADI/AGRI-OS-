import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import type { Store } from "./database";
import type { Session } from "../src/model";
export async function ensureBootstrapAdmin(
  s: Store,
  env: NodeJS.ProcessEnv = process.env,
) {
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password) return { created: false, configured: false };
  const email = (env.BOOTSTRAP_ADMIN_EMAIL || "admin@rifan.local")
      .trim()
      .toLowerCase(),
    name = (env.BOOTSTRAP_ADMIN_NAME || "RIFAN Administrator").trim();
  if (
    !/^\S+@\S+\.\S+$/.test(email) ||
    name.length < 2 ||
    password.length < 16 ||
    password.length > 1000
  )
    throw new Error(
      "Bootstrap administrator requires a valid email and a password of at least 16 characters",
    );
  return s.locked("rifan-bootstrap-admin", async () => {
    const marker = await s.db
      .prepare("SELECT user_id FROM bootstrap_admin WHERE space='workspace'")
      .get();
    if (marker) {
      const seeded = await s.db
        .prepare("SELECT id,email FROM users WHERE space='workspace' AND id=?")
        .get(marker.user_id);
      if (!seeded)
        throw new Error(
          "The bootstrap administrator was removed; deliberate administrator recovery is required",
        );
      return {
        created: false,
        configured: true,
        id: seeded.id,
        email: seeded.email,
      };
    }
    const existing = await s.db
      .prepare("SELECT id,role FROM users WHERE space='workspace' AND email=?")
      .get(email);
    if (existing) {
      if (!["Super Admin", "Admin"].includes(existing.role))
        throw new Error(
          "Bootstrap administrator email is assigned to a different role",
        );
      await s.db
        .prepare(
          "INSERT INTO bootstrap_admin(space,user_id) VALUES('workspace',?)",
        )
        .run(existing.id);
      return { created: false, configured: true, id: existing.id, email };
    }
    const id = randomUUID(),
      salt = randomBytes(16).toString("hex");
    await s.db
      .prepare(
        "INSERT INTO users(id,space,email,name,role,hash,salt,must_change_password) VALUES(?,'workspace',?,?,'Super Admin',?,?,1)",
      )
      .run(
        id,
        email,
        name,
        scryptSync(password, salt, 64).toString("hex"),
        salt,
      );
    await s.db
      .prepare(
        "INSERT INTO bootstrap_admin(space,user_id) VALUES('workspace',?)",
      )
      .run(id);
    await s.audit(
      {
        id,
        name,
        email,
        role: "Super Admin",
        space: "workspace",
        demo: false,
      } as Session,
      "BOOTSTRAP_ADMIN",
      "users",
      id,
      "Created the persistent initial administrator; password change required at first sign-in",
    );
    return { created: true, configured: true, id, email };
  });
}
