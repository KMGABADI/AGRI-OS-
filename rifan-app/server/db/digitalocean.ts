import { isIP } from "node:net";
import { X509Certificate } from "node:crypto";
export type DatabasePlan = {
  name: string;
  engine: "pg";
  version: string;
  region: string;
  size: string;
  num_nodes: number;
  tags: string[];
};
export function databasePlan(
  env: NodeJS.ProcessEnv = process.env,
): DatabasePlan {
  const nodes = Number(env.DO_DATABASE_NODES || 1);
  if (![1, 2, 3].includes(nodes))
    throw new Error("DO_DATABASE_NODES must be 1, 2 or 3");
  return {
    name: env.DO_DATABASE_NAME || "rifan-postgres",
    engine: "pg",
    version: env.DO_POSTGRES_VERSION || "17",
    region: env.DO_DATABASE_REGION || "lon1",
    size: env.DO_DATABASE_SIZE || "db-s-1vcpu-2gb",
    num_nodes: nodes,
    tags: ["rifan-connect"],
  };
}
export function trustedSources(value: string | undefined) {
  const list = (value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!list.length)
    throw new Error(
      "Set DO_DATABASE_TRUSTED_CIDRS to the approved Render outbound and migration-host IP addresses/CIDRs before provisioning",
    );
  return [...new Set(list)].map((value) => {
    const [ip, mask, ...extra] = value.split("/");
    const version = isIP(ip);
    if (
      !version ||
      extra.length ||
      (mask !== undefined &&
        (!/^\d+$/.test(mask) ||
          Number(mask) < 1 ||
          Number(mask) > (version === 4 ? 32 : 128)))
    )
      throw new Error(
        "Use specific approved IP addresses/CIDRs; unrestricted network ranges are not allowed",
      );
    if (ip === "0.0.0.0" || ip === "::")
      throw new Error("Unrestricted trusted sources are not allowed");
    return { type: "ip_addr", value };
  });
}
export function certificatePEM(encoded: string) {
  const pem = encoded.includes("BEGIN CERTIFICATE")
    ? encoded
    : Buffer.from(encoded, "base64").toString("utf8");
  const certificate = new X509Certificate(pem);
  if (!certificate.ca)
    throw new Error("The DigitalOcean certificate is not a CA certificate");
  return pem;
}
export class DigitalOcean {
  constructor(
    private token: string,
    private request: typeof fetch = fetch,
  ) {
    if (!token)
      throw new Error(
        "Configure DIGITALOCEAN_ACCESS_TOKEN in secure environment settings",
      );
  }
  async api(path: string, method = "GET", body?: any) {
    if (!path.startsWith("/v2/"))
      throw new Error("Invalid DigitalOcean API path");
    const response = await this.request("https://api.digitalocean.com" + path, {
      method,
      headers: {
        Authorization: "Bearer " + this.token,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(
        `DigitalOcean request failed (${response.status}). Check token permissions, account availability and database settings.`,
      );
    if (response.status === 204) return {};
    return response.json() as Promise<any>;
  }
}
export async function provisionDatabase(
  api: DigitalOcean,
  plan: DatabasePlan,
  rules: ReturnType<typeof trustedSources>,
  onStatus?: (status: string) => void,
) {
  let cluster: any;
  for (let page = 1; page <= 100; page++) {
    const result = await api.api("/v2/databases?per_page=100&page=" + page);
    cluster = result.databases?.find((d: any) => d.name === plan.name);
    if (cluster || !result.links?.pages?.next) break;
  }
  if (cluster) {
    if (!cluster.tags?.includes("rifan-connect"))
      throw new Error(
        "A database with this name exists without the RIFAN management tag; refusing to change its firewall or users",
      );
    if (cluster.engine !== plan.engine || cluster.region !== plan.region)
      throw new Error(
        "A database with this name already exists with different settings; refusing to replace it",
      );
  } else {
    cluster = (await api.api("/v2/databases", "POST", plan)).database;
    if (!cluster?.id)
      throw new Error("DigitalOcean did not confirm the created cluster");
  }
  await api.api(
    "/v2/databases/" + encodeURIComponent(cluster.id) + "/firewall",
    "PUT",
    { rules },
  );
  for (let attempt = 0; cluster.status !== "online"; attempt++) {
    if (attempt >= 240)
      throw new Error(
        "Database provisioning is still in progress; rerun to resume without creating a second cluster",
      );
    onStatus?.(cluster.status || "creating");
    await new Promise((r) => setTimeout(r, 5000));
    cluster = (await api.api("/v2/databases/" + encodeURIComponent(cluster.id)))
      .database;
  }
  const id = encodeURIComponent(cluster.id);
  const databases = await api.api("/v2/databases/" + id + "/dbs");
  if (!databases.dbs?.some((d: any) => d.name === "rifan"))
    await api.api("/v2/databases/" + id + "/dbs", "POST", { name: "rifan" });
  const users = await api.api("/v2/databases/" + id + "/users");
  let app = users.users?.find((u: any) => u.name === "rifan_app");
  if (!app) {
    const created = await api.api("/v2/databases/" + id + "/users", "POST", {
      name: "rifan_app",
    });
    app = created.user;
  }
  if (!app?.password) {
    const details = await api.api("/v2/databases/" + id + "/users/rifan_app");
    app = details.user;
  }
  if (!app?.password)
    throw new Error("The application database user password is unavailable");
  const cert = await api.api("/v2/databases/" + id + "/ca");
  const ca = certificatePEM(cert.ca?.certificate || "");
  const owner = { ...cluster.connection, database: "rifan" };
  if (!owner.host || !owner.password || !owner.user)
    throw new Error("Database connection details are incomplete");
  const url = (user: string, password: string) => {
    const result = new URL(
      "postgresql://" + owner.host + ":" + owner.port + "/rifan",
    );
    result.username = user;
    result.password = password;
    result.searchParams.set("sslmode", "verify-full");
    return result.href;
  };
  return {
    id: cluster.id,
    name: cluster.name,
    ca,
    migrationUrl: url(owner.user, owner.password),
    applicationUrl: url(app.name, app.password),
  };
}
