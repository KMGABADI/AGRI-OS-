import dotenv from "dotenv";
dotenv.config({ path: process.env.RIFAN_ENV_FILE || ".env", quiet: true });
if (process.env.DATABASE_URL) await import("./data-quality-postgres.mts");
else await import("./data-quality.mts");
