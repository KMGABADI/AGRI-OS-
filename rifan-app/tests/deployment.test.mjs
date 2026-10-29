import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  rm,
  mkdir,
  copyFile,
  symlink,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
const app = fileURLToPath(new URL("../", import.meta.url));
const repository = path.dirname(app);
const entry = path.join(app, "dist/server.mjs");
const temp = await mkdtemp(path.join(tmpdir(), "rifan-render-"));
after(() => rm(temp, { recursive: true, force: true }));
const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
async function stop(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    child.once("close", resolve);
    child.kill("SIGTERM");
  });
}
async function start(cwd, database, executable = entry, overrides = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [executable], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      RENDER: "true",
      PORT: String(port),
      RIFAN_DB_PATH: database,
      ENABLE_DEMO: "false",
      ...overrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (b) => (log += b));
  child.stderr.on("data", (b) => (log += b));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw new Error(`Server exited before readiness: ${log}`);
    try {
      if ((await fetch(base + "/api/health")).ok)
        return { child, base, log: () => log };
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  await stop(child);
  throw new Error("Server did not become ready: " + log);
}
for (const [label, cwd] of [
  ["repository root", repository],
  ["app root", app],
  ["unrelated directory", temp],
]) {
  test(`production starts from ${label}, uses Render PORT and serves the new frontend`, async () => {
    const instance = await start(
      cwd,
      path.join(temp, label.replaceAll(" ", "-") + ".sqlite"),
    );
    try {
      assert.equal(
        (await fetch(instance.base + "/api/health").then((r) => r.json())).app,
        "RIFAN Connect",
      );
      const page = await fetch(instance.base + "/farmers/example-profile");
      const html = await page.text();
      assert.match(html, /<title>RIFAN Connect/);
      assert.equal(page.headers.get("cache-control"), "no-cache");
      const asset = html.match(/src="([^"]+\.js)"/)[1];
      const response = await fetch(instance.base + asset);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /immutable/);
      assert.equal(
        (await fetch(instance.base + "/assets/deleted-old-chunk.js")).status,
        404,
      );
      assert.equal(
        (await fetch(instance.base + "/api/auth/status").then((r) => r.json()))
          .demoEnabled,
        false,
      );
    } finally {
      await stop(instance.child);
    }
  });
}
test("production preserves users and sessions across restart on the same disk", async () => {
  const database = path.join(temp, "persistent", "rifan.sqlite");
  let instance = await start(repository, database);
  let cookie;
  try {
    const response = await fetch(instance.base + "/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Persistent Test Owner",
        email: "persist@example.test",
        password: "persistent-test-password-only",
      }),
    });
    assert.equal(response.status, 201);
    cookie = response.headers.get("set-cookie").split(";")[0];
  } finally {
    await stop(instance.child);
  }
  instance = await start(app, database);
  try {
    assert.equal(
      (await fetch(instance.base + "/api/auth/status").then((r) => r.json()))
        .needsSetup,
      false,
    );
    const me = await fetch(instance.base + "/api/auth/me", {
      headers: { Cookie: cookie },
    });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).email, "persist@example.test");
  } finally {
    await stop(instance.child);
  }
});
test("missing production build exits clearly rather than serving the wrong app", async () => {
  const fixture = path.join(temp, "missing-build");
  await mkdir(path.join(fixture, "dist"), { recursive: true });
  await copyFile(entry, path.join(fixture, "dist/server.mjs"));
  await symlink(
    path.join(app, "node_modules"),
    path.join(fixture, "node_modules"),
    "dir",
  );
  const child = spawn(
    process.execPath,
    [path.join(fixture, "dist/server.mjs")],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        RIFAN_DB_PATH: path.join(temp, "unused.sqlite"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let errors = "";
  child.stderr.on("data", (b) => (errors += b));
  const code = await new Promise((r) => child.once("close", r));
  assert.equal(code, 1);
  assert.match(errors, /Production assets are missing.*npm run build/);
});
test("both root and app scripts start RIFAN Connect; the legacy command is explicit", async () => {
  const root = JSON.parse(
    await readFile(path.join(repository, "package.json"), "utf8"),
  );
  assert.match(root.scripts.start, /rifan-app/);
  assert.match(root.scripts.build, /rifan-app.*ci.*include=dev/);
  assert.match(root.scripts["legacy:start"], /server\.cjs/);
  const nested = JSON.parse(
    await readFile(path.join(app, "package.json"), "utf8"),
  );
  assert.match(nested.scripts.start, /dist\/server\.mjs/);
});
