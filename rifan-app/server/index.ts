import "dotenv/config";
import express from "express";
import path from "node:path";
import { createApi } from "./api";
const { app } = createApi();
const port = Number(process.env.PORT || 3001);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve("dist")));
  app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR === "true" ? false : { port: 24679 },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(port, process.env.HOST || "0.0.0.0", () =>
  console.log(
    `RIFAN Connect running on port ${port}; independent SQLite storage enabled.`,
  ),
);
