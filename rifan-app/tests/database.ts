import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { createApi as createApplication } from "../server/api";
import { postgresOptions } from "../server/db/driver";
/** Every fixture gets a real isolated database when the PostgreSQL suite is requested. */
export async function createTestApi(
  options: Parameters<typeof createApplication>[0] = {},
) {
  const configured = process.env.RIFAN_TEST_POSTGRES_URL;
  if (!configured)
    return {
      ...(await createApplication({
        filename: ":memory:",
        ...options,
        bootstrap: false,
      })),
      databaseUrl: undefined as string | undefined,
    };
  const name = "rifan_test_" + randomBytes(10).toString("hex");
  const management = new Pool(postgresOptions(configured));
  await management.query('CREATE DATABASE "' + name + '"');
  const url = new URL(configured);
  url.pathname = "/" + name;
  try {
    const result = await createApplication({
      ...options,
      filename: url.href,
      bootstrap: false,
    });
    const close = result.store.db.close;
    result.store.db.close = async () => {
      await close();
      await management.query('DROP DATABASE "' + name + '"');
      await management.end();
    };
    return { ...result, databaseUrl: url.href };
  } catch (e) {
    await management.query('DROP DATABASE "' + name + '" WITH (FORCE)');
    await management.end();
    throw e;
  }
}
