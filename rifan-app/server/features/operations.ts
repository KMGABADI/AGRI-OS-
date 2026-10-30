import { asyncMap, asyncFilter } from "../db/async-collections";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Entity, Row, Session } from "../../src/model";
import { ENTITIES, names } from "../../src/model";
import { validate } from "../validation";
import { NIGERIA_STATES } from "../../src/lib/nigeriaData";
import {
  reject,
  route,
  manager,
  publicRecord,
  type FeatureContext,
} from "./context";
import { registerIntelligence } from "./intelligence";
export function validateBoundary(value: any) {
  let count = 0;
  const point = (v: any) => {
    if (
      !Array.isArray(v) ||
      v.length < 2 ||
      !Number.isFinite(v[0]) ||
      !Number.isFinite(v[1]) ||
      Math.abs(v[0]) > 180 ||
      Math.abs(v[1]) > 90
    )
      reject(
        400,
        "Boundary coordinates must be valid longitude/latitude pairs",
      );
    if (++count > 20000) reject(400, "Keep boundaries under 20,000 vertices");
  };
  const polygon = (rings: any) => {
    if (!Array.isArray(rings) || !rings.length)
      reject(400, "A polygon requires rings");
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 4)
        reject(400, "Polygon rings need at least four vertices");
      ring.forEach(point);
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])
        reject(400, "Polygon rings must be closed");
    }
  };
  const check = (g: any) => {
    if (!g || typeof g !== "object") reject(400, "Invalid farm geometry");
    if (g.type === "Feature") return check(g.geometry);
    if (g.type === "FeatureCollection") {
      if (!Array.isArray(g.features) || g.features.length > 100)
        reject(400, "Invalid feature collection");
      g.features.forEach(check);
      return;
    }
    if (g.type === "Polygon") return polygon(g.coordinates);
    if (g.type === "MultiPolygon") {
      g.coordinates.forEach(polygon);
      return;
    }
    reject(400, "Farm boundaries must be Polygon or MultiPolygon GeoJSON");
  };
  check(value);
  return value;
}
export function canPlan(actor: Session) {
  return manager(actor) || actor.plannerApproved === true;
}
export async function validateLinks(
  ctx: FeatureContext,
  actor: Session,
  entity: Entity,
  row: Row,
) {
  if (row.programId) {
    const parent = await ctx.s.get(actor.space, "programs", row.programId);
    if (parent?.organizationId) row.organizationId = parent.organizationId;
  }
  for (const [field, target] of [
    ["programId", "programs"],
    ["seasonId", "seasons"],
    ["interventionId", "interventions"],
    ["locationId", "farmLocations"],
    ["warehouseId", "warehouses"],
    ["farmerId", "farmers"],
  ] as [string, Entity][]) {
    if (row[field]) {
      const parent = await ctx.s.get(actor.space, target, row[field]);
      if (!parent || !(await ctx.allowed(actor, target, parent)))
        reject(400, `Invalid or inaccessible ${field}`);
    }
  }
  if (row.seasonId) {
    const season = (await ctx.s.get(actor.space, "seasons", row.seasonId))!;
    if (row.programId && row.programId !== season.programId)
      reject(400, "Season must belong to the selected programme");
    if (
      row.warehouseId &&
      season.warehouseIds?.length &&
      !season.warehouseIds.includes(row.warehouseId)
    )
      reject(
        400,
        "Attach this warehouse to the season before assigning it to an activity",
      );
  }
  if (row.interventionId) {
    const intervention = (await ctx.s.get(
      actor.space,
      "interventions",
      row.interventionId,
    ))!;
    if (
      row.programId !== intervention.programId ||
      row.seasonId !== intervention.seasonId
    )
      reject(
        400,
        "Intervention must belong to the selected programme and season",
      );
  }
  if (row.locationId) {
    const site = (await ctx.s.get(
      actor.space,
      "farmLocations",
      row.locationId,
    ))!;
    if (row.farmerId && row.farmerId !== site.farmerId)
      reject(400, "Farm site must belong to the selected farmer");
    if (row.seasonId !== site.seasonId)
      reject(400, "Select a farm observation from this season");
  }
  if (row.warehouseIds) {
    if (!Array.isArray(row.warehouseIds) || row.warehouseIds.length > 100)
      reject(400, "Select a valid list of warehouses");
    for (const id of row.warehouseIds) {
      const w = await ctx.s.get(actor.space, "warehouses", id);
      if (!w || !(await ctx.allowed(actor, "warehouses", w)))
        reject(400, "Warehouse is not available in your scope");
    }
  }
  if (entity === "harvestTasks" && !canPlan(actor))
    reject(403, "Harvest planning requires an approved officer or manager");
  if (
    entity === "fieldValidations" &&
    row.status === "Verified" &&
    !manager(actor)
  )
    reject(403, "A manager must approve field validations");
  if (["farmLocations", "fieldValidations"].includes(entity)) {
    const states = Object.keys(NIGERIA_STATES);
    const state = states.find(
      (s) => s.toLowerCase() === String(row.state).toLowerCase(),
    );
    if (!state) reject(400, "Choose a valid Nigerian state");
    const lga = NIGERIA_STATES[state].find(
      (l) => l.toLowerCase() === String(row.lga).toLowerCase(),
    );
    if (!lga) reject(400, "LGA must belong to the selected state");
    row.state = state;
    row.lga = lga;
    if ((row.latitude === undefined) !== (row.longitude === undefined))
      reject(400, "Record both GPS coordinates or leave both blank");
    if (row.farmBoundary) validateBoundary(row.farmBoundary);
    if (
      entity === "farmLocations" &&
      row.latitude === undefined &&
      !row.farmBoundary &&
      !row.address
    )
      reject(400, "Record a point, a polygon or a real address");
    if (
      !manager(actor) &&
      ((actor.states?.length && !actor.states.includes(state)) ||
        (actor.lgas?.length && !actor.lgas.includes(lga)))
    )
      reject(403, "This field location is outside your assigned geography");
  }
  if (entity === "organizations" && row.states) {
    if (
      !Array.isArray(row.states) ||
      row.states.some((v: any) => !NIGERIA_STATES[v])
    )
      reject(400, "Select valid coverage states");
  }
}
function whereCohort(ctx: FeatureContext, a: Session, f: any) {
  const base = ctx.farmerWhere(a, {
    crop: f.fieldValidated ? "" : f.crop,
    state: f.fieldValidated ? "" : f.state,
    organizationId: f.organizationId,
    gender: f.gender,
  });
  const clauses = [base.where],
    args = [...base.args];
  if (f.lga && !f.fieldValidated) {
    clauses.push("json_extract(data,'$.lga')=?");
    args.push(String(f.lga));
  }
  for (const key of ["seasonId", "programId", "interventionId"])
    if (f[key]) {
      const historical = `id IN (SELECT json_extract(p.data,'$.farmerId') FROM records p WHERE p.space=? AND p.entity='participations' AND json_extract(p.data,'$.${key}')=?)`;
      if (key === "programId") {
        clauses.push(`(json_extract(data,'$.programId')=? OR ${historical})`);
        args.push(String(f[key]), a.space, String(f[key]));
      } else {
        clauses.push(historical);
        args.push(a.space, String(f[key]));
      }
    }
  if (f.legacyPhase) {
    clauses.push("json_extract(data,'$.phase')=?");
    args.push(String(f.legacyPhase));
  }
  if (f.fieldValidated) {
    let extra = "";
    const values: any[] = [a.space];
    if (f.validationSeasonId) {
      extra = " AND json_extract(v.data,'$.seasonId')=?";
      values.push(f.validationSeasonId);
    }
    for (const key of ["state", "lga", "crop"])
      if (f[key]) {
        extra += ` AND json_extract(v.data,'$.${key}')=?`;
        values.push(String(f[key]));
      }
    clauses.push(
      `id IN (SELECT json_extract(v.data,'$.farmerId') FROM records v WHERE v.space=? AND v.entity='fieldValidations' AND json_extract(v.data,'$.status')='Verified'${extra})`,
    );
    args.push(...values);
  }
  return { where: clauses.join(" AND "), args };
}
export function registerOperations(ctx: FeatureContext) {
  const { app, s } = ctx;
  app.get(
    "/api/operations/summary",
    route(async (req, res) => {
      const result: any = {
        programmes: 0,
        seasons: 0,
        activeSeasons: 0,
        interventions: 0,
        participations: 0,
        delivered: 0,
        fieldPending: 0,
        fieldVerified: 0,
        activities: 0,
        overdue: 0,
        harvestCompleted: 0,
        sites: 0,
        collections: 0,
        paymentPending: 0,
      };
      const farmers = new Set<string>();
      for (const entity of [
        "programs",
        "seasons",
        "interventions",
        "participations",
        "fieldValidations",
        "harvestTasks",
        "farmLocations",
        "payments",
      ] as Entity[]) {
        for await (const item of s.db
          .prepare("SELECT data FROM records WHERE space=? AND entity=?")
          .iterate(req.actor.space, entity) as any) {
          const r = JSON.parse(item.data);
          if (!(await ctx.allowed(req.actor, entity, r))) continue;
          let include = true;
          for (const key of [
            "programId",
            "seasonId",
            "interventionId",
            "organizationId",
            "state",
            "crop",
          ])
            if (
              req.query[key] &&
              r[key] !== req.query[key] &&
              r.id !== req.query[key]
            )
              include = false;
          if (!include) continue;
          if (entity === "programs") result.programmes++;
          if (entity === "seasons") {
            result.seasons++;
            if (r.status === "Active") result.activeSeasons++;
          }
          if (entity === "interventions" && !r.farmerId) result.interventions++;
          if (entity === "participations") {
            result.participations++;
            farmers.add(r.farmerId);
            if (r.status === "Completed" || r.status === "Delivered")
              result.delivered++;
          }
          if (entity === "fieldValidations") {
            if (r.status === "Pending") result.fieldPending++;
            if (r.status === "Verified") result.fieldVerified++;
          }
          if (entity === "harvestTasks") {
            result.activities++;
            if (
              r.endDate < new Date().toISOString().slice(0, 10) &&
              !["Completed", "Cancelled"].includes(r.status)
            )
              result.overdue++;
            if (r.stage === "Harvest" && r.status === "Completed")
              result.harvestCompleted++;
          }
          if (entity === "farmLocations") result.sites++;
          if (entity === "payments") {
            if (r.status === "Verified")
              result.collections += Number(r.amount || 0);
            else result.paymentPending++;
          }
        }
      }
      result.uniqueBeneficiaries = farmers.size;
      res.json(result);
    }),
  );
  app.get(
    "/api/operations/records/:entity",
    route(async (req, res) => {
      const entity = req.params.entity as Entity;
      if (!ENTITIES.includes(entity)) reject(404, "Unknown record collection");
      const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 25)),
        offset = Math.max(0, Number(req.query.offset) || 0);
      const rows: Row[] = [];
      let total = 0;
      for await (const item of s.db
        .prepare(
          "SELECT data FROM records WHERE space=? AND entity=? ORDER BY rowid DESC",
        )
        .iterate(req.actor.space, entity) as any) {
        const r = JSON.parse(item.data);
        if (!(await ctx.allowed(req.actor, entity, r))) continue;
        if (
          entity === "interventions" &&
          r.farmerId &&
          req.query.includeLegacy !== "true"
        )
          continue;
        if (
          [
            "programId",
            "seasonId",
            "interventionId",
            "organizationId",
            "farmerId",
            "state",
            "status",
            "crop",
          ].some((key) => req.query[key] && r[key] !== req.query[key])
        )
          continue;
        if (total >= offset && rows.length < limit) rows.push(publicRecord(r));
        total++;
      }
      res.json({ rows, total });
    }),
  );
  app.get(
    "/api/operations/record/:entity/:id",
    route(async (req, res) => {
      const entity = req.params.entity as Entity;
      if (!ENTITIES.includes(entity)) reject(404, "Unknown collection");
      const row = await s.get(req.actor.space, entity, req.params.id);
      if (!row || !(await ctx.allowed(req.actor, entity, row)))
        reject(404, "Record not found");
      res.json(publicRecord(row));
    }),
  );
  app.post(
    "/api/operations/cohorts/preview",
    route(async (req, res) => {
      if (!manager(req.actor))
        reject(403, "Only managers can assign beneficiary cohorts");
      const target = req.body.target || {},
        filters = { ...req.body.filters };
      if (typeof target.interventionId !== "string")
        reject(400, "Select an intervention");
      const intervention = await s.get(
        req.actor.space,
        "interventions",
        target.interventionId,
      );
      if (!intervention || intervention.farmerId)
        reject(
          400,
          "Select an intervention definition, not a legacy individual delivery",
        );
      const row = {
        id: "target",
        ...target,
        programId: intervention.programId,
        seasonId: intervention.seasonId,
      };
      await validateLinks(ctx, req.actor, "participations", row);
      if (!(await ctx.allowed(req.actor, "interventions", intervention)))
        reject(403, "Intervention is outside your scope");
      if (filters.fieldValidated && !filters.validationSeasonId)
        filters.validationSeasonId = row.seasonId;
      const selection = whereCohort(ctx, req.actor, filters);
      const jobId = randomUUID();
      let matched = 0,
        eligible = 0,
        duplicates = 0;
      const sample: any[] = [];
      await s.transaction(async () => {
        if (s.db.kind === "postgres")
          await s.db.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
        matched = (
          await s.db
            .prepare(
              `SELECT count(*) AS n FROM records WHERE ${selection.where}`,
            )
            .get(...selection.args)
        ).n;
        if (matched > 250000)
          reject(
            400,
            "Split this cohort into groups of at most 250,000 farmers",
          );
        await s.db
          .prepare(
            "INSERT INTO cohort_jobs(id,space,actor_id,target,filters,created) VALUES(?,?,?,?,?,?)",
          )
          .run(
            jobId,
            req.actor.space,
            req.actor.id,
            JSON.stringify(row),
            JSON.stringify(filters),
            new Date().toISOString(),
          );
        await s.db
          .prepare(
            `INSERT INTO cohort_members(job_id,farmer_id) SELECT ?,id FROM records WHERE (${selection.where}) AND NOT EXISTS(SELECT 1 FROM records p WHERE p.space=records.space AND p.entity='participations' AND json_extract(p.data,'$.farmerId')=records.id AND json_extract(p.data,'$.interventionId')=? AND json_extract(p.data,'$.seasonId')=?)`,
          )
          .run(jobId, ...selection.args, row.interventionId, row.seasonId);
        eligible = (
          await s.db
            .prepare("SELECT count(*) AS n FROM cohort_members WHERE job_id=?")
            .get(jobId)
        ).n;
        duplicates = matched - eligible;
        const rows = await s.db
          .prepare(
            "SELECT r.data FROM cohort_members m JOIN records r ON r.id=m.farmer_id AND r.space=? AND r.entity='farmers' WHERE m.job_id=? ORDER BY r.rowid LIMIT 25",
          )
          .all(req.actor.space, jobId);
        for (const item of rows) {
          const f = JSON.parse(item.data);
          sample.push({
            id: f.id,
            name: names(f),
            farmerID: f.farmerID,
            state: f.state,
            crop: f.crop,
          });
        }
      });
      res.json({ jobId, matched, eligible, duplicates, sample, target: row });
    }),
  );
  app.post(
    "/api/operations/cohorts/:id/commit",
    route(async (req, res) => {
      if (!manager(req.actor)) reject(403, "Only managers can assign cohorts");
      const job = (await s.db
        .prepare(
          "SELECT * FROM cohort_jobs WHERE id=? AND space=? AND actor_id=?",
        )
        .get(req.params.id, req.actor.space, req.actor.id)) as any;
      if (!job) reject(404, "Cohort preview unavailable");
      const target = JSON.parse(job.target);
      await validateLinks(ctx, req.actor, "participations", target);
      const pending = (await s.db
        .prepare(
          "SELECT farmer_id FROM cohort_members WHERE job_id=? AND status='Pending' LIMIT 500",
        )
        .all(job.id)) as any[];
      let enrolled = 0;
      await s.transaction(async () => {
        for (const entry of pending) {
          const f = await s.get(req.actor.space, "farmers", entry.farmer_id);
          if (!f || !(await ctx.allowed(req.actor, "farmers", f))) {
            await s.db
              .prepare(
                "UPDATE cohort_members SET status='Rejected',reason='Farmer no longer in assigned scope' WHERE job_id=? AND farmer_id=?",
              )
              .run(job.id, entry.farmer_id);
            continue;
          }
          const exists = await s.db
            .prepare(
              "SELECT id FROM records WHERE space=? AND entity='participations' AND json_extract(data,'$.farmerId')=? AND json_extract(data,'$.interventionId')=? AND json_extract(data,'$.seasonId')=?",
            )
            .get(req.actor.space, f.id, target.interventionId, target.seasonId);
          if (!exists) {
            const filter = JSON.parse(job.filters);
            const evidence = filter.fieldValidated
              ? ((await s.db
                  .prepare(
                    "SELECT data FROM records WHERE space=? AND entity='fieldValidations' AND json_extract(data,'$.farmerId')=? AND json_extract(data,'$.status')='Verified' AND json_extract(data,'$.seasonId')=? ORDER BY rowid DESC LIMIT 1",
                  )
                  .get(
                    req.actor.space,
                    f.id,
                    filter.validationSeasonId || target.seasonId,
                  )) as any)
              : null;
            if (filter.fieldValidated && !evidence) {
              await s.db
                .prepare(
                  "UPDATE cohort_members SET status='Rejected',reason='Approved field evidence no longer available' WHERE job_id=? AND farmer_id=?",
                )
                .run(job.id, f.id);
              continue;
            }
            const observation = evidence ? JSON.parse(evidence.data) : null;
            const record = {
              ...target,
              id: randomUUID(),
              farmerId: f.id,
              organizationId: target.organizationId || f.organizationId || "",
              state: f.state,
              lga: f.lga,
              crop: f.crop,
              status: "Enrolled",
              enrolledAt: new Date().toISOString(),
              enrolledBy: req.actor.id,
              source: "Bulk cohort",
              cohortId: job.id,
              ...(observation
                ? {
                    state: observation.state,
                    lga: observation.lga,
                    crop: observation.crop,
                    fieldValidationId: observation.id,
                  }
                : {}),
            };
            await s.put(req.actor.space, "participations", record);
            enrolled++;
          }
          await s.db
            .prepare(
              "UPDATE cohort_members SET status=? WHERE job_id=? AND farmer_id=?",
            )
            .run(exists ? "Duplicate" : "Enrolled", job.id, f.id);
        }
        if (pending.length)
          await s.audit(
            req.actor,
            "BULK_ENROL",
            "interventions",
            target.interventionId,
            `Assigned ${enrolled} beneficiaries from reviewed cohort`,
          );
      });
      const counts = (await s.db
        .prepare(
          "SELECT status,count(*) AS count FROM cohort_members WHERE job_id=? GROUP BY status",
        )
        .all(job.id)) as any[];
      res.json({
        enrolled,
        remaining: counts.find((r) => r.status === "Pending")?.count || 0,
        summary: Object.fromEntries(counts.map((c) => [c.status, c.count])),
      });
    }),
  );
  app.get(
    "/api/history/:entity/:id",
    route(async (req, res) => {
      const entity = req.params.entity as Entity,
        id = req.params.id;
      const stateView = (entity as string) === "states";
      if (!stateView && !ENTITIES.includes(entity))
        reject(404, "Unknown history scope");
      const root = stateView
        ? { id, name: id }
        : await s.get(req.actor.space, entity, id);
      if (
        !root ||
        (!stateView && !(await ctx.allowed(req.actor, entity, root)))
      )
        reject(404, "Record not found");
      if (
        stateView &&
        !manager(req.actor) &&
        req.actor.states?.length &&
        !req.actor.states.includes(id)
      )
        reject(403, "State outside assigned scope");
      const select = async (
        collection: Entity,
        predicate: (r: Row) => boolean,
        limit = 1000,
      ) => {
        const out: Row[] = [];
        for await (const item of s.db
          .prepare(
            "SELECT data FROM records WHERE space=? AND entity=? ORDER BY rowid DESC",
          )
          .iterate(req.actor.space, collection) as any) {
          const r = JSON.parse(item.data);
          if (predicate(r) && (await ctx.allowed(req.actor, collection, r)))
            out.push(r);
          if (out.length >= limit) break;
        }
        return out;
      };
      const farmerParticipations =
        entity === "farmers"
          ? await select("participations", (p) => p.farmerId === id)
          : [];
      const farmerInterventions = new Set(
          farmerParticipations.map((p) => p.interventionId),
        ),
        farmerSeasons = new Set(farmerParticipations.map((p) => p.seasonId)),
        farmerPrograms = new Set(farmerParticipations.map((p) => p.programId));
      const key = (
        {
          farmers: "farmerId",
          organizations: "organizationId",
          programs: "programId",
          seasons: "seasonId",
          interventions: "interventionId",
          warehouses: "warehouseId",
          states: "state",
        } as any
      )[entity];
      const farmerIds =
        entity === "organizations"
          ? new Set(
              (
                (await s.db
                  .prepare(
                    "SELECT id FROM records WHERE space=? AND entity='farmers' AND json_extract(data,'$.organizationId')=?",
                  )
                  .all(req.actor.space, id)) as any[]
              ).map((f) => f.id),
            )
          : new Set();
      const related: Record<string, Row[]> = {},
        linkedFarmerIds = new Set<string>();
      for (const e of [
        "participations",
        "farmLocations",
        "fieldValidations",
        "harvestTasks",
        "interventions",
        "payments",
        "seasons",
        "programs",
      ] as Entity[]) {
        const rows = await select(
          e,
          (r) =>
            (key && r[key] === id) ||
            (e === entity && r.id === id) ||
            (entity === "organizations" && farmerIds.has(r.farmerId)) ||
            (entity === "farmers" &&
              ((e === "interventions" && farmerInterventions.has(r.id)) ||
                (e === "seasons" && farmerSeasons.has(r.id)) ||
                (e === "programs" && farmerPrograms.has(r.id)) ||
                (e === "harvestTasks" &&
                  !r.farmerId &&
                  farmerInterventions.has(r.interventionId)))) ||
            (entity === "warehouses" &&
              Array.isArray(r.warehouseIds) &&
              r.warehouseIds.includes(id)),
        );
        rows.forEach((r) => {
          if (r.farmerId && linkedFarmerIds.size < 100)
            linkedFarmerIds.add(r.farmerId);
        });
        related[e] = rows.map(publicRecord);
      }
      const versions = (
        (await s.db
          .prepare(
            "SELECT version,action,recorded_at AS recordedAt,actor_name AS actorName,data FROM record_history WHERE space=? AND entity=? AND record_id=? ORDER BY version DESC LIMIT 100",
          )
          .all(req.actor.space, entity, id)) as any[]
      ).map((v) => ({ ...v, data: publicRecord(JSON.parse(v.data)) }));
      res.json({
        record: publicRecord(root),
        related,
        versions,
        linkedFarmers: (
          await asyncMap([...linkedFarmerIds].slice(0, 100), async (fid) => {
            const f = await s.get(req.actor.space, "farmers", fid);
            return f
              ? { id: f.id, name: names(f), farmerID: f.farmerID }
              : null;
          })
        ).filter(Boolean),
        limits: { relatedPerCollection: 1000, versions: 100 },
        baselineNotice:
          "Only captured observations and revisions are shown; earlier unrecorded history is not invented.",
      });
    }),
  );
  app.post(
    "/api/operations/participations/status",
    route(async (req, res) => {
      if (!manager(req.actor))
        reject(403, "A manager must confirm cohort delivery");
      if (
        !["Enrolled", "In Progress", "Delivered", "Withdrawn"].includes(
          req.body.status,
        )
      )
        reject(400, "Choose a valid delivery status");
      const intervention = await s.get(
        req.actor.space,
        "interventions",
        req.body.interventionId,
      );
      if (
        !intervention ||
        !(await ctx.allowed(req.actor, "interventions", intervention))
      )
        reject(404, "Intervention unavailable");
      let updated = 0;
      const candidates = (await s.db
        .prepare(
          "SELECT data FROM records WHERE space=? AND entity='participations' AND json_extract(data,'$.interventionId')=? AND json_extract(data,'$.status')<>? LIMIT 500",
        )
        .all(req.actor.space, intervention.id, req.body.status)) as any[];
      await s.transaction(async () => {
        for (const item of candidates) {
          const r = JSON.parse(item.data);
          if (!(await ctx.allowed(req.actor, "participations", r))) continue;
          await s.put(req.actor.space, "participations", {
            ...r,
            status: req.body.status,
            statusDate: new Date().toISOString(),
            statusBy: req.actor.id,
            deliveryNotes: String(req.body.notes || ""),
          });
          updated++;
        }
        await s.audit(
          req.actor,
          "COHORT_STATUS",
          "interventions",
          intervention.id,
          `Recorded ${updated} ${req.body.status} beneficiary outcomes`,
        );
      });
      res.json({
        updated,
        remaining: (
          (await s.db
            .prepare(
              "SELECT count(*) AS n FROM records WHERE space=? AND entity='participations' AND json_extract(data,'$.interventionId')=? AND json_extract(data,'$.status')<>?",
            )
            .get(req.actor.space, intervention.id, req.body.status)) as any
        ).n,
      });
    }),
  );
  app.get(
    "/api/operations/calendar",
    route(async (req, res) => {
      const month = String(req.query.month || "");
      if (!/^\d{4}-\d{2}$/.test(month)) reject(400, "Month must be YYYY-MM");
      const tasks = await asyncFilter(
        await s.all(req.actor.space, "harvestTasks"),
        async (t) =>
          (await ctx.allowed(req.actor, "harvestTasks", t)) &&
          t.startDate <= month + "-31" &&
          t.endDate >= month + "-01" &&
          (!req.query.seasonId || t.seasonId === req.query.seasonId),
      );
      res.json(tasks.map(publicRecord));
    }),
  );
  app.get(
    "/api/operations/calendar.ics",
    route(async (req, res) => {
      const escape = (v: any) =>
        String(v || "")
          .replace(/\\/g, "\\\\")
          .replace(/\n/g, "\\n")
          .replace(/[,;]/g, (m) => "\\" + m);
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
      const events = await asyncFilter(
        await s.all(req.actor.space, "harvestTasks"),
        async (t) =>
          (await ctx.allowed(req.actor, "harvestTasks", t)) &&
          (!req.query.seasonId || t.seasonId === req.query.seasonId),
      );
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//RIFAN Connect//Harvest Planner//EN",
        "CALSCALE:GREGORIAN",
      ];
      for (const t of events) {
        const end = new Date(t.endDate + "T00:00:00Z");
        end.setUTCDate(end.getUTCDate() + 1);
        lines.push(
          "BEGIN:VEVENT",
          `UID:${t.id}@rifan.connect`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${t.startDate.replaceAll("-", "")}`,
          `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll("-", "")}`,
          `SUMMARY:${escape(t.name)}`,
          `DESCRIPTION:${escape(t.notes)}`,
          `STATUS:${t.status === "Cancelled" ? "CANCELLED" : "CONFIRMED"}`,
          "END:VEVENT",
        );
      }
      lines.push("END:VCALENDAR");
      res
        .type("text/calendar")
        .attachment("RIFAN-harvest-plan.ics")
        .send(lines.join("\r\n") + "\r\n");
    }),
  );
  app.get(
    "/api/import/failures/:id.csv",
    route(async (req, res) => {
      if (!manager(req.actor))
        reject(403, "Only authorized reviewers can export failed source rows");
      if (
        req.actor.role === "Manager" &&
        (req.actor.organizationId ||
          req.actor.states?.length ||
          req.actor.lgas?.length)
      )
        reject(
          403,
          "Original source exports require an administrator or an unrestricted import reviewer",
        );
      const batch = await s.get(req.actor.space, "imports", req.params.id);
      if (!batch) reject(404, "Import not found");
      const quote = (v: any) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+\-@\t\r]/, "'" + "$&")
          .replaceAll('"', '""') +
        '"';
      res.type("text/csv").attachment("RIFAN-import-failures.csv");
      res.write(
        "\uFEFF" +
          ["sourceRow", "status", "reason", "originalRowJSON"]
            .map(quote)
            .join(",") +
          "\r\n",
      );
      for await (const row of s.db
        .prepare(
          "SELECT source_row,status,reason,raw FROM source_records WHERE space=? AND batch_id=? AND status<>'Imported' ORDER BY source_row",
        )
        .iterate(req.actor.space, req.params.id) as any) {
        if (res.destroyed) break;
        if (
          !res.write(
            [row.source_row, row.status, row.reason || "Not imported", row.raw]
              .map(quote)
              .join(",") + "\r\n",
          )
        )
          await once(res, "drain");
      }
      await s.audit(
        req.actor,
        "EXPORT",
        "imports",
        req.params.id,
        "Downloaded all failed/duplicate source rows and reasons (sensitive reviewer export)",
      );
      res.end();
    }),
  );
  registerIntelligence(ctx);
}
