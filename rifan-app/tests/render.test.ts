import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/api";
import { runtimeConfig, appRoot } from "../server/runtime";
import path from "node:path";

process.env.NODE_ENV = "production";
process.env.RENDER = "true";
process.env.RENDER_EXTERNAL_URL = "https://rifan-render.example.test";
delete process.env.PUBLIC_URL;
delete process.env.COOKIE_SECURE;
const { app, store } = createApi({ filename: ":memory:" });
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.db.close();
});

test("runtime anchors assets and the default database to the application, independent of cwd", () => {
  const config = runtimeConfig({ PORT: "10000" });
  assert.equal(config.port, 10000);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.distDir, path.join(appRoot, "dist"));
  assert.equal(config.database, path.join(appRoot, ".data/rifan.sqlite"));
  assert.equal(
    runtimeConfig({ RIFAN_DB_PATH: "/var/data/rifan.sqlite" }).database,
    "/var/data/rifan.sqlite",
  );
});
test("invalid Render ports and loopback host overrides fail with actionable messages", () => {
  for (const port of ["invalid", "-1", "0", "65536", "1.5"])
    assert.throws(() => runtimeConfig({ PORT: port }), /PORT must/);
  assert.throws(
    () => runtimeConfig({ RENDER: "true", HOST: "127.0.0.1" }),
    /0.0.0.0/,
  );
});
test("Render production starts without optional Google or AI credentials and disables demo", async () => {
  const response = await fetch(base + "/api/health");
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as any).app, "RIFAN Connect");
  const status = (await fetch(base + "/api/auth/status").then((r) =>
    r.json(),
  )) as any;
  assert.equal(status.demoEnabled, false);
});
test("Render external URL is accepted behind a proxy and secure sessions are issued", async () => {
  const response = await fetch(base + "/api/auth/setup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://rifan-render.example.test",
      "X-Forwarded-Proto": "https",
    },
    body: JSON.stringify({
      name: "Render Test Owner",
      email: "render@example.test",
      password: "render-fixture-password-only",
    }),
  });
  assert.equal(response.status, 201);
  assert.match(response.headers.get("set-cookie") || "", /; Secure/);
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
  const attack = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example.test",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(attack.status, 403);
});
test("Render proxy rate limiting isolates clients rather than blocking every user together", async () => {
  const request = (ip: string) =>
    fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({
        email: "nobody@example.test",
        password: "invalid",
      }),
    });
  for (let i = 0; i < 20; i++)
    assert.equal((await request("192.0.2.1")).status, 401);
  assert.equal((await request("192.0.2.1")).status, 429);
  assert.equal((await request("192.0.2.2")).status, 401);
});
