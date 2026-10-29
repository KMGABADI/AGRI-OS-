import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import {
  ENTITIES,
  ROLES,
  canEdit,
  DEFAULT_SETTINGS,
  names,
  type Entity,
  type Row,
  type Session,
} from "../src/model";
import { openDatabase, seedDemo } from "./database";
import { normalizeInput, suggestMapping } from "../src/lib/importing";
import { validate } from "./validation";
import {
  registerOperations,
  validateLinks,
  canPlan,
  validateBoundary,
} from "./features/operations";
import { createSecurity, type Mailer } from "./features/security";
import {
  createPaystack,
  type PaymentGateway,
  paymentState,
} from "./features/paystack";
import {
  primaryScope,
  relationshipScope,
  farmerScopeSql,
} from "./features/policy";
import { seedOperationsDemo } from "./features/demo";
import { intelligenceFor } from "./features/intelligence";
import { phoneKeys, canonicalPhone } from "../src/lib/phone";
import { registerDataQuality, reconcileImport } from "./features/data-quality";
import {
  createGoogleConnection,
  googleApiFailure,
  type GoogleOAuthFactory,
  GMAIL_SCOPE,
} from "./features/google";

type R = Request & { actor: Session };
function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
const hash = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString("hex");
const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  ...JSON.parse(u.scope || "{}"),
  twoFactorEnabled: !!u.twofa_enabled,
  twoFactorRequired: !!u.twofa_required,
});
const safe =
  (fn: (req: R, res: Response) => any) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => fn(req as R, res))
      .catch(next);
  };
