import path from "node:path";
import { fileURLToPath } from "node:url";

// Both server/index.ts and dist/server.mjs sit one directory below the app.
// Production assets and SQLite defaults must not depend on the launch directory.
export const appRoot = fileURLToPath(new URL("../", import.meta.url));
export function runtimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const host = env.HOST || "0.0.0.0";
  if (
    env.RENDER === "true" &&
    ["localhost", "127.0.0.1", "::1"].includes(host)
  ) {
    throw new Error(
      "Render requires HOST=0.0.0.0. Remove the loopback HOST override.",
    );
  }
  const configured = env.RIFAN_DB_PATH;
  return {
    host,
    port,
    distDir: path.join(appRoot, "dist"),
    database:
      configured === ":memory:"
        ? configured
        : path.resolve(appRoot, configured || ".data/rifan.sqlite"),
  };
}
