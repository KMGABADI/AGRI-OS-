import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { appRoot, runtimeConfig } from "./runtime";
import { createApi } from "./api";
async function start() {
  dotenv.config({ path: path.join(appRoot, ".env"), quiet: true });
  process.env.NODE_ENV ||= import.meta.url.endsWith("/dist/server.mjs")
    ? "production"
    : "development";
  const config = runtimeConfig();
  const production = process.env.NODE_ENV === "production";
  const indexFile = path.join(config.distDir, "index.html");
  if (production && !existsSync(indexFile)) {
    throw new Error(
      "Production assets are missing. Run npm run build before npm start (Render Root Directory: rifan-app).",
    );
  }
  if (
    process.env.RENDER === "true" &&
    !process.env.DATABASE_URL &&
    !process.env.RIFAN_DB_PATH
  ) {
    console.warn(
      "Render storage is ephemeral. Attach a persistent disk and set RIFAN_DB_PATH=/var/data/rifan.sqlite before importing real data.",
    );
  }
  const { app, store } = await createApi({ filename: config.database });
  if (production) {
    app.use(
      "/assets",
      express.static(path.join(config.distDir, "assets"), {
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.use("/assets", (_req, res) =>
      res.status(404).type("text").send("Asset not found"),
    );
    app.use(express.static(config.distDir, { index: false }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexFile);
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: appRoot,
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { port: 24679 },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  const server = app.listen(config.port, config.host, () => {
    console.log(
      `RIFAN Connect running on port ${config.port}; ${store.db.kind} storage enabled.`,
    );
  });
  server.on("error", async (error) => {
    console.error(`RIFAN Connect could not listen: ${error.message}`);
    await store.db.close();
    process.exitCode = 1;
  });
  let closing = false;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      server.close(async () => {
        await store.db.close();
        clearTimeout(timeout);
      });
      server.closeIdleConnections();
    });
  }
}
start().catch((error: Error) => {
  console.error(`RIFAN Connect startup failed: ${error.message}`);
  process.exitCode = 1;
});
