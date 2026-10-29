import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_SETTINGS,
  type Entity,
  type Row,
  type Session,
} from "../src/model";

export function openDatabase(filename: string) {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(path.resolve(filename)), {
      recursive: true,
      mode: 0o700,
    });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS records (space TEXT NOT NULL, entity TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(space,entity,id));
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, space TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, hash TEXT NOT NULL, salt TEXT NOT NULL, scope TEXT NOT NULL DEFAULT '{}', UNIQUE(space,email));
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, space TEXT NOT NULL, expires INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, space TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, details TEXT NOT NULL, timestamp TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (space TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, space TEXT NOT NULL, farmer_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, data BLOB NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_records (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT NOT NULL, space TEXT NOT NULL, source_row INTEGER NOT NULL, raw TEXT NOT NULL, normalized TEXT, status TEXT NOT NULL, reason TEXT, farmer_id TEXT, UNIQUE(batch_id,source_row));
    CREATE INDEX IF NOT EXISTS source_batch ON source_records(space,batch_id,status);
    CREATE INDEX IF NOT EXISTS farmer_phone ON records(space,json_extract(data,'$.primaryPhone')) WHERE entity='farmers';
    CREATE INDEX IF NOT EXISTS farmer_bvn ON records(space,json_extract(data,'$.bvn')) WHERE entity='farmers';
    CREATE INDEX IF NOT EXISTS farmer_nin ON records(space,json_extract(data,'$.nin')) WHERE entity='farmers';
    CREATE INDEX IF NOT EXISTS farmer_memberid ON records(space,json_extract(data,'$.farmerID')) WHERE entity='farmers';
    CREATE INDEX IF NOT EXISTS farmer_state ON records(space,json_extract(data,'$.state')) WHERE entity='farmers';
    CREATE TABLE IF NOT EXISTS integrations (space TEXT NOT NULL, user_id TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT, expires INTEGER, PRIMARY KEY(space,user_id));
  `);
  db.exec(`CREATE TABLE IF NOT EXISTS record_history (version INTEGER PRIMARY KEY AUTOINCREMENT, space TEXT NOT NULL, entity TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL, action TEXT NOT NULL, recorded_at TEXT NOT NULL, actor_id TEXT, actor_name TEXT);
CREATE INDEX IF NOT EXISTS history_record ON record_history(space,entity,record_id,version);
CREATE TABLE IF NOT EXISTS cohort_jobs(id TEXT PRIMARY KEY,space TEXT NOT NULL,actor_id TEXT NOT NULL,target TEXT NOT NULL,filters TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cohort_members(job_id TEXT NOT NULL,farmer_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',reason TEXT,PRIMARY KEY(job_id,farmer_id));
CREATE INDEX IF NOT EXISTS cohort_pending ON cohort_members(job_id,status);
CREATE INDEX IF NOT EXISTS participation_farmer ON records(space,json_extract(data,'$.farmerId')) WHERE entity='participations';
CREATE UNIQUE INDEX IF NOT EXISTS participation_unique ON records(space,json_extract(data,'$.farmerId'),json_extract(data,'$.interventionId'),json_extract(data,'$.seasonId')) WHERE entity='participations';
CREATE INDEX IF NOT EXISTS site_farmer ON records(space,json_extract(data,'$.farmerId')) WHERE entity='farmLocations';
CREATE INDEX IF NOT EXISTS validation_farmer ON records(space,json_extract(data,'$.farmerId')) WHERE entity='fieldValidations';
CREATE TABLE IF NOT EXISTS otp_challenges(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,space TEXT NOT NULL,purpose TEXT NOT NULL,hash TEXT NOT NULL,salt TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);`);
  const columns = new Set(
    (db.prepare("PRAGMA table_info(users)").all() as any[]).map((r) => r.name),
  );
  for (const column of ["twofa_enabled", "twofa_required"])
    if (!columns.has(column))
      db.exec(
        `ALTER TABLE users ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`,
      );
  if (
    !(db.prepare("PRAGMA table_info(source_records)").all() as any[]).some(
      (c) => c.name === "submitted",
    )
  )
    db.exec("ALTER TABLE source_records ADD COLUMN submitted TEXT");
  const actors = new AsyncLocalStorage<Session>();
  const withActor = <T>(actor: Session, callback: () => T) =>
    actors.run(actor, callback);
  const history = (
    space: string,
    entity: Entity,
    data: Row,
    action: string,
  ) => {
    const actor = actors.getStore();
    db.prepare(
      "INSERT INTO record_history(space,entity,record_id,data,action,recorded_at,actor_id,actor_name) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      space,
      entity,
      data.id,
      JSON.stringify(data),
      action,
      new Date().toISOString(),
      actor?.id || "system",
      actor?.name || "System",
    );
  };
  let revision = 0;
  const version = () =>
    String((db.prepare("PRAGMA data_version").get() as any).data_version) +
    ":" +
    revision;
  const all = (space: string, entity: Entity): Row[] =>
    (
      db
        .prepare(
          "SELECT data FROM records WHERE space=? AND entity=? ORDER BY rowid DESC",
        )
        .all(space, entity) as any[]
    ).map((r) => JSON.parse(r.data));
  const get = (space: string, entity: Entity, id: string): Row | undefined => {
    const r = db
      .prepare("SELECT data FROM records WHERE space=? AND entity=? AND id=?")
      .get(space, entity, id) as any;
    return r ? JSON.parse(r.data) : undefined;
  };
  const put = (space: string, entity: Entity, data: Row) => {
    if (entity === "farmers") revision++;
    const previous = get(space, entity, data.id);
    if (
      previous &&
      !db
        .prepare(
          "SELECT version FROM record_history WHERE space=? AND entity=? AND record_id=? LIMIT 1",
        )
        .get(space, entity, data.id)
    )
      history(
        space,
        entity,
        previous,
        "Baseline (earlier revisions unavailable)",
      );
    if (!previous || JSON.stringify(previous) !== JSON.stringify(data))
      history(space, entity, data, previous ? "Updated" : "Created");
    db.prepare(
      "INSERT INTO records(space,entity,id,data) VALUES(?,?,?,?) ON CONFLICT(space,entity,id) DO UPDATE SET data=excluded.data",
    ).run(space, entity, data.id, JSON.stringify(data));
    return data;
  };
  const remove = (space: string, entity: Entity, id: string) => {
    if (entity === "farmers") revision++;
    const previous = get(space, entity, id);
    if (previous) history(space, entity, previous, "Deleted");
    return db
      .prepare("DELETE FROM records WHERE space=? AND entity=? AND id=?")
      .run(space, entity, id);
  };
  const settings = (space: string) => {
    const r = db
      .prepare("SELECT data FROM settings WHERE space=?")
      .get(space) as any;
    return { ...DEFAULT_SETTINGS, ...(r ? JSON.parse(r.data) : {}) };
  };
  const audit = (
    session: Session,
    action: string,
    entity: string,
    id: string,
    details: string,
  ) =>
    db
      .prepare(
        "INSERT INTO audit(space,user_id,user_name,action,entity,entity_id,details,timestamp) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        session.space,
        session.id,
        session.name,
        action,
        entity,
        id,
        details,
        new Date().toISOString(),
      );
  const transaction = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  return {
    db,
    all,
    get,
    put,
    remove,
    settings,
    audit,
    transaction,
    version,
    withActor,
  };
}
export type Store = ReturnType<typeof openDatabase>;

export function seedDemo(s: Store) {
  if (s.get("demo", "organizations", "org-kebbi")) return;
  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const regions = [
    ["Kebbi", "Birnin Kebbi", 12.45, 4.2],
    ["Kano", "Kura", 11.77, 8.43],
    ["Jigawa", "Hadejia", 12.45, 10.04],
    ["Niger", "Bida", 9.08, 6.01],
    ["Benue", "Makurdi", 7.73, 8.54],
    ["Ebonyi", "Abakaliki", 6.32, 8.1],
    ["Nasarawa", "Lafia", 8.49, 8.52],
    ["Kaduna", "Zaria", 11.08, 7.72],
  ] as const;
  const first = [
    "Amina",
    "Ibrahim",
    "Fatima",
    "Musa",
    "Zainab",
    "Abubakar",
    "Grace",
    "Yusuf",
    "Maryam",
    "Emmanuel",
    "Hadiza",
    "Usman",
  ];
  const last = [
    "Bello",
    "Abdullahi",
    "Ibrahim",
    "Mohammed",
    "Garba",
    "Okafor",
    "Adamu",
    "Suleiman",
    "Aliyu",
    "Musa",
    "Oche",
    "Umar",
  ];
  s.transaction(() => {
    regions.forEach(([state, lga, lat, lng], i) => {
      const orgId = "org-" + state.toLowerCase();
      s.put("demo", "organizations", {
        id: orgId,
        name: `RIFAN ${state} Cooperative`,
        type: "Cooperative",
        region: state,
        states: state,
        lgas: lga,
        contactPerson: `${first[i]} ${last[i]}`,
        contactPhone: `0800000000${i}`,
        status: "Active",
      });
      if (i < 4)
        s.put("demo", "warehouses", {
          id: "wh-" + i,
          name: `${state} Grain Reserve`,
          state,
          commodity: "Rice",
          capacity: 500 + i * 250,
          currentInventory: 240 + i * 90,
          manager: `${first[i]} ${last[i]}`,
          latitude: lat,
          longitude: lng,
          status: i === 3 ? "Maintenance" : "Active",
        });
    });
    s.put("demo", "programs", {
      id: "pr-wet",
      name: "Wet Season Rice Programme",
      description:
        "Improved seed, extension support and aggregation for rice cooperatives.",
      organizationId: "org-kebbi",
      status: "Active",
      startDate: day(-130),
      endDate: day(25),
      target: 120,
    });
    s.put("demo", "programs", {
      id: "pr-dry",
      name: "Dry Season Irrigation Initiative",
      description: "Preparing farmers for efficient dry season production.",
      organizationId: "org-kano",
      status: "Planned",
      startDate: day(30),
      endDate: day(180),
      target: 80,
    });
    for (let i = 0; i < 84; i++) {
      const [state, lga, lat, lng] = regions[i % regions.length];
      s.put("demo", "farmers", {
        id: "demo-farmer-" + i,
        farmerID: `RIFAN-${state.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(5, "0")}`,
        firstName: first[i % first.length],
        lastName: last[(i * 7 + 3) % last.length],
        gender: i % 3 === 0 ? "Female" : "Male",
        primaryPhone: `0800${String(i).padStart(7, "0")}`,
        country: "Nigeria",
        state,
        lga,
        community: lga,
        organizationId: "org-" + state.toLowerCase(),
        programId: "pr-wet",
        crop: i % 12 === 0 ? "Maize" : "Rice",
        farmSize: 1 + (i % 12) * 0.5,
        experience: 3 + (i % 17),
        irrigation: i % 3 === 0 ? "Irrigated" : "Rain-fed",
        variety: i % 2 ? "FARO 44" : "FARO 52",
        profileStatus: i % 9 === 0 ? "Pending" : "Active",
        kycComplete: i % 9 !== 0,
        registrationDate: day(-175 + i * 2),
        plantingDate: day(-100 + (i % 24)),
        harvestDate: day(-5 + (i % 35)),
        latitude: i % 11 === 0 ? undefined : lat + (i % 5) * 0.015,
        longitude: i % 11 === 0 ? undefined : lng + (i % 5) * 0.018,
        loanReq: 100000,
        loanApproved: i % 4 === 0 ? 100000 : 0,
        yield_amount: i % 8 === 0 ? 1500 : 0,
        remarks: "Demonstration record. Not a real farmer.",
      });
    }
    for (let i = 0; i < 16; i++)
      s.put("demo", "interventions", {
        id: "inv-" + i,
        name: [
          "Improved rice seed distribution",
          "Extension field visit",
          "Soil fertility training",
          "Irrigation assessment",
        ][i % 4],
        farmerId: "demo-farmer-" + i,
        programId: "pr-wet",
        type: ["Seed support", "Extension visit", "Training", "Irrigation"][
          i % 4
        ],
        dateApplied: day(-20 + i),
        status:
          i % 4 === 0 ? "Planned" : i % 3 === 0 ? "In Progress" : "Completed",
        impactScore: i % 3 === 0 ? undefined : 65 + i,
      });
    s.put("demo", "resources", {
      id: "res-1",
      farmerId: "demo-farmer-1",
      name: "FARO 44 certified rice seed",
      type: "Seed",
      quantity: 50,
      unit: "kg",
    });
    s.put("demo", "alerts", {
      id: "alert-1",
      title: "Harvest readiness assessment",
      message:
        "Review farms approaching harvest and arrange aggregation with cooperative leads.",
      severity: "High",
      category: "Harvest",
      status: "Open",
      dueDate: day(3),
    });
    s.put("demo", "alerts", {
      id: "alert-2",
      title: "Membership verification",
      message:
        "Some member records need identity verification before programme enrollment.",
      severity: "Medium",
      category: "Verification",
      status: "Open",
      dueDate: day(7),
    });
    s.put("demo", "templates", {
      id: "template-default",
      name: "RIFAN member registration",
      mapping: JSON.stringify({
        "First Name": "firstName",
        "Last Name": "lastName",
        Phone: "primaryPhone",
        State: "state",
        LGA: "lga",
        "Farm Size": "farmSize",
      }),
      requiredFields: "firstName,lastName,primaryPhone,state,lga",
    });
    s.put("demo", "widgets", {
      id: "widget-gender",
      name: "Membership by gender",
      type: "pie",
      dataSource: "farmers",
      groupBy: "gender",
      enabled: true,
      dashboard: "Executive",
      roles: "Super Admin,Admin,Manager,Viewer",
      refreshInterval: 60,
    });
    const demo: Session = {
      id: "demo-admin",
      name: "RIFAN Demo Administrator",
      email: "demo@rifan.local",
      role: "Super Admin",
      space: "demo",
      demo: true,
    };
    s.audit(
      demo,
      "SETUP",
      "workspace",
      "demo",
      "Created isolated demonstration workspace with 84 synthetic members.",
    );
  });
}
