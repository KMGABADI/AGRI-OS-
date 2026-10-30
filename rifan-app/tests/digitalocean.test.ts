import { test } from "node:test";
import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";
import {
  DigitalOcean,
  databasePlan,
  trustedSources,
  certificatePEM,
  provisionDatabase,
} from "../server/db/digitalocean";
test("database provisioning refuses unbounded trusted networks and preserves CA verification", () => {
  assert.throws(() => trustedSources(undefined), /TRUSTED_CIDRS/);
  for (const value of [
    "0.0.0.0/0",
    "::/0",
    "203.0.113.1/0",
    "invalid",
    "192.0.2.0/33",
  ])
    assert.throws(() => trustedSources(value));
  assert.equal(trustedSources("203.0.113.2/32,203.0.113.2/32").length, 1);
  assert.deepEqual(databasePlan({}), {
    name: "rifan-postgres",
    engine: "pg",
    version: "17",
    region: "lon1",
    size: "db-s-1vcpu-2gb",
    num_nodes: 1,
    tags: ["rifan-connect"],
  });
  assert.equal(
    certificatePEM(Buffer.from(rootCertificates[0]).toString("base64")),
    rootCertificates[0],
  );
  assert.throws(() => certificatePEM("invalid"));
});
test("DigitalOcean provisioning is idempotent, restricts the firewall and keeps credentials out of public reports", async () => {
  const calls: { path: string; method: string; body: any }[] = [];
  const cluster = {
    id: "fixture-db-id",
    name: "rifan-postgres",
    engine: "pg",
    region: "lon1",
    status: "online",
    tags: ["rifan-connect"],
    connection: {
      host: "fixture.db.ondigitalocean.com",
      port: 25060,
      user: "doadmin",
      password: "fixture-owner-secret",
    },
  };
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)),
      method = init?.method || "GET",
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path: url.pathname, method, body });
    let result: any = {};
    if (url.pathname === "/v2/databases") result = { databases: [cluster] };
    else if (url.pathname.endsWith("/dbs"))
      result = { dbs: [{ name: "rifan" }] };
    else if (url.pathname.endsWith("/users"))
      result = {
        users: [{ name: "rifan_app", password: "fixture-app-secret" }],
      };
    else if (url.pathname.endsWith("/ca"))
      result = {
        ca: {
          certificate: Buffer.from(rootCertificates[0]).toString("base64"),
        },
      };
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const api = new DigitalOcean("fixture-api-token", transport);
  const result = await provisionDatabase(
    api,
    databasePlan({}),
    trustedSources("203.0.113.2/32"),
  );
  assert.equal(
    calls.filter((c) => c.method === "POST" && c.path === "/v2/databases")
      .length,
    0,
  );
  const firewall = calls.find((c) => c.path.endsWith("/firewall"));
  assert.equal(firewall?.method, "PUT");
  assert.deepEqual(firewall?.body.rules, [
    { type: "ip_addr", value: "203.0.113.2/32" },
  ]);
  assert.equal(new URL(result.applicationUrl).username, "rifan_app");
  assert.equal(
    new URL(result.applicationUrl).searchParams.get("sslmode"),
    "verify-full",
  );
  assert.ok(result.ca.includes("BEGIN CERTIFICATE"));
  const denied = new DigitalOcean(
    "fixture-api-token",
    async () =>
      new Response(
        JSON.stringify({ message: "provider-secret-should-not-leak" }),
        { status: 403 },
      ),
  );
  await assert.rejects(
    denied.api("/v2/databases"),
    (error) =>
      String(error).includes("403") &&
      !String(error).includes("provider-secret"),
  );
});

test("new database provisioning retains credentials returned only at user creation", async () => {
  const calls: string[] = [];
  const cluster = {
    id: "new-fixture",
    name: "rifan-postgres",
    engine: "pg",
    region: "lon1",
    status: "online",
    tags: ["rifan-connect"],
    connection: {
      host: "fixture.db.ondigitalocean.com",
      port: 25060,
      user: "doadmin",
      password: "fixture-owner-secret",
    },
  };
  const api = new DigitalOcean("fixture-api-token", async (input, init) => {
    const path = new URL(String(input)).pathname,
      method = init?.method || "GET";
    calls.push(method + " " + path);
    let body: any = {};
    if (path === "/v2/databases" && method === "GET") body = { databases: [] };
    else if (path === "/v2/databases" && method === "POST")
      body = { database: cluster };
    else if (path.endsWith("/dbs")) body = { dbs: [] };
    else if (path.endsWith("/users") && method === "GET") body = { users: [] };
    else if (path.endsWith("/users") && method === "POST")
      body = {
        user: { name: "rifan_app", password: "fixture-created-secret" },
      };
    else if (path.endsWith("/ca"))
      body = { ca: { certificate: rootCertificates[0] } };
    else if (path.endsWith("/users/rifan_app"))
      throw Error("Creation credentials should have been retained");
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const result = await provisionDatabase(
    api,
    databasePlan({}),
    trustedSources("203.0.113.2/32"),
  );
  assert.equal(calls.filter((c) => c === "POST /v2/databases").length, 1);
  assert.ok(
    calls.indexOf("PUT /v2/databases/new-fixture/firewall") <
      calls.indexOf("POST /v2/databases/new-fixture/dbs"),
  );
  assert.equal(
    new URL(result.applicationUrl).password,
    "fixture-created-secret",
  );
});