const tokenHash = (s: string) => createHash("sha256").update(s).digest("hex");
export function createApi(
  options: {
    filename?: string;
    mailer?: Mailer;
    googleOAuthFactory?: GoogleOAuthFactory;
    paystack?: PaymentGateway;
    paystackSecret?: string;
    demo?: boolean;
    sheetsAdapter?: {
      read: (url: string) => Promise<any[][]>;
      write?: (url: string, values: any[][]) => Promise<void>;
    };
  } = {},
) {
  const publicUrl = (
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    ""
  ).replace(/\/+$/, "");
  let publicOrigin: string | undefined;
  if (publicUrl) {
    try {
      const parsed = new URL(publicUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      publicOrigin = parsed.origin;
    } catch {
      throw new Error("PUBLIC_URL must be a valid HTTP(S) application URL.");
    }
  }
  const s = openDatabase(
    options.filename || process.env.RIFAN_DB_PATH || ".data/rifan.sqlite",
  );
  const demoEnabled =
    options.demo ??
    (process.env.NODE_ENV !== "production" ||
      process.env.ENABLE_DEMO === "true");
  if (demoEnabled) {
    seedDemo(s);
    seedOperationsDemo(s);
  }
  const app = express();
  app.disable("x-powered-by");
  if (process.env.RENDER === "true") app.set("trust proxy", 1);
  const security = createSecurity(s, options.mailer);
  const payments = createPaystack(s, options.paystack, options.paystackSecret);
  const googleConnection = createGoogleConnection(
    s,
    publicUrl,
    options.googleOAuthFactory,
  );
  payments.mountWebhook(app);
  app.use(express.json({ limit: "8mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      let origin: URL;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        return res
          .status(403)
          .json({ error: "A valid same-site Origin is required" });
      }
      if (origin.host !== req.headers.host && origin.origin !== publicOrigin)
        return res
          .status(403)
          .json({ error: "Cross-origin write requests are not allowed" });
    }
    next();
  });
  const attempts = new Map<string, { count: number; until: number }>();
  const rateLimit = (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || "local";
    let a = attempts.get(key);
    if (!a || a.until < Date.now()) {
      a = { count: 0, until: Date.now() + 60000 };
      attempts.set(key, a);
    }
    if (++a.count > 20)
      return res
        .status(429)
        .json({ error: "Too many sign-in attempts. Try again in a minute." });
    next();
  };
  const issue = (res: Response, actor: Session) => {
    const token = randomBytes(32).toString("hex");
    s.db
      .prepare(
        "INSERT INTO sessions(token,user_id,space,expires,data) VALUES(?,?,?,?,?)",
      )
      .run(
        tokenHash(token),
        actor.id,
        actor.space,
        Date.now() + 8 * 60 * 60 * 1000,
        JSON.stringify(actor),
      );
    res.cookie("rifan_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.COOKIE_SECURE === "true" ||
        (process.env.RENDER === "true" &&
          process.env.COOKIE_SECURE !== "false"),
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    return actor;
  };
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("rifan_session="))
      ?.slice(14);
    const session = token
      ? (s.db
          .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
          .get(tokenHash(token), Date.now()) as any)
      : null;
    if (!session && req.originalUrl.split("?")[0] === "/api/google/callback")
      return res.redirect("/connections?google=sign_in_required");
    if (!session)
      return res
        .status(401)
        .json({ error: "Sign in to access your RIFAN workspace." });
    let actor = JSON.parse(session.data) as Session;
    if (!actor.demo) {
      const user = s.db
        .prepare("SELECT * FROM users WHERE id=? AND space=?")
        .get(actor.id, actor.space);
      if (!user)
        return res
          .status(401)
          .json({ error: "This account is no longer active." });
      actor = { ...actor, ...publicUser(user) };
    }
    (req as R).actor = actor;
    s.withActor(actor, () => next());
  };
  const allowed = (actor: Session, entity: Entity, row: Row): boolean => {
    if (["Super Admin", "Admin"].includes(actor.role)) return true;
    if (entity === "chats")
      return row.userId === actor.id && Array.isArray(row.messages);
    if (entity === "farmers")
      return primaryScope(actor, row) || relationshipScope(s, actor, row.id);
    if (
      [
        "participations",
        "farmLocations",
        "fieldValidations",
        "harvestTasks",
      ].includes(entity)
    ) {
      if (
        actor.organizationId &&
        row.organizationId &&
        row.organizationId !== actor.organizationId
      )
        return false;
      if (
        actor.states?.length &&
        row.state &&
        !actor.states.includes(row.state)
      )
        return false;
      if (actor.lgas?.length && row.lga && !actor.lgas.includes(row.lga))
        return false;
    }
    if (["seasons", "interventions"].includes(entity) && row.programId) {
      const parent = s.get(actor.space, "programs", row.programId);
      if (!parent || !allowed(actor, "programs", parent)) return false;
    }
    if (
      [
        "interventions",
        "participations",
        "farmLocations",
        "fieldValidations",
        "harvestTasks",
        "resources",
        "payments",
        "applications",
        "alerts",
      ].includes(entity) &&
      row.farmerId
    ) {
      const farmer = s.get(actor.space, "farmers", row.farmerId);
      return !!farmer && allowed(actor, "farmers", farmer);
    }
    if (entity === "warehouses" && actor.warehouseIds?.length)
      return actor.warehouseIds.includes(row.id);
    if (entity === "movements") {
      const w = s.get(actor.space, "warehouses", row.warehouseId);
      return !!w && allowed(actor, "warehouses", w);
    }
    if (
      actor.organizationId &&
      ["organizations", "programs", "templates", "workbooks"].includes(entity)
    )
      return entity === "organizations"
        ? row.id === actor.organizationId
        : row.organizationId === actor.organizationId;
    return true;
  };
  const requireWrite = (
    actor: Session,
    entity: Entity | "users" | "settings",
  ) => {
    if (entity === "harvestTasks" && !canPlan(actor))
      fail(403, "Harvest planning requires an approved officer or manager");
    if (!canEdit(actor.role, entity))
      fail(403, "Your role does not allow this action.");
  };
  const refCheck = (actor: Session, entity: Entity, row: Row) => {
    for (const [key, target] of [
      ["organizationId", "organizations"],
      ["programId", "programs"],
      ["farmerId", "farmers"],
      ["warehouseId", "warehouses"],
    ] as [string, Entity][]) {
      if (row[key]) {
        const ref = s.get(actor.space, target, row[key]);
        if (!ref || !allowed(actor, target, ref))
          fail(400, `Invalid or inaccessible ${key}`);
      }
    }
    if (entity === "farmers" && row.photo) {
      const photoId = String(row.photo).match(
        /^\/api\/files\/([a-f0-9-]+)$/,
      )?.[1];
      const photo = photoId
        ? (s.db
            .prepare("SELECT farmer_id,mime FROM files WHERE id=? AND space=?")
            .get(photoId, actor.space) as any)
        : null;
      if (
        !photo ||
        photo.farmer_id !== row.id ||
        !String(photo.mime).startsWith("image/")
      )
        fail(
          400,
          "Portrait must be an uploaded image belonging to this member",
        );
    }
    if (entity === "farmers" && row.programId) {
      const p = s.get(actor.space, "programs", row.programId)!;
      if (
        p.organizationId &&
        row.organizationId &&
        p.organizationId !== row.organizationId
      )
        fail(400, "Programme must belong to the selected organization");
    }
  };
  const duplicate = (space: string, row: Row, except = "") => {
    for (const key of ["primaryPhone", "bvn", "nin", "farmerID"]) {
      if (!row[key]) continue;
      const values = key === "primaryPhone" ? phoneKeys(row[key]) : [row[key]];
      const hit = s.db
        .prepare(
          `SELECT data FROM records WHERE space=? AND entity='farmers' AND json_extract(data,'$.${key}') IN (${values.map(() => "?").join(",")}) AND id<>? LIMIT 1`,
        )
        .get(space, ...values, except) as any;
      if (hit) return JSON.parse(hit.data) as Row;
    }
    return undefined;
  };
  const cleanFarmer = (row: Row) => ({
    ...row,
    farmerID:
      row.farmerID ||
      `RIFAN-${String(row.state).slice(0, 3).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`,
    profileStatus: row.profileStatus || "Pending",
    registrationDate:
      row.registrationDate ||
      (row.registrationYear
        ? undefined
        : new Date().toISOString().slice(0, 10)),
    registrationRecordedAt:
      row.registrationRecordedAt || new Date().toISOString(),
  });
  security.mountPublic(app, issue);
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", app: "RIFAN Connect", storage: "sqlite" }),
  );
  app.get("/api/auth/status", (_req, res) =>
    res.json({
      needsSetup: !s.db
        .prepare("SELECT id FROM users WHERE space='workspace' LIMIT 1")
        .get(),
      demoEnabled,
    }),
  );
  app.post(
    "/api/auth/demo",
    rateLimit,
    safe((req, res) => {
      if (!demoEnabled) fail(404, "Demo workspace is disabled");
      const role = ROLES.includes(req.body.role)
        ? req.body.role
        : "Super Admin";
      res.json(
        issue(res, {
          id: "demo-" + role.toLowerCase().replaceAll(" ", "-"),
          name: "Demo " + role,
          email: "demo@rifan.local",
          role,
          space: "demo",
          demo: true,
        }),
      );
    }),
  );
  app.post(
    "/api/auth/setup",
    rateLimit,
    safe((req, res) => {
      if (
        s.db
          .prepare("SELECT id FROM users WHERE space='workspace' LIMIT 1")
          .get()
      )
        fail(409, "Workspace already initialized. Please sign in.");
      const { email, password, name } = req.body;
      if (
        !email ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        typeof password !== "string" ||
        password.length < 12 ||
        typeof name !== "string" ||
        name.trim().length < 2
      )
        fail(
          400,
          "Use your name, a valid email and a password of at least 12 characters.",
        );
      const id = randomUUID(),
        salt = randomBytes(16).toString("hex");
      s.db
        .prepare(
          "INSERT INTO users(id,space,email,name,role,hash,salt) VALUES(?,'workspace',?,?,'Super Admin',?,?)",
        )
        .run(
          id,
          email.toLowerCase().trim(),
          name.trim(),
          hash(password, salt),
          salt,
        );
      const actor: Session = {
        id,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: "Super Admin",
        space: "workspace",
        demo: false,
      };
      s.audit(
        actor,
        "SETUP",
        "workspace",
        "workspace",
        "Initialized independent RIFAN workspace",
      );
      res.status(201).json(issue(res, actor));
    }),
  );
  app.post(
    "/api/auth/login",
    rateLimit,
    safe(async (req, res) => {
      const { email, password } = req.body;
      const u = s.db
        .prepare("SELECT * FROM users WHERE space='workspace' AND email=?")
        .get(String(email).toLowerCase().trim()) as any;
      if (
        !u ||
        typeof password !== "string" ||
        password.length > 1000 ||
        !timingSafeEqual(
          Buffer.from(u.hash, "hex"),
          Buffer.from(hash(password, u.salt), "hex"),
        )
      )
        fail(401, "Email or password is incorrect");
      if (security.needs(u)) {
        res.json(await security.send(u, "login"));
        return;
      }
      res.json(
        issue(res, {
          ...publicUser(u),
          space: u.space,
          demo: false,
        } as Session),
      );
    }),
  );
  app.post(
    "/api/auth/logout",
    authenticate,
    safe((req, res) => {
      const token = (req.headers.cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("rifan_session="))
        ?.slice(14);
      if (token)
        s.db
          .prepare("DELETE FROM sessions WHERE token=?")
          .run(tokenHash(token));
      res.clearCookie("rifan_session");
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/auth/me",
    authenticate,
    safe((req, res) => res.json(req.actor)),
  );

  app.post(
    "/api/public/applications",
    rateLimit,
    safe((req, res) => {
      const settings = s.settings("workspace");
      if (
        !settings.publicRegistrationEnabled ||
        process.env.ENABLE_PUBLIC_REGISTRATION !== "true"
      )
        fail(
          503,
          "Farmer website registration is not open yet. Contact your RIFAN chapter.",
        );
      if (req.body.consent !== true)
        fail(400, "Consent to process membership information is required");
      const keys = [
        "firstName",
        "middleName",
        "lastName",
        "gender",
        "primaryPhone",
        "country",
        "state",
        "lga",
        "ward",
        "community",
        "crop",
        "farmSize",
        "irrigation",
        "variety",
      ];
      const input = Object.fromEntries(
        keys
          .filter((k) => req.body[k] !== undefined)
          .map((k) => [k, req.body[k]]),
      );
      let farmer = validate("farmers", {
        ...input,
        id: randomUUID(),
        profileStatus: "Pending",
        kycComplete: false,
      });
      if (duplicate("workspace", farmer))
        fail(
          409,
          "An application or membership already exists for this phone. Contact your chapter for help.",
        );
      farmer = cleanFarmer({
        ...farmer,
        membershipStatus: "Awaiting review",
        paymentStatus: "Unpaid",
        registrationSource: "Farmer website",
      });
      const application = {
        id: randomUUID(),
        farmerId: farmer.id,
        status: "Submitted",
        source: "Farmer website",
        date: new Date().toISOString(),
        consentAt: new Date().toISOString(),
        registrationFee: settings.registrationFee,
        membershipFee: settings.membershipFee,
        currency: "NGN",
      };
      s.transaction(() => {
        s.put("workspace", "farmers", farmer);
        s.put("workspace", "applications", application);
        s.audit(
          {
            id: "public-registration",
            name: "Farmer website",
            space: "workspace",
          } as Session,
          "APPLICATION",
          "farmers",
          farmer.id,
          "Received farmer website membership application",
        );
      });
      res.status(201).json({
        applicationId: application.id,
        memberReference: farmer.farmerID,
        status: "Submitted",
        fees: {
          registration: settings.registrationFee,
          membership: settings.membershipFee,
          currency: "NGN",
        },
        paymentCollectionEnabled: false,
      });
    }),
  );
  app.use("/api", authenticate);
  security.mountPrivate(app);
  const farmerWhere = (a: Session, filters: any = {}) => {
    const clauses = ["space=?", "entity='farmers'"];
    const args: any[] = [a.space];
    if (!["Super Admin", "Admin"].includes(a.role)) {
      const scope = farmerScopeSql(a);
      clauses.push(scope.clause);
      args.push(...scope.args);
    }
    for (const key of [
      "state",
      "profileStatus",
      "gender",
      "organizationId",
      "programId",
      "crop",
    ])
      if (filters[key]) {
        clauses.push(`json_extract(data,'$.${key}')=?`);
        args.push(String(filters[key]));
      }
    if (filters.located === "true")
      clauses.push(
        "json_type(data,'$.latitude') IN ('integer','real') AND json_type(data,'$.longitude') IN ('integer','real')",
      );
    if (filters.q) {
      clauses.push(
        "(json_extract(data,'$.firstName')||' '||json_extract(data,'$.lastName')||' '||coalesce(json_extract(data,'$.farmerID'),'')||' '||coalesce(json_extract(data,'$.primaryPhone'),'')) LIKE ? ESCAPE '\\'",
      );
      args.push("%" + String(filters.q).replace(/[\\%_]/g, "\\$&") + "%");
    }
    return { where: clauses.join(" AND "), args };
  };
  const redact = (actor: Session, rows: Row[]) =>
    rows.map((r) => {
      if (!["Super Admin", "Admin", "Manager"].includes(actor.role)) {
        r = { ...r };
        delete r.bvn;
        delete r.nin;
        delete r.accountNumber;
      }
      return r;
    });
  const features = { app, s, allowed, requireWrite, farmerWhere };
  googleConnection.mount(app);
  registerOperations(features);
  registerDataQuality({ ...features, duplicate, refCheck });
  payments.mountPrivate(features);
  const summaries = new Map<string, { version: string; value: any }>();
  const summaryFor = (actor: Session, filters: any = {}) => {
    const { where, args } = farmerWhere(actor, filters);
    const cacheKey = where + JSON.stringify(args);
    const version = s.version();
    const cached = summaries.get(cacheKey);
    if (cached?.version === version) return cached.value;
    const totals = s.db
      .prepare(
        `SELECT count(*) AS totalFarmers,coalesce(sum(cast(json_extract(data,'$.farmSize') AS REAL)),0) AS hectares,sum(json_extract(data,'$.profileStatus')='Active') AS active,sum(json_extract(data,'$.kycComplete')=1) AS verified,count(distinct json_extract(data,'$.state')) AS states,sum(json_extract(data,'$.registrationDate') IS NULL) AS undated,sum(json_type(data,'$.latitude') IN ('integer','real') AND json_type(data,'$.longitude') IN ('integer','real')) AS located FROM records WHERE ${where}`,
      )
      .get(...args) as any;
    const grouped = (key: string) =>
      s.db
        .prepare(
          `SELECT coalesce(json_extract(data,'$.${key}'),'Not recorded') AS name,count(*) AS members,coalesce(sum(cast(json_extract(data,'$.loanApproved') AS REAL)),0) AS loans FROM records WHERE ${where} GROUP BY name ORDER BY members DESC`,
        )
        .all(...args);
    const registrations = s.db
      .prepare(
        `SELECT substr(json_extract(data,'$.registrationDate'),1,7) AS month,count(*) AS count FROM records WHERE ${where} GROUP BY month ORDER BY month`,
      )
      .all(...args);
    const value = {
      ...totals,
      regions: grouped("state"),
      genders: grouped("gender"),
      crops: grouped("crop"),
      organizations: grouped("organizationId"),
      registrations,
    };
    if (summaries.size > 50) summaries.clear();
    summaries.set(cacheKey, { version, value });
    return value;
  };
  app.get(
    "/api/farmers",
    safe((req, res) => {
      const { where, args } = farmerWhere(req.actor, req.query);
      const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 25)),
        offset = Math.max(0, Number(req.query.offset) || 0);
      const total = (
        s.db
          .prepare(`SELECT count(*) AS n FROM records WHERE ${where}`)
          .get(...args) as any
      ).n;
      const rows = (
        s.db
          .prepare(
            `SELECT data FROM records WHERE ${where} ORDER BY rowid DESC LIMIT ? OFFSET ?`,
          )
          .all(...args, limit, offset) as any[]
      ).map((r) => JSON.parse(r.data));
      res.json({ rows: redact(req.actor, rows), total, offset, limit });
    }),
  );
  app.post(
    "/api/cards/records",
    safe((req, res) => {
      const ids = req.body.ids;
      if (
        !Array.isArray(ids) ||
        ids.length < 1 ||
        ids.length > 500 ||
        ids.some((id: any) => typeof id !== "string")
      )
        fail(400, "Select between 1 and 500 member IDs");
      const rows = [...new Set(ids as string[])].map((id) => {
        const f = s.get(req.actor.space, "farmers", id);
        if (!f || !allowed(req.actor, "farmers", f))
          fail(
            404,
            "A selected member is unavailable or outside your access scope",
          );
        return Object.fromEntries(
          [
            "id",
            "farmerID",
            "firstName",
            "middleName",
            "lastName",
            "title",
            "primaryPhone",
            "state",
            "lga",
            "gender",
            "profileStatus",
            "membershipStatus",
            "registrationDate",
            "registrationYear",
            "photo",
          ]
            .filter((k) => f[k] !== undefined)
            .map((k) => [k, f[k]]),
        );
      });
      res.json(rows);
    }),
  );
  app.post(
    "/api/cards/log",
    safe((req, res) => {
      const ids = req.body.ids;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 500)
        fail(400, "Select up to 500 member profiles");
      for (const id of ids) {
        const f = s.get(req.actor.space, "farmers", String(id));
        if (!f || !allowed(req.actor, "farmers", f))
          fail(404, "Member unavailable or outside assigned scope");
      }
      const kind = ["PDF", "ZIP", "Print", "Certificate"].includes(
        req.body.kind,
      )
        ? req.body.kind
        : "PDF";
      s.audit(
        req.actor,
        "EXPORT",
        "member-cards",
        "batch",
        `${kind}: ${ids.length} authorized member card(s)/document(s)`,
      );
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/calendar",
    safe((req, res) => {
      const month = String(req.query.month || "");
      if (!/^\d{4}-\d{2}$/.test(month)) fail(400, "Provide month as YYYY-MM");
      const { where, args } = farmerWhere(req.actor);
      const condition =
        "(substr(json_extract(data,'$.plantingDate'),1,7)=? OR substr(json_extract(data,'$.harvestDate'),1,7)=?)";
      const rows = (
        s.db
          .prepare(
            `SELECT data FROM records WHERE ${where} AND ${condition} LIMIT 5000`,
          )
          .all(...args, month, month) as any[]
      ).map((r) => JSON.parse(r.data));
      res.json(redact(req.actor, rows));
    }),
  );
  app.get(
    "/api/farmers/:id",
    safe((req, res) => {
      const f = s.get(req.actor.space, "farmers", req.params.id);
      if (!f || !allowed(req.actor, "farmers", f))
        fail(404, "Member not found");
      res.json(redact(req.actor, [f])[0]);
    }),
  );
  app.get(
    "/api/summary",
    safe((req, res) => res.json(summaryFor(req.actor, req.query))),
  );
  app.get(
    "/api/snapshot",
    safe((req, res) => {
      const a = req.actor;
      const { where, args } = farmerWhere(a);
      const farmerRows = (
        s.db
          .prepare(
            `SELECT data FROM records WHERE ${where} ORDER BY rowid DESC LIMIT 1000`,
          )
          .all(...args) as any[]
      ).map((r) => JSON.parse(r.data));
      const data = Object.fromEntries(
        ENTITIES.map((e) => [
          e,
          e === "farmers"
            ? farmerRows
            : [
                  "participations",
                  "farmLocations",
                  "fieldValidations",
                  "harvestTasks",
                ].includes(e)
              ? (
                  s.db
                    .prepare(
                      "SELECT data FROM records WHERE space=? AND entity=? ORDER BY rowid DESC LIMIT 1000",
                    )
                    .all(a.space, e) as any[]
                )
                  .map((r) => JSON.parse(r.data))
                  .filter((r) => allowed(a, e, r))
              : s.all(a.space, e).filter((r) => allowed(a, e, r)),
        ]),
      );
      const summary = summaryFor(a);
      if (!["Super Admin", "Admin", "Manager"].includes(a.role))
        for (const f of data.farmers) {
          delete f.bvn;
          delete f.nin;
          delete f.accountNumber;
        }
      const activity = ["Super Admin", "Admin", "Manager"].includes(a.role)
        ? s.db
            .prepare(
              "SELECT id,user_name AS userName,action,entity,entity_id AS entityId,details,timestamp FROM audit WHERE space=? ORDER BY id DESC LIMIT 300",
            )
            .all(a.space)
        : [];
      const users = ["Super Admin", "Admin"].includes(a.role)
        ? (
            s.db
              .prepare("SELECT * FROM users WHERE space=?")
              .all(a.space) as any[]
          ).map(publicUser)
        : [];
      res.json({
        data,
        summary,
        farmerWindow: {
          loaded: farmerRows.length,
          total: summary.totalFarmers,
        },
        settings: s.settings(a.space),
        activity,
        users,
        integrations: {
          gemini: !!process.env.GEMINI_API_KEY,
          google: googleConnection.configured,
          googleConnected: googleConnection.status(a).connected,
        },
      });
    }),
  );
  app.put(
    "/api/profile",
    safe((req, res) => {
      const { name } = req.body;
      if (typeof name !== "string" || name.trim().length < 2)
        fail(400, "Name must be at least two characters");
      if (req.actor.demo)
        fail(400, "The demonstration account cannot be changed");
      s.db
        .prepare("UPDATE users SET name=? WHERE id=? AND space=?")
        .run(name.trim(), req.actor.id, req.actor.space);
      res.json({ success: true });
    }),
  );
  app.put(
    "/api/profile/password",
    safe((req, res) => {
      if (req.actor.demo) fail(400, "Demo account passwords cannot be changed");
      const u = s.db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(req.actor.id) as any;
      const { currentPassword, password } = req.body;
      if (
        typeof currentPassword !== "string" ||
        !timingSafeEqual(
          Buffer.from(u.hash, "hex"),
          Buffer.from(hash(currentPassword, u.salt), "hex"),
        )
      )
        fail(403, "Current password is incorrect");
      if (
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 1000
      )
        fail(400, "Use at least 12 characters");
      const salt = randomBytes(16).toString("hex");
      s.db
        .prepare("UPDATE users SET hash=?,salt=? WHERE id=?")
        .run(hash(password, salt), salt, req.actor.id);
      s.db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.actor.id);
      res.json({ success: true });
    }),
  );
  app.put(
    "/api/settings",
    safe((req, res) => {
      requireWrite(req.actor, "settings");
      const keys = Object.keys(DEFAULT_SETTINGS);
      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => keys.includes(k)),
      );
      if (
        updates.primaryColor &&
        !/^#[0-9a-f]{6}$/i.test(String(updates.primaryColor))
      )
        fail(400, "Use a six-digit hex color");
      if (
        updates.logo &&
        !/^(\/|data:image\/(png|jpeg|webp);base64,)/.test(String(updates.logo))
      )
        fail(400, "Use a local logo or uploaded image");
      for (const k of ["registrationFee", "membershipFee"])
        if (
          updates[k] !== undefined &&
          (!Number.isFinite(Number(updates[k])) || Number(updates[k]) < 0)
        )
          fail(400, "Fees must be non-negative amounts");
      if (updates.requireTwoFactor && !security.configured())
        fail(503, "Configure branded OTP email delivery before requiring 2FA");
      const settings = { ...s.settings(req.actor.space), ...updates };
      s.transaction(() => {
        s.db
          .prepare(
            "INSERT INTO settings(space,data) VALUES(?,?) ON CONFLICT(space) DO UPDATE SET data=excluded.data",
          )
          .run(req.actor.space, JSON.stringify(settings));
        s.audit(
          req.actor,
          "UPDATE",
          "settings",
          "main",
          "Updated branding and workspace configuration",
        );
      });
      res.json(settings);
    }),
  );
  app.post(
    "/api/users",
    safe((req, res) => {
      requireWrite(req.actor, "users");
      if (req.actor.demo)
        fail(
          400,
          "Account creation is disabled in the shared demo. Create your own workspace to manage users.",
        );
      const {
        name,
        email,
        password,
        role,
        organizationId,
        states,
        lgas,
        warehouseIds,
      } = req.body;
      if (
        typeof name !== "string" ||
        name.length < 2 ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        typeof password !== "string" ||
        password.length < 12 ||
        !ROLES.includes(role)
      )
        fail(
          400,
          "Provide a name, valid email, supported role, and password of at least 12 characters",
        );
      if (req.actor.role === "Admin" && ["Super Admin", "Admin"].includes(role))
        fail(403, "Only a Super Admin can appoint administrators");
      const id = randomUUID(),
        salt = randomBytes(16).toString("hex");
      for (const value of [states, lgas, warehouseIds])
        if (
          value !== undefined &&
          (!Array.isArray(value) ||
            value.some((v: any) => typeof v !== "string" || v.length > 100))
        )
          fail(400, "Access scope must contain lists of valid names or IDs");
      if (
        organizationId &&
        !s.get(req.actor.space, "organizations", organizationId)
      )
        fail(400, "Organization scope does not exist");
      const scope = {
        organizationId,
        states,
        lgas,
        warehouseIds,
        plannerApproved: req.body.plannerApproved === true,
      };
      s.transaction(() => {
        s.db
          .prepare(
            "INSERT INTO users(id,space,email,name,role,hash,salt,scope) VALUES(?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            req.actor.space,
            email.toLowerCase().trim(),
            name,
            role,
            hash(password, salt),
            salt,
            JSON.stringify(scope),
          );
        s.audit(
          req.actor,
          "CREATE",
          "users",
          id,
          `Created ${role} account: ${name}`,
        );
      });
      res.status(201).json({ id, name, email, role, ...scope });
    }),
  );
  app.put(
    "/api/users/:id",
    safe((req, res) => {
      requireWrite(req.actor, "users");
      const u = s.db
        .prepare("SELECT * FROM users WHERE id=? AND space=?")
        .get(req.params.id, req.actor.space) as any;
      if (!u) fail(404, "User not found");
      const role = req.body.role || u.role;
      if (!ROLES.includes(role)) fail(400, "Invalid role");
      if (req.actor.id === u.id && role !== u.role)
        fail(400, "Ask another administrator to change your role");
      if (
        req.actor.role === "Admin" &&
        (["Super Admin", "Admin"].includes(u.role) ||
          ["Super Admin", "Admin"].includes(role))
      )
        fail(403, "Only a Super Admin can manage administrators");
      for (const key of ["states", "lgas", "warehouseIds"])
        if (
          req.body[key] !== undefined &&
          (!Array.isArray(req.body[key]) ||
            req.body[key].some(
              (v: any) => typeof v !== "string" || v.length > 100,
            ))
        )
          fail(400, "Access scope must contain lists of names or IDs");
      if (
        req.body.organizationId &&
        !s.get(req.actor.space, "organizations", req.body.organizationId)
      )
        fail(400, "Organization scope does not exist");
      const scope = Object.fromEntries(
        [
          "organizationId",
          "states",
          "lgas",
          "warehouseIds",
          "plannerApproved",
        ].map((k) => [k, req.body[k] ?? JSON.parse(u.scope || "{}")[k]]),
      );
      s.transaction(() => {
        s.db
          .prepare("UPDATE users SET role=?,scope=? WHERE id=?")
          .run(role, JSON.stringify(scope), u.id);
        if (req.body.password) {
          if (
            typeof req.body.password !== "string" ||
            req.body.password.length < 12
          )
            fail(400, "Use at least 12 characters");
          const salt = randomBytes(16).toString("hex");
          s.db
            .prepare("UPDATE users SET hash=?,salt=? WHERE id=?")
            .run(hash(req.body.password, salt), salt, u.id);
          s.db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
        }
        s.audit(
          req.actor,
          "UPDATE",
          "users",
          u.id,
          `Updated access for ${u.name}`,
        );
      });
      res.json({ success: true });
    }),
  );
  app.delete(
    "/api/users/:id",
    safe((req, res) => {
      requireWrite(req.actor, "users");
      const u = s.db
        .prepare("SELECT * FROM users WHERE id=? AND space=?")
        .get(req.params.id, req.actor.space) as any;
      if (!u) fail(404, "User not found");
      if (u.id === req.actor.id)
        fail(400, "You cannot delete your own account");
      if (
        req.actor.role === "Admin" &&
        ["Admin", "Super Admin"].includes(u.role)
      )
        fail(403, "Only a Super Admin can remove administrators");
      s.transaction(() => {
        s.db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
        s.db.prepare("DELETE FROM users WHERE id=?").run(u.id);
        s.audit(
          req.actor,
          "DELETE",
          "users",
          u.id,
          `Removed account: ${u.name}`,
        );
      });
      res.json({ success: true });
    }),
  );

  app.post(
    "/api/membership/payments",
    safe((req, res) => {
      if (!["Super Admin", "Admin", "Manager"].includes(req.actor.role))
        fail(403, "Only an administrator or manager can record payments");
      const { farmerId, amount, reference, type, method, period } = req.body;
      const farmer = s.get(req.actor.space, "farmers", farmerId);
      if (!farmer || !allowed(req.actor, "farmers", farmer))
        fail(404, "Member not found");
      if (
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0 ||
        Number(amount) > 1e9 ||
        Math.abs(Number(amount) * 100 - Math.round(Number(amount) * 100)) >
          0.00001 ||
        typeof reference !== "string" ||
        reference.trim().length < 4 ||
        !["Registration", "Membership"].includes(type) ||
        !["Bank transfer", "Cash", "POS"].includes(method)
      )
        fail(
          400,
          "Provide a positive amount, receipt/reference, fee type and payment method",
        );
      if (
        s
          .all(req.actor.space, "payments")
          .some(
            (p) =>
              String(p.reference).toUpperCase() ===
              reference.trim().toUpperCase(),
          )
      )
        fail(409, "This transaction reference has already been recorded");
      const settings = s.settings(req.actor.space);
      const expected =
        type === "Registration"
          ? Number(settings.registrationFee)
          : Number(settings.membershipFee);
      if (!(expected > 0))
        fail(
          400,
          "Configure the fee schedule in Settings before recording payments",
        );
      const row = {
        id: randomUUID(),
        farmerId,
        amount: Number(amount),
        reference: reference.trim(),
        type,
        method,
        period: String(period || new Date().getFullYear()),
        currency: "NGN",
        status: "Pending verification",
        date: new Date().toISOString(),
        recordedBy: req.actor.id,
        expected,
      };
      s.transaction(() => {
        s.put(req.actor.space, "payments", row);
        s.audit(
          req.actor,
          "PAYMENT_RECORDED",
          "payments",
          row.id,
          `Recorded ${type.toLowerCase()} payment for ${farmer.farmerID}; pending verification`,
        );
      });
      res.status(201).json(row);
    }),
  );
  app.post(
    "/api/membership/payments/:id/verify",
    safe((req, res) => {
      if (!["Super Admin", "Admin"].includes(req.actor.role))
        fail(403, "Only administrators can verify payments");
      const row = s.get(req.actor.space, "payments", req.params.id);
      if (!row) fail(404, "Payment not found");
      if (row.status !== "Pending verification")
        fail(409, "This payment has already been processed");
      if (typeof req.body.approve !== "boolean")
        fail(400, "Choose verify or reject explicitly");
      const status = req.body.approve === true ? "Verified" : "Rejected";
      s.transaction(() => {
        s.put(req.actor.space, "payments", {
          ...row,
          status,
          verifiedBy: req.actor.id,
          verifiedAt: new Date().toISOString(),
        });
        paymentState(s, req.actor.space, row.farmerId);
        s.audit(
          req.actor,
          "PAYMENT_" + status.toUpperCase(),
          "payments",
          row.id,
          `${status} reference ${row.reference}`,
        );
      });
      res.json({ success: true, status });
    }),
  );
  app.post(
    "/api/membership/applications/:id/review",
    safe((req, res) => {
      if (!["Super Admin", "Admin", "Manager"].includes(req.actor.role))
        fail(403, "Only managers and administrators can review applications");
      const row = s.get(req.actor.space, "applications", req.params.id);
      if (!row || !allowed(req.actor, "applications", row))
        fail(404, "Application not found");
      if (
        !["Approved", "Rejected", "Needs information"].includes(req.body.status)
      )
        fail(400, "Invalid review status");
      s.transaction(() => {
        s.put(req.actor.space, "applications", {
          ...row,
          status: req.body.status,
          notes: String(req.body.notes || ""),
          reviewedAt: new Date().toISOString(),
          reviewedBy: req.actor.id,
        });
        const f = s.get(req.actor.space, "farmers", row.farmerId)!;
        s.put(req.actor.space, "farmers", {
          ...f,
          membershipStatus:
            req.body.status === "Approved"
              ? "Awaiting payment"
              : req.body.status,
        });
        s.audit(
          req.actor,
          "REVIEW",
          "applications",
          row.id,
          `Application ${req.body.status.toLowerCase()}`,
        );
      });
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/stock",
    safe((req, res) => {
      requireWrite(req.actor, "warehouses");
      const { warehouseId, type, quantity, reference } = req.body;
      const w = s.get(req.actor.space, "warehouses", warehouseId);
      if (!w || !allowed(req.actor, "warehouses", w))
        fail(404, "Warehouse not found");
      const q = Number(quantity);
      if (
        !Number.isFinite(q) ||
        q <= 0 ||
        !["Receipt", "Dispatch"].includes(type)
      )
        fail(400, "Use a positive quantity and Receipt or Dispatch");
      if (w.status !== "Active")
        fail(400, "Stock movements require an active warehouse");
      const total =
        Number(w.currentInventory || 0) + (type === "Receipt" ? q : -q);
      if (total < 0 || total > Number(w.capacity))
        fail(400, "Movement exceeds available stock or warehouse capacity");
      const row = {
        id: randomUUID(),
        warehouseId,
        type,
        quantity: q,
        reference: String(reference || ""),
        date: new Date().toISOString(),
      };
      s.transaction(() => {
        s.put(req.actor.space, "warehouses", { ...w, currentInventory: total });
        s.put(req.actor.space, "movements", row);
        s.audit(
          req.actor,
          "STOCK",
          "warehouses",
          warehouseId,
          `${type}: ${q} MT at ${w.name}`,
        );
      });
      res.status(201).json(row);
    }),
  );
  app.post(
    "/api/import/stage",
    safe((req, res) => {
      requireWrite(req.actor, "imports");
      const { rows, batchId, source, revalidate } = req.body;
      if (
        !Array.isArray(rows) ||
        rows.length > 1000 ||
        typeof batchId !== "string" ||
        batchId.length > 100
      )
        fail(400, "Stage up to 1,000 source records with a batch ID");
      const result = { valid: 0, invalid: 0, duplicates: 0, staged: 0 };
      s.transaction(() => {
        for (const item of rows) {
          const offset = Number(item.sourceRow);
          if (!Number.isInteger(offset) || offset < 1)
            fail(400, "Source row must be a positive integer");
          const existing = s.db
            .prepare(
              "SELECT id,status,raw FROM source_records WHERE batch_id=? AND space=? AND source_row=?",
            )
            .get(batchId, req.actor.space, offset) as any;
          if (existing && (!revalidate || existing.status !== "Invalid"))
            continue;
          if (
            existing &&
            existing.raw !== JSON.stringify(item.raw || item.data)
          )
            fail(
              409,
              "Cannot replace an archived source row with different raw data",
            );
          let status = "Valid",
            reason = "",
            normalized: any = item.data ? { ...item.data } : undefined;
          let match: Row | undefined;
          try {
            normalized = validate("farmers", {
              ...item.data,
              id: randomUUID(),
            });
            refCheck(req.actor, "farmers", normalized);
            if (!allowed(req.actor, "farmers", normalized))
              fail(403, "Outside your assigned scope");
            match = duplicate(req.actor.space, normalized);
            if (match) {
              status = "Duplicate";
              reason = "Existing member matches phone, BVN, NIN or member ID";
            }
          } catch (e) {
            status = "Invalid";
            reason = (e as Error).message;
          }
          if (existing) {
            s.db
              .prepare(
                "UPDATE source_records SET submitted=?,normalized=?,status=?,reason=?,farmer_id=? WHERE id=?",
              )
              .run(
                JSON.stringify(item.data),
                normalized ? JSON.stringify(normalized) : null,
                status,
                reason,
                match?.id || null,
                existing.id,
              );
          } else {
            s.db
              .prepare(
                "INSERT INTO source_records(batch_id,space,source_row,raw,normalized,status,reason,farmer_id,submitted) VALUES(?,?,?,?,?,?,?,?,?)",
              )
              .run(
                batchId,
                req.actor.space,
                offset,
                JSON.stringify(item.raw || item.data),
                normalized ? JSON.stringify(normalized) : null,
                status,
                reason,
                match?.id || null,
                JSON.stringify(item.data),
              );
          }
          result.staged++;
          if (status === "Valid") result.valid++;
          else if (status === "Duplicate") result.duplicates++;
          else result.invalid++;
        }
        const existing = s.get(req.actor.space, "imports", batchId);
        s.put(req.actor.space, "imports", {
          id: batchId,
          name: String(source || "Source upload"),
          date: existing?.date || new Date().toISOString(),
          status: "Staged",
          count: existing?.count || 0,
        });
      });
      res.json(result);
    }),
  );
  app.post(
    "/api/import/staged/:id/commit",
    safe((req, res) => {
      requireWrite(req.actor, "imports");
      const entries = s.db
        .prepare(
          "SELECT id,normalized FROM source_records WHERE space=? AND batch_id=? AND status='Valid' LIMIT 1000",
        )
        .all(req.actor.space, req.params.id) as any[];
      let imported = 0,
        duplicates = 0;
      s.transaction(() => {
        for (const item of entries) {
          let row = validate("farmers", JSON.parse(item.normalized));
          if (!allowed(req.actor, "farmers", row))
            fail(403, "Record is outside your assigned scope");
          const match = duplicate(req.actor.space, row);
          if (match) {
            s.db
              .prepare(
                "UPDATE source_records SET status='Duplicate',reason='Matches another row in this import or an existing member',farmer_id=? WHERE id=?",
              )
              .run(match.id, item.id);
            duplicates++;
            continue;
          }
          row = cleanFarmer(row);
          s.put(req.actor.space, "farmers", row);
          s.db
            .prepare(
              "UPDATE source_records SET status='Imported',farmer_id=? WHERE id=?",
            )
            .run(row.id, item.id);
          imported++;
        }
        const history = s.get(req.actor.space, "imports", req.params.id);
        if (history)
          s.put(req.actor.space, "imports", {
            ...history,
            status: "Importing",
            count: Number(history.count || 0) + imported,
          });
        if (entries.length)
          s.audit(
            req.actor,
            "BULK_IMPORT",
            "farmers",
            req.params.id,
            `Committed ${imported} validated records; retained ${duplicates} duplicate source rows`,
          );
      });
      const counts = s.db
        .prepare(
          "SELECT status,count(*) AS count FROM source_records WHERE space=? AND batch_id=? GROUP BY status",
        )
        .all(req.actor.space, req.params.id) as any[];
      const remaining = counts.find((r) => r.status === "Valid")?.count || 0;
      if (!remaining) {
        const history = s.get(req.actor.space, "imports", req.params.id);
        if (history)
          s.put(req.actor.space, "imports", {
            ...history,
            status: "Completed with review",
            summary: Object.fromEntries(counts.map((c) => [c.status, c.count])),
          });
      }
      reconcileImport(s, req.actor.space, req.params.id);
      res.json({
        imported,
        duplicates,
        remaining,
        summary: Object.fromEntries(counts.map((c) => [c.status, c.count])),
      });
    }),
  );
  app.get(
    "/api/import/issues/:id",
    safe((req, res) => {
      requireWrite(req.actor, "imports");
      const rows = s.db
        .prepare(
          "SELECT source_row AS sourceRow,status,reason FROM source_records WHERE space=? AND batch_id=? AND status IN ('Invalid','Duplicate') ORDER BY source_row LIMIT 500",
        )
        .all(req.actor.space, req.params.id);
      res.json({
        rows,
        note: "Values are withheld from this diagnostic list; original records are preserved privately.",
      });
    }),
  );
  app.get(
    "/api/import/review/:id",
    safe((req, res) => {
      if (!["Super Admin", "Admin", "Manager"].includes(req.actor.role))
        fail(403, "A manager or administrator must review source identities");
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const rows = s.db
        .prepare(
          "SELECT source_row AS sourceRow,status,reason,raw,normalized,farmer_id AS farmerId FROM source_records WHERE space=? AND batch_id=? AND status IN ('Invalid','Duplicate') ORDER BY source_row LIMIT 25 OFFSET ?",
        )
        .all(req.actor.space, req.params.id, offset) as any[];
      const total = (
        s.db
          .prepare(
            "SELECT count(*) AS n FROM source_records WHERE space=? AND batch_id=? AND status IN ('Invalid','Duplicate')",
          )
          .get(req.actor.space, req.params.id) as any
      ).n;
      res.json({
        total,
        offset,
        rows: rows.map((r) => {
          const raw = JSON.parse(r.raw);
          return {
            sourceRow: r.sourceRow,
            status: r.status,
            reason: r.reason,
            farmerId: r.farmerId,
            data: r.normalized
              ? JSON.parse(r.normalized)
              : normalizeInput(raw, suggestMapping(Object.keys(raw))).data,
          };
        }),
      });
    }),
  );
  app.put(
    "/api/import/correct/:id/:row",
    safe((req, res) => {
      if (!["Super Admin", "Admin", "Manager"].includes(req.actor.role))
        fail(
          403,
          "Only managers or administrators can correct reviewed imports",
        );
      const source = s.db
        .prepare(
          "SELECT * FROM source_records WHERE space=? AND batch_id=? AND source_row=?",
        )
        .get(req.actor.space, req.params.id, Number(req.params.row)) as any;
      if (!source) fail(404, "Source row not found");
      if (source.status !== "Invalid")
        fail(
          409,
          "Only invalid rows can be corrected here. Resolve duplicate members from their existing profiles.",
        );
      let row = validate("farmers", {
        ...req.body,
        id: randomUUID(),
        kycComplete: false,
        profileStatus: "Pending",
      });
      refCheck(req.actor, "farmers", row);
      if (!allowed(req.actor, "farmers", row))
        fail(403, "Corrected record is outside your assigned scope");
      if (duplicate(req.actor.space, row))
        fail(
          409,
          "Correction matches an existing member. Review the existing profile rather than creating a duplicate.",
        );
      row = cleanFarmer(row);
      s.transaction(() => {
        s.put(req.actor.space, "farmers", row);
        s.db
          .prepare(
            "UPDATE source_records SET normalized=?,status='Imported',reason=?,farmer_id=? WHERE id=?",
          )
          .run(
            JSON.stringify(row),
            "Corrected by an authorized reviewer; original retained",
            row.id,
            source.id,
          );
        const history = s.get(req.actor.space, "imports", req.params.id);
        if (history) {
          const counts = s.db
            .prepare(
              "SELECT status,count(*) AS count FROM source_records WHERE space=? AND batch_id=? GROUP BY status",
            )
            .all(req.actor.space, req.params.id) as any[];
          s.put(req.actor.space, "imports", {
            ...history,
            count: Number(history.count || 0) + 1,
            summary: Object.fromEntries(counts.map((c) => [c.status, c.count])),
          });
        }
        reconcileImport(s, req.actor.space, req.params.id);
        s.audit(
          req.actor,
          "CORRECT_IMPORT",
          "farmers",
          row.id,
          `Corrected source row ${req.params.row}; original validation reason: ${source.reason}`,
        );
      });
      res.json(row);
    }),
  );
  app.post(
    "/api/import/preview",
    safe((req, res) => {
      requireWrite(req.actor, "imports");
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length > 5000)
        fail(400, "Provide up to 5,000 rows per import");
      const seen = new Set<string>();
      const checked = rows.map((input: any, i: number) => {
        try {
          const row = validate("farmers", {
            gender: "Other",
            country: "Nigeria",
            profileStatus: "Pending",
            ...input,
            id: randomUUID(),
          });
          refCheck(req.actor, "farmers", row);
          if (!allowed(req.actor, "farmers", row))
            throw new Error("Outside your assigned organization or location");
          const d = duplicate(req.actor.space, row);
          const keys = ["primaryPhone", "bvn", "nin", "farmerID"]
            .filter((k) => row[k])
            .map(
              (k) =>
                k +
                ":" +
                (k === "primaryPhone" ? canonicalPhone(row[k]) : row[k]),
            );
          const repeated = keys.some((k) => seen.has(k));
          keys.forEach((k) => seen.add(k));
          return {
            row: i + 1,
            data: row,
            status: d || repeated ? "Duplicate" : "Valid",
            reason: d
              ? "Matches an existing phone, identity or member ID"
              : repeated
                ? "Duplicate phone within this file"
                : "",
            duplicateId: d?.id,
          };
        } catch (e) {
          return {
            row: i + 1,
            data: input,
            status: "Invalid",
            reason: (e as Error).message,
          };
        }
      });
      res.json({
        rows: checked,
        valid: checked.filter((r: any) => r.status === "Valid").length,
        duplicates: checked.filter((r: any) => r.status === "Duplicate").length,
        invalid: checked.filter((r: any) => r.status === "Invalid").length,
      });
    }),
  );
  app.post(
    "/api/import/commit",
    safe((req, res) => {
      requireWrite(req.actor, "imports");
      const { rows, source } = req.body;
      if (!Array.isArray(rows) || !rows.length || rows.length > 5000)
        fail(400, "Provide 1–5,000 valid rows");
      const id = randomUUID();
      let count = 0;
      s.transaction(() => {
        for (const input of rows) {
          let row = validate("farmers", {
            gender: "Other",
            country: "Nigeria",
            ...input,
            id: randomUUID(),
          });
          refCheck(req.actor, "farmers", row);
          if (!allowed(req.actor, "farmers", row))
            fail(403, "Import contains records outside your access scope");
          if (duplicate(req.actor.space, row))
            fail(
              409,
              "Duplicate detected. Preview the file again before importing.",
            );
          row = cleanFarmer(row);
          s.put(req.actor.space, "farmers", row);
          count++;
        }
        s.put(req.actor.space, "imports", {
          id,
          name: String(source || "File import"),
          date: new Date().toISOString(),
          count,
          status: "Completed",
        });
        s.audit(
          req.actor,
          "BULK_IMPORT",
          "farmers",
          id,
          `Imported ${count} validated members from ${source || "file"}`,
        );
      });
      res.status(201).json({ id, count });
    }),
  );
  app.post(
    "/api/alerts/generate",
    safe((req, res) => {
      requireWrite(req.actor, "alerts");
      let count = 0;
      s.transaction(() => {
        for (const f of s
          .all(req.actor.space, "farmers")
          .filter((f) => allowed(req.actor, "farmers", f))) {
          const harvest = f.harvestDate
            ? Math.ceil((Date.parse(f.harvestDate) - Date.now()) / 86400000)
            : null;
          const rules = [
            !f.kycComplete
              ? {
                  key: "kyc",
                  title: "Identity verification required",
                  message: `Complete identity verification for ${names(f)}.`,
                  category: "Verification",
                  severity: "Medium",
                }
              : null,
            harvest !== null && harvest >= 0 && harvest <= 14
              ? {
                  key: "harvest-" + f.harvestDate,
                  title: "Harvest approaching",
                  message: `${names(f)} is expected to harvest on ${f.harvestDate}.`,
                  category: "Harvest",
                  severity: "High",
                }
              : null,
          ].filter(Boolean) as any[];
          for (const rule of rules) {
            const id = `auto-${f.id}-${rule.key}`;
            if (!s.get(req.actor.space, "alerts", id)) {
              s.put(req.actor.space, "alerts", {
                ...rule,
                id,
                farmerId: f.id,
                status: "Open",
                dueDate: f.harvestDate,
              });
              count++;
            }
          }
        }
        s.audit(
          req.actor,
          "GENERATE",
          "alerts",
          "rules",
          `Generated ${count} new verification and harvest alerts`,
        );
      });
      res.json({ count });
    }),
  );
  app.post(
    "/api/files/:farmerId",
    safe((req, res) => {
      requireWrite(req.actor, "farmers");
      const f = s.get(req.actor.space, "farmers", req.params.farmerId);
      if (!f || !allowed(req.actor, "farmers", f))
        fail(404, "Farmer not found");
      const { name, mime, base64 } = req.body;
      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof base64 !== "string" ||
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          mime,
        )
      )
        fail(400, "Upload a named PNG, JPEG, WebP, or PDF document");
      const buffer = Buffer.from(base64, "base64");
      const matchesMime =
        mime === "application/pdf"
          ? buffer.subarray(0, 5).toString() === "%PDF-"
          : mime === "image/png"
            ? buffer
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : mime === "image/jpeg"
              ? buffer[0] === 255 && buffer[1] === 216
              : mime === "image/webp"
                ? buffer.subarray(0, 4).toString() === "RIFF" &&
                  buffer.subarray(8, 12).toString() === "WEBP"
                : false;
      if (!matchesMime)
        fail(400, "File content does not match the declared document type");
      if (buffer.length > 4 * 1024 * 1024 || buffer.length === 0)
        fail(400, "Document must be between 1 byte and 4 MB");
      const id = randomUUID();
      s.transaction(() => {
        s.db
          .prepare(
            "INSERT INTO files(id,space,farmer_id,name,mime,data,created) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            id,
            req.actor.space,
            f.id,
            name,
            mime,
            buffer,
            new Date().toISOString(),
          );
        s.put(req.actor.space, "farmers", {
          ...f,
          documents: [
            ...(f.documents || []),
            {
              id,
              name,
              type: mime,
              status: "Pending verification",
              uploadDate: new Date().toISOString(),
              url: `/api/files/${id}`,
            },
          ],
        });
        s.audit(
          req.actor,
          "UPLOAD",
          "farmers",
          f.id,
          `Uploaded document: ${name}`,
        );
      });
      res.status(201).json({ id });
    }),
  );
  app.get(
    "/api/files/:id",
    safe((req, res) => {
      const file = s.db
        .prepare("SELECT * FROM files WHERE id=? AND space=?")
        .get(req.params.id, req.actor.space) as any;
      if (!file) fail(404, "Document not found");
      const f = s.get(req.actor.space, "farmers", file.farmer_id);
      if (!f || !allowed(req.actor, "farmers", f))
        fail(403, "Document is outside your access scope");
      res.setHeader("Content-Type", file.mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
      res.send(Buffer.from(file.data));
    }),
  );
  app.delete(
    "/api/files/:id",
    safe((req, res) => {
      requireWrite(req.actor, "farmers");
      const file = s.db
        .prepare("SELECT * FROM files WHERE id=? AND space=?")
        .get(req.params.id, req.actor.space) as any;
      if (!file) fail(404, "Document not found");
      const f = s.get(req.actor.space, "farmers", file.farmer_id);
      if (!f || !allowed(req.actor, "farmers", f))
        fail(403, "Document is outside your access scope");
      s.transaction(() => {
        s.db.prepare("DELETE FROM files WHERE id=?").run(file.id);
        s.put(req.actor.space, "farmers", {
          ...f,
          documents: (f.documents || []).filter((d: any) => d.id !== file.id),
          ...(f.photo === "/api/files/" + file.id ? { photo: "" } : {}),
        });
        s.audit(
          req.actor,
          "DELETE",
          "farmers",
          f.id,
          `Removed document: ${file.name}`,
        );
      });
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/advisor",
    safe(async (req, res) => {
      const { messages } = req.body;
      if (
        !Array.isArray(messages) ||
        !messages.length ||
        messages.length > 30 ||
        messages.some(
          (m: any) =>
            !["user", "assistant"].includes(m.role) ||
            typeof m.text !== "string" ||
            m.text.length > 10000,
        )
      )
        fail(400, "Provide a conversation of up to 30 messages");
      if (!process.env.GEMINI_API_KEY)
        fail(
          503,
          "AI advice is not connected. Add GEMINI_API_KEY securely to enable this service.",
        );
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        })),
        config: {
          systemInstruction:
            "You are the RIFAN agricultural extension advisor for Nigerian rice farmers. Provide practical, locally relevant rice, irrigation, soil, seed, pest, harvest and storage advice. State uncertainty, do not fabricate locations or prices. Ask for location, season and crop stage when needed. This is advisory guidance, not a substitute for a field agronomist. Use only this recorded aggregate evidence for claims about the workspace; do not infer individual identities or missing measurements: " +
            JSON.stringify(
              intelligenceFor(features, req.actor, req.body.filters || {}),
            ),
        },
      });
      const row = {
        id: randomUUID(),
        userId: req.actor.id,
        messages: [
          ...messages,
          { role: "assistant", text: response.text || "" },
        ],
        date: new Date().toISOString(),
      };
      s.put(req.actor.space, "chats", row);
      res.json({ text: response.text, conversationId: row.id });
    }),
  );
  app.get(
    "/api/weather",
    safe(async (req, res) => {
      const lat = Number(req.query.lat),
        lng = Number(req.query.lng);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      )
        fail(400, "Valid latitude and longitude are required");
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Africa%2FLagos&forecast_days=7`,
        { signal: AbortSignal.timeout(12000) },
      );
      if (!r.ok) fail(502, "Weather provider is unavailable");
      res.json(await r.json());
    }),
  );
  const googleFor = googleConnection.googleFor;
  const readSheet = async (a: Session, url: string): Promise<any[][]> => {
    if (
      !/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/.test(url)
    )
      fail(400, "Use a Google Sheets spreadsheet URL");
    if (options.sheetsAdapter) return options.sheetsAdapter.read(url);
    const { google, auth } = await googleFor(a);
    const match = url.match(/\/d\/([A-Za-z0-9_-]+)/)!;
    const sheets = google.sheets({ version: "v4", auth });
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: match[1],
      fields: "sheets.properties",
    });
    const parsed = new URL(url);
    const gid =
      parsed.searchParams.get("gid") ||
      new URLSearchParams(parsed.hash.slice(1)).get("gid");
    const properties =
      metadata.data.sheets?.map((s: any) => s.properties) || [];
    const selected =
      gid !== null
        ? properties.find((p: any) => String(p.sheetId) === gid)
        : properties.find((p: any) => p.title === "RIFAN Registry") ||
          properties[0];
    if (!selected?.title)
      fail(400, "The selected Google worksheet does not exist");
    const title = String(selected.title).replaceAll("'", "''");
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: match[1],
      range: `'${title}'!A1:AZ250002`,
    });
    if ((r.data.values?.length || 0) > 250001)
      fail(400, "Split registers larger than 250,000 rows across worksheets");
    return r.data.values || [];
  };
  app.post(
    "/api/google/sheets/sync/preview",
    safe(async (req, res) => {
      requireWrite(req.actor, "farmers");
      const values = await readSheet(req.actor, String(req.body.url));
      const [headers, ...rawRows] = values;
      if (!headers?.length) fail(400, "Sheet must have a header row");
      if (rawRows.length > 250000)
        fail(400, "Split sheets larger than 250,000 rows");
      const mapping = req.body.mapping || suggestMapping(headers.map(String));
      const previewId = randomUUID();
      let additions = 0,
        updates = 0,
        invalid = 0;
      const seen = new Set<string>();
      const rows = rawRows
        .map((cells: any[], index: number) => ({ cells, sourceRow: index + 2 }))
        .filter(({ cells }) => cells.some((v) => v !== "" && v !== null))
        .map(({ cells, sourceRow }) => {
          const raw = Object.fromEntries(
            headers.map((h: any, j: number) => [h, cells[j] ?? ""]),
          );
          let submitted: any;
          try {
            const normalized = normalizeInput(raw, mapping).data;
            submitted = normalized;
            let match = duplicate(req.actor.space, normalized as Row);
            if (match && !allowed(req.actor, "farmers", match))
              throw new Error("Matching member is outside assigned scope");
            const key = match?.id || canonicalPhone(normalized.primaryPhone);
            if (seen.has(key))
              throw new Error("Duplicate member within the worksheet");
            seen.add(key);
            const changes = { ...normalized };
            if (match) {
              delete changes.kycComplete;
              delete changes.profileStatus;
              if (!Object.values(mapping).includes("gender"))
                delete changes.gender;
            }
            const data = validate("farmers", {
              ...match,
              ...changes,
              id: match?.id || randomUUID(),
            });
            refCheck(req.actor, "farmers", data);
            if (!allowed(req.actor, "farmers", data))
              throw new Error("Outside assigned scope");
            if (match) updates++;
            else additions++;
            return {
              sourceRow,
              submitted,
              status: match ? "Update" : "New",
              reason: match
                ? "Matched existing member; identity verification and account status retained"
                : "Validated new member",
              data,
              raw,
              matchId: match?.id,
              version: match ? tokenHash(JSON.stringify(match)) : null,
            };
          } catch (e) {
            invalid++;
            return {
              sourceRow,
              submitted,
              status: "Invalid",
              reason: (e as Error).message,
              raw,
            };
          }
        });
      s.put(req.actor.space, "chats", {
        id: "sheet-preview-" + previewId,
        userId: req.actor.id,
        expires: Date.now() + 1800000,
        rows,
        url: req.body.url,
      });
      res.json({
        previewId,
        additions,
        updates,
        invalid,
        rows: rows.map(({ data, raw, submitted, ...r }: any) => r),
      });
    }),
  );
  app.post(
    "/api/google/sheets/sync/commit",
    safe((req, res) => {
      requireWrite(req.actor, "farmers");
      const preview = s.get(
        req.actor.space,
        "chats",
        "sheet-preview-" + req.body.previewId,
      );
      if (
        !preview ||
        preview.userId !== req.actor.id ||
        preview.expires < Date.now()
      )
        fail(409, "Sheet preview expired. Read the sheet again.");
      let created = 0,
        updated = 0;
      s.transaction(() => {
        for (const row of preview.rows) {
          if (row.status === "Invalid") {
            s.db
              .prepare(
                "INSERT OR IGNORE INTO source_records(batch_id,space,source_row,raw,normalized,status,reason,farmer_id,submitted) VALUES(?,?,?,?,?,?,?,?,?)",
              )
              .run(
                preview.id,
                req.actor.space,
                row.sourceRow,
                JSON.stringify(row.raw),
                null,
                "Invalid",
                row.reason,
                null,
                row.submitted ? JSON.stringify(row.submitted) : null,
              );
            continue;
          }
          let data = validate("farmers", row.data);
          if (row.matchId) {
            const current = s.get(req.actor.space, "farmers", row.matchId);
            if (!current || tokenHash(JSON.stringify(current)) !== row.version)
              fail(
                409,
                "A member changed since this preview. Refresh the sheet preview to avoid overwriting newer data.",
              );
            if (!allowed(req.actor, "farmers", current))
              fail(403, "Member is outside assigned scope");
            data.updatedAt = new Date().toISOString();
            s.put(req.actor.space, "farmers", data);
            updated++;
          } else {
            if (duplicate(req.actor.space, data))
              fail(
                409,
                "A duplicate was added after preview. Refresh before synchronizing.",
              );
            data = cleanFarmer(data);
            s.put(req.actor.space, "farmers", data);
            created++;
          }
          s.db
            .prepare(
              "INSERT OR IGNORE INTO source_records(batch_id,space,source_row,raw,normalized,status,reason,farmer_id,submitted) VALUES(?,?,?,?,?,?,?,?,?)",
            )
            .run(
              preview.id,
              req.actor.space,
              row.sourceRow,
              JSON.stringify(row.raw),
              JSON.stringify(data),
              "Imported",
              "Google Sheets synchronization",
              data.id,
              row.submitted
                ? JSON.stringify(row.submitted)
                : JSON.stringify(row.data),
            );
        }
        s.put(req.actor.space, "imports", {
          id: preview.id,
          name: "Google Sheets synchronization",
          date: new Date().toISOString(),
          count: created + updated,
          status: preview.rows.some((r: any) => r.status === "Invalid")
            ? "Completed with review"
            : "Completed",
          summary: {
            Imported: created + updated,
            Created: created,
            Updated: updated,
            Invalid: preview.rows.filter((r: any) => r.status === "Invalid")
              .length,
          },
        });
        s.remove(req.actor.space, "chats", preview.id);
        s.audit(
          req.actor,
          "SHEET_SYNC",
          "farmers",
          preview.id,
          `Google register sync: ${created} new, ${updated} updated; invalid rows skipped`,
        );
      });
      res.json({ created, updated });
    }),
  );
  app.get(
    "/api/google/folders",
    safe(async (req, res) => {
      const { google, auth } = await googleFor(req.actor);
      const r = await google.drive({ version: "v3", auth }).files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: "files(id,name)",
      });
      res.json(r.data.files || []);
    }),
  );
  app.post(
    "/api/google/sheets",
    safe(async (req, res) => {
      requireWrite(req.actor, "workbooks");
      const { google, auth } = await googleFor(req.actor);
      const r = await google
        .sheets({ version: "v4", auth })
        .spreadsheets.create({
          requestBody: {
            properties: {
              title: String(req.body.title || "RIFAN Member Register"),
            },
          },
        });
      const id = r.data.spreadsheetId!;
      if (req.body.folderId)
        await google
          .drive({ version: "v3", auth })
          .files.update({ fileId: id, addParents: req.body.folderId });
      const row = {
        id: randomUUID(),
        name: req.body.title || "RIFAN Member Register",
        url: r.data.spreadsheetUrl,
        date: new Date().toISOString(),
      };
      s.put(req.actor.space, "workbooks", row);
      s.audit(
        req.actor,
        "CREATE",
        "workbooks",
        row.id,
        "Created connected Google workbook",
      );
      res.status(201).json(row);
    }),
  );
  app.post(
    "/api/google/sheets/read",
    safe(async (req, res) => {
      requireWrite(req.actor, "imports");
      res.json({ values: await readSheet(req.actor, String(req.body.url)) });
    }),
  );
  app.post(
    "/api/google/sheets/export",
    safe(async (req, res) => {
      if (
        !["Super Admin", "Admin", "Manager", "Viewer"].includes(req.actor.role)
      )
        fail(403, "Your role does not allow data export");
      const url = String(req.body.url);
      const match = url.match(
        /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
      );
      if (!match) fail(400, "Use a Google Sheets URL");
      let service: any;
      if (!options.sheetsAdapter?.write) {
        const { google, auth } = await googleFor(req.actor);
        service = google.sheets({ version: "v4", auth });
      }
      const rows = s
        .all(req.actor.space, "farmers")
        .filter((f) => allowed(req.actor, "farmers", f));
      const keys = [
        "farmerID",
        "firstName",
        "middleName",
        "lastName",
        "gender",
        "primaryPhone",
        "country",
        "state",
        "lga",
        "ward",
        "community",
        "crop",
        "farmSize",
        "plantingDate",
        "harvestDate",
        "registrationDate",
        "registrationYear",
        "profileStatus",
      ];
      const values = [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ""))];
      if (options.sheetsAdapter?.write)
        await options.sheetsAdapter.write(url, values);
      else {
        const metadata = await service.spreadsheets.get({
          spreadsheetId: match[1],
          fields: "sheets.properties",
        });
        const existing = metadata.data.sheets?.some(
          (sh: any) => sh.properties?.title === "RIFAN Registry",
        );
        if (!existing)
          await service.spreadsheets.batchUpdate({
            spreadsheetId: match[1],
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: "RIFAN Registry",
                      gridProperties: {
                        rowCount: Math.max(1000, values.length + 1),
                        columnCount: keys.length,
                      },
                    },
                  },
                },
              ],
            },
          });
        else {
          const sheet = metadata.data.sheets.find(
            (sh: any) => sh.properties?.title === "RIFAN Registry",
          );
          await service.spreadsheets.batchUpdate({
            spreadsheetId: match[1],
            requestBody: {
              requests: [
                {
                  updateSheetProperties: {
                    properties: {
                      sheetId: sheet.properties.sheetId,
                      gridProperties: {
                        rowCount: Math.max(values.length + 1, 1000),
                        columnCount: keys.length,
                      },
                    },
                    fields:
                      "gridProperties.rowCount,gridProperties.columnCount",
                  },
                },
              ],
            },
          });
        }
        await service.spreadsheets.values.clear({
          spreadsheetId: match[1],
          range: "'RIFAN Registry'!A:AZ",
        });
        for (let offset = 0; offset < values.length; offset += 5000)
          await service.spreadsheets.values.update({
            spreadsheetId: match[1],
            range: `'RIFAN Registry'!A${offset + 1}`,
            valueInputOption: "RAW",
            requestBody: { values: values.slice(offset, offset + 5000) },
          });
      }
      s.audit(
        req.actor,
        "EXPORT",
        "farmers",
        "sheets",
        `Exported ${rows.length} members into the RIFAN Registry worksheet`,
      );
      res.json({ count: rows.length, worksheet: "RIFAN Registry" });
    }),
  );
  app.post(
    "/api/google/forms",
    safe(async (req, res) => {
      requireWrite(req.actor, "workbooks");
      const { google, auth } = await googleFor(req.actor);
      const forms = google.forms({ version: "v1", auth });
      const r = await forms.forms.create({
        requestBody: {
          info: {
            title: String(req.body.title || "RIFAN Farmer Registration"),
          },
        },
      });
      await forms.forms.batchUpdate({
        formId: r.data.formId!,
        requestBody: {
          requests: ["First name", "Last name", "Phone", "State", "LGA"].map(
            (title, index) => ({
              createItem: {
                item: {
                  title,
                  questionItem: {
                    question: { required: true, textQuestion: {} },
                  },
                },
                location: { index },
              },
            }),
          ),
        },
      });
      res.status(201).json({ url: r.data.responderUri, id: r.data.formId });
    }),
  );
  app.post(
    "/api/google/docs",
    safe(async (req, res) => {
      if (
        !["Super Admin", "Admin", "Manager", "Viewer"].includes(req.actor.role)
      )
        fail(403, "Your role does not allow export");
      const { google, auth } = await googleFor(req.actor);
      const docs = google.docs({ version: "v1", auth });
      const r = await docs.documents.create({
        requestBody: { title: "RIFAN Membership Report" },
      });
      const farmers = s
        .all(req.actor.space, "farmers")
        .filter((f) => allowed(req.actor, "farmers", f));
      await docs.documents.batchUpdate({
        documentId: r.data.documentId!,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text:
                  "RIFAN MEMBERSHIP REPORT\n\n" +
                  farmers
                    .map(
                      (f) =>
                        `${f.farmerID}: ${names(f)} | ${f.state}, ${f.lga} | ${f.crop || "Not recorded"}`,
                    )
                    .join("\n"),
              },
            },
          ],
        },
      });
      s.audit(
        req.actor,
        "EXPORT",
        "farmers",
        "docs",
        `Exported ${farmers.length} members to Google Docs`,
      );
      res.status(201).json({
        url: `https://docs.google.com/document/d/${r.data.documentId}/edit`,
      });
    }),
  );
  app.post(
    "/api/google/alerts/:id/email",
    safe(async (req, res) => {
      requireWrite(req.actor, "alerts");
      const row = s.get(req.actor.space, "alerts", req.params.id);
      if (!row || !allowed(req.actor, "alerts", row))
        fail(404, "Alert not found");
      const to = String(req.body.to || "");
      if (!/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(to))
        fail(400, "A valid recipient email is required");
      const { google, auth } = await googleFor(req.actor, GMAIL_SCOPE);
      const subject = String(row.title || "RIFAN notification").replace(
        /[\r\n]/g,
        " ",
      );
      const raw = Buffer.from(
        `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${row.message}\r\n\r\nRIFAN Connect`,
      ).toString("base64url");
      const response = await google
        .gmail({ version: "v1", auth })
        .users.messages.send({ userId: "me", requestBody: { raw } });
      if (!response.data.id)
        fail(502, "Email provider did not confirm delivery acceptance");
      s.transaction(() => {
        s.put(req.actor.space, "alerts", {
          ...row,
          emailStatus: "Accepted by Gmail",
          emailSentAt: new Date().toISOString(),
          emailMessageId: response.data.id,
        });
        s.audit(
          req.actor,
          "EMAIL",
          "alerts",
          row.id,
          "Google accepted an alert email for delivery",
        );
      });
      res.json({ status: "Accepted by Gmail" });
    }),
  );
  app.post(
    "/api/export/log",
    safe((req, res) => {
      if (
        !["Super Admin", "Admin", "Manager", "Viewer"].includes(req.actor.role)
      )
        fail(403, "Your role does not allow exports");
      s.audit(
        req.actor,
        "EXPORT",
        String(req.body.entity || "report"),
        "download",
        String(req.body.details || "Downloaded report"),
      );
      res.json({ success: true });
    }),
  );
  // Generic document CRUD; specialized ledgers/history are never directly mutable.
  app.post(
    "/api/records/:entity",
    safe((req, res) => {
      const entity = req.params.entity as Entity;
      if (
        !ENTITIES.includes(entity) ||
        [
          "imports",
          "movements",
          "chats",
          "payments",
          "applications",
          "participations",
        ].includes(entity)
      )
        fail(404, "Unknown or immutable collection");
      requireWrite(req.actor, entity);
      let row = validate(entity, {
        ...req.body,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      refCheck(req.actor, entity, row);
      validateLinks(features, req.actor, entity, row);
      if (!allowed(req.actor, entity, row))
        fail(403, "Record is outside your assigned scope");
      if (entity === "farmers") {
        if (row.farmBoundary) validateBoundary(row.farmBoundary);
        if (duplicate(req.actor.space, row))
          fail(
            409,
            "A member with this phone, member ID or identity already exists",
          );
        row = cleanFarmer(row);
      }
      if (entity === "interventions" && req.body.farmerId)
        fail(
          400,
          "Create an intervention under its programme, then assign a beneficiary cohort in bulk",
        );
      if (["farmLocations", "fieldValidations"].includes(entity)) {
        row.recordedBy = req.actor.id;
        row.recordedAt = new Date().toISOString();
      }
      if (entity === "warehouses") row.currentInventory = 0;
      if (entity === "alerts") row.status = "Open";
      s.transaction(() => {
        s.put(req.actor.space, entity, row);
        s.audit(
          req.actor,
          "CREATE",
          entity,
          row.id,
          `Created ${row.name || row.title || names(row) || entity}`,
        );
      });
      res.status(201).json(row);
    }),
  );
  app.put(
    "/api/records/:entity/:id",
    safe((req, res) => {
      const entity = req.params.entity as Entity;
      if (
        !ENTITIES.includes(entity) ||
        [
          "imports",
          "movements",
          "chats",
          "payments",
          "applications",
          "participations",
        ].includes(entity)
      )
        fail(404, "Unknown or immutable collection");
      requireWrite(req.actor, entity);
      const old = s.get(req.actor.space, entity, req.params.id);
      if (!old || !allowed(req.actor, entity, old))
        fail(404, "Record not found");
      if (entity === "farmLocations")
        fail(
          409,
          "Historical farm observations are immutable. Create a new observation linked to the activity.",
        );
      if (entity === "fieldValidations" && old.status === "Verified")
        fail(
          409,
          "Approved field evidence is immutable. Submit a new validation.",
        );
      if (
        req.body.expectedUpdatedAt !== undefined &&
        req.body.expectedUpdatedAt !== (old.updatedAt || old.createdAt || "")
      )
        fail(
          409,
          "This record changed since it was opened. Reload before editing.",
        );
      const row = validate(entity, {
        ...old,
        ...req.body,
        id: old.id,
        updatedAt: new Date().toISOString(),
      });
      refCheck(req.actor, entity, row);
      validateLinks(features, req.actor, entity, row);
      if (!allowed(req.actor, entity, row))
        fail(403, "Updated record is outside your assigned scope");
      if (entity === "farmers" && row.farmBoundary)
        validateBoundary(row.farmBoundary);
      if (entity === "farmers" && duplicate(req.actor.space, row, old.id))
        fail(409, "Another member already has this phone or identity");
      if (entity === "warehouses") {
        row.currentInventory = old.currentInventory;
        if (Number(row.capacity) < Number(old.currentInventory))
          fail(400, "Capacity cannot be less than current inventory");
      }
      s.transaction(() => {
        s.put(req.actor.space, entity, row);
        s.audit(
          req.actor,
          "UPDATE",
          entity,
          row.id,
          `Updated ${row.name || row.title || names(row) || entity}; fields: ${Object.keys(
            req.body,
          )
            .filter((k) => !["bvn", "nin", "accountNumber"].includes(k))
            .join(", ")}`,
        );
      });
      res.json(row);
    }),
  );
  app.delete(
    "/api/records/:entity/:id",
    safe((req, res) => {
      const entity = req.params.entity as Entity;
      if (
        !ENTITIES.includes(entity) ||
        [
          "imports",
          "movements",
          "chats",
          "payments",
          "applications",
          "participations",
        ].includes(entity)
      )
        fail(404, "Unknown or immutable collection");
      requireWrite(req.actor, entity);
      if (!["Super Admin", "Admin", "Manager"].includes(req.actor.role))
        fail(403, "Only managers or administrators can delete records");
      const row = s.get(req.actor.space, entity, req.params.id);
      if (!row || !allowed(req.actor, entity, row))
        fail(404, "Record not found");
      if (["farmLocations", "fieldValidations"].includes(entity))
        fail(
          409,
          "Historical evidence cannot be deleted; record a superseding observation",
        );
      for (const child of [
        "participations",
        "farmLocations",
        "fieldValidations",
        "harvestTasks",
        "seasons",
      ] as Entity[]) {
        const key = (
          {
            farmers: "farmerId",
            programs: "programId",
            interventions: "interventionId",
            seasons: "seasonId",
            warehouses: "warehouseId",
            organizations: "organizationId",
          } as any
        )[entity];
        if (
          key &&
          s.db
            .prepare(
              `SELECT id FROM records WHERE space=? AND entity=? AND json_extract(data,'$.${key}')=? LIMIT 1`,
            )
            .get(req.actor.space, child, row.id)
        )
          fail(
            409,
            "This record has linked operational history. Archive it instead of deleting.",
          );
      }
      const refs: Partial<Record<Entity, [Entity, string][]>> = {
        organizations: [
          ["farmers", "organizationId"],
          ["programs", "organizationId"],
          ["templates", "organizationId"],
          ["workbooks", "organizationId"],
        ],
        programs: [
          ["farmers", "programId"],
          ["interventions", "programId"],
        ],
        farmers: [
          ["interventions", "farmerId"],
          ["resources", "farmerId"],
          ["alerts", "farmerId"],
          ["payments", "farmerId"],
          ["applications", "farmerId"],
        ],
        warehouses: [["movements", "warehouseId"]],
      };
      for (const [target, key] of refs[entity] || [])
        if (s.all(req.actor.space, target).some((r) => r[key] === row.id))
          fail(
            409,
            `This ${entity} record is still referenced by ${target}. Reassign or archive it first.`,
          );
      if (entity === "farmers" && (row.documents || []).length)
        fail(409, "Remove attached documents before deleting this farmer");
      if (entity === "warehouses" && row.currentInventory > 0)
        fail(409, "Dispatch remaining inventory before removing a warehouse");
      s.transaction(() => {
        s.remove(req.actor.space, entity, row.id);
        s.audit(
          req.actor,
          "DELETE",
          entity,
          row.id,
          `Deleted ${row.name || row.title || names(row) || entity}`,
        );
      });
      res.json({ success: true });
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const googleFailure = googleApiFailure(error);
    if (
      googleFailure?.code === "GOOGLE_RECONNECT_REQUIRED" &&
      (_req as R).actor
    ) {
      const a = (_req as R).actor;
      s.db
        .prepare("DELETE FROM integrations WHERE space=? AND user_id=?")
        .run(a.space, a.id);
    }
    const status =
      googleFailure?.status ||
      error.status ||
      (String(error.message).includes("UNIQUE constraint") ? 409 : 400);
    res.status(status).json({
      ...(error.code?.startsWith?.("GOOGLE_")
        ? { code: error.code }
        : googleFailure
          ? { code: googleFailure.code }
          : {}),
      error:
        googleFailure?.message ||
        error.publicMessage ||
        (status >= 500
          ? "The service could not complete this request. Check configuration and try again."
          : error.message || "Request failed"),
    });
  });
  return { app, store: s };
}
