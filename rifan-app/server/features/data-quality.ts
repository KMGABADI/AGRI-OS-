import { randomUUID } from "node:crypto";
import type { Store } from "../database";
import type { Row, Entity, Session } from "../../src/model";
import { normalizeInput, suggestMapping } from "../../src/lib/importing";
import { validate } from "../validation";
import { route, reject, type FeatureContext } from "./context";
import { validateBoundary } from "./operations";
export function requireReviewer(actor: Session) {
  if (
    !["Super Admin", "Admin", "Manager"].includes(actor.role) ||
    (actor.role === "Manager" &&
      (actor.organizationId || actor.states?.length || actor.lgas?.length))
  )
    reject(
      403,
      "Data-quality checks across original imports require an administrator or unrestricted reviewer",
    );
}
export async function reconcileImport(s: Store, space: string, id: string) {
  const record = await s.get(space, "imports", id);
  if (!record) return;
  const counts = (await s.db
    .prepare(
      "SELECT status,count(*) AS count FROM source_records WHERE space=? AND batch_id=? GROUP BY status",
    )
    .all(space, id)) as any[];
  if (!counts.length) return; // A rejected/damaged file has no rows; retain its failure status.
  const summary = Object.fromEntries(counts.map((c) => [c.status, c.count]));
  const status = summary.Valid
    ? "Ready to import"
    : summary.Invalid || summary.Duplicate
      ? "Completed with review"
      : "Completed";
  const next = { ...record, count: summary.Imported || 0, status, summary };
  if (JSON.stringify(next) !== JSON.stringify(record))
    await s.put(space, "imports", next);
  return next;
}
export function sourceCandidate(source: any) {
  if (source.submitted) return JSON.parse(source.submitted);
  if (source.normalized) return JSON.parse(source.normalized);
  const raw = JSON.parse(source.raw);
  const mapping = suggestMapping(Object.keys(raw));
  const targets = new Set(Object.values(mapping));
  if (
    ["firstName", "lastName", "primaryPhone", "state", "lga"].some(
      (k) => !targets.has(k),
    )
  )
    throw new Error(
      "Original custom mapping is unavailable; review and map this source row before rechecking",
    );
  return normalizeInput(raw, mapping).data;
}
function issue(error: unknown) {
  return error instanceof Error ? error.message : "Record needs review";
}
async function linked(s: Store, space: string, row: Row) {
  for (const [key, entity] of [
    ["organizationId", "organizations"],
    ["programId", "programs"],
  ] as [string, Entity][]) {
    if (row[key] && !(await s.get(space, entity, row[key])))
      throw new Error(`${key} points to a missing record`);
  }
  if (row.programId && row.organizationId) {
    const p = await s.get(space, "programs", row.programId);
    if (p?.organizationId && p.organizationId !== row.organizationId)
      throw new Error("Programme must belong to the selected organization");
  }
  if (row.farmBoundary) validateBoundary(row.farmBoundary);
}
export async function recheckSources(
  s: Store,
  actor: Session,
  options: {
    afterId?: number;
    batchId?: string;
    limit?: number;
  },
  duplicate: (
    space: string,
    row: Row,
    except?: string,
  ) => Promise<Row | undefined>,
) {
  const afterId = options.afterId || 0,
    limit = Math.min(500, Math.max(1, options.limit || 500));
  const entries = (await s.db
    .prepare(
      `SELECT * FROM source_records WHERE space=? AND status='Invalid' AND id>? ${options.batchId ? "AND batch_id=?" : ""} ORDER BY id LIMIT ?`,
    )
    .all(
      actor.space,
      afterId,
      ...(options.batchId ? [options.batchId] : []),
      limit,
    )) as any[];
  const result = {
    checked: 0,
    ready: 0,
    invalid: 0,
    duplicates: 0,
    updated: 0,
    afterId,
    remaining: 0,
  };
  const batches = new Set<string>();
  await s.transaction(async () => {
    for (const source of entries) {
      let candidate: Row | undefined,
        reason = "",
        status = "Valid",
        farmerId: string | null = null;
      try {
        candidate = validate("farmers", {
          ...sourceCandidate(source),
          id: randomUUID(),
        });
        await linked(s, actor.space, candidate);
        const match = await duplicate(actor.space, candidate);
        if (match) {
          status = "Duplicate";
          reason = "Existing member matches phone, BVN, NIN or member ID";
          farmerId = match.id;
        }
      } catch (e) {
        status = "Invalid";
        reason = issue(e);
      }
      const serialized = candidate
        ? JSON.stringify(candidate)
        : source.normalized;
      await s.db
        .prepare(
          "UPDATE source_records SET normalized=?,status=?,reason=?,farmer_id=? WHERE id=? AND space=?",
        )
        .run(serialized, status, reason, farmerId, source.id, actor.space);
      result.checked++;
      if (status === "Valid") result.ready++;
      else if (status === "Duplicate") result.duplicates++;
      else result.invalid++;
      if (status !== source.status || reason !== source.reason)
        result.updated++;
      result.afterId = source.id;
      batches.add(source.batch_id);
    }
    for (const batch of batches) await reconcileImport(s, actor.space, batch);
    if (entries.length)
      await s.audit(
        actor,
        "DATA_RECHECK",
        "imports",
        options.batchId || "all",
        `Rechecked ${result.checked} rejected rows; ${result.ready} ready, ${result.invalid} need correction, ${result.duplicates} duplicates. Originals retained.`,
      );
  });
  result.remaining = (
    (await s.db
      .prepare(
        `SELECT count(*) AS n FROM source_records WHERE space=? AND status='Invalid' AND id>? ${options.batchId ? "AND batch_id=?" : ""}`,
      )
      .get(
        actor.space,
        result.afterId,
        ...(options.batchId ? [options.batchId] : []),
      )) as any
  ).n;
  return result;
}
export async function dataQualitySummary(s: Pick<Store, "db">, space: string) {
  const statuses = (await s.db
    .prepare(
      "SELECT status,count(*) AS count FROM source_records WHERE space=? GROUP BY status",
    )
    .all(space)) as any[];
  const reasons = await s.db
    .prepare(
      "SELECT reason,count(*) AS count FROM source_records WHERE space=? AND status='Invalid' GROUP BY reason ORDER BY count(*) DESC LIMIT 50",
    )
    .all(space);
  const farmers = (await s.db
    .prepare(
      "SELECT count(*) AS total,sum(CASE WHEN json_extract(data,'$.latitude') IS NULL OR json_extract(data,'$.longitude') IS NULL THEN 1 ELSE 0 END) AS missingCoordinates,sum(CASE WHEN coalesce(json_extract(data,'$.dob'),'')='' THEN 1 ELSE 0 END) AS missingBirthDate FROM records WHERE space=? AND entity='farmers'",
    )
    .get(space)) as any;
  const orphanedSources = (
    (await s.db
      .prepare(
        "SELECT count(*) AS n FROM source_records s WHERE space=? AND status='Imported' AND NOT EXISTS(SELECT 1 FROM records r WHERE r.space=s.space AND r.entity='farmers' AND r.id=s.farmer_id)",
      )
      .get(space)) as any
  ).n;
  const phoneExpression =
    "CASE WHEN length(json_extract(data,'$.primaryPhone'))=11 AND substr(json_extract(data,'$.primaryPhone'),1,2) IN ('07','08','09') THEN '+234'||substr(json_extract(data,'$.primaryPhone'),2) WHEN length(json_extract(data,'$.primaryPhone'))=13 AND substr(json_extract(data,'$.primaryPhone'),1,3)='234' THEN '+'||json_extract(data,'$.primaryPhone') ELSE json_extract(data,'$.primaryPhone') END";
  const duplicates: Record<string, number> = {};
  for (const key of ["primaryPhone", "bvn", "nin", "farmerID"]) {
    const expr =
      key === "primaryPhone"
        ? phoneExpression
        : `json_extract(data,'$.${key}')`;
    duplicates[key] = (
      (await s.db
        .prepare(
          `SELECT count(*) AS n FROM (SELECT ${expr} AS value FROM records WHERE space=? AND entity='farmers' AND coalesce(${expr},'')<>'' GROUP BY ${expr} HAVING count(*)>1)`,
        )
        .get(space)) as any
    ).n;
  }
  return {
    generatedAt: new Date().toISOString(),
    farmers,
    sources: Object.fromEntries(statuses.map((r) => [r.status, r.count])),
    totalSources: statuses.reduce((n, r) => n + r.count, 0),
    reasons,
    orphanedSources,
    duplicateGroups: duplicates,
    note: "Missing optional observations are completeness gaps, not invented validation failures. Duplicate identities require human review; records are never automatically merged.",
  };
}
export function registerDataQuality(
  ctx: FeatureContext & {
    duplicate: (
      space: string,
      row: Row,
      except?: string,
    ) => Promise<Row | undefined>;
    refCheck: (actor: Session, entity: Entity, row: Row) => Promise<void>;
  },
) {
  ctx.app.get(
    "/api/data-quality",
    route(async (req, res) => {
      requireReviewer(req.actor);
      res.json(await dataQualitySummary(ctx.s, req.actor.space));
    }),
  );
  ctx.app.post(
    "/api/data-quality/recheck",
    route(async (req, res) => {
      requireReviewer(req.actor);
      const afterId = Number(req.body.afterId || 0);
      if (!Number.isSafeInteger(afterId) || afterId < 0)
        reject(400, "Invalid source cursor");
      if (
        req.body.batchId !== undefined &&
        typeof req.body.batchId !== "string"
      )
        reject(400, "Invalid import ID");
      res.json(
        await recheckSources(
          ctx.s,
          req.actor,
          { afterId, batchId: req.body.batchId },
          ctx.duplicate,
        ),
      );
    }),
  );
  ctx.app.post(
    "/api/data-quality/audit",
    route(async (req, res) => {
      requireReviewer(req.actor);
      const offset = Number(req.body.offset || 0);
      if (!Number.isSafeInteger(offset) || offset < 0)
        reject(400, "Invalid registry cursor");
      const version = await ctx.s.version();
      if (req.body.version && req.body.version !== version)
        reject(
          409,
          "Farmer records changed during the audit. Restart it for consistent results.",
        );
      const rows = (await ctx.s.db
        .prepare(
          "SELECT data FROM records WHERE space=? AND entity='farmers' ORDER BY rowid LIMIT 500 OFFSET ?",
        )
        .all(req.actor.space, offset)) as any[];
      const result = {
        version,
        checked: rows.length,
        valid: 0,
        needsReview: 0,
        normalizable: 0,
        reasons: {} as Record<string, number>,
        nextOffset: offset + rows.length,
        complete: rows.length < 500,
      };
      for (const item of rows) {
        const original = JSON.parse(item.data);
        try {
          const checked = validate("farmers", original);
          await linked(ctx.s, req.actor.space, checked);
          result.valid++;
          if (JSON.stringify(original) !== JSON.stringify(checked))
            result.normalizable++;
        } catch (e) {
          result.needsReview++;
          const reason = issue(e);
          result.reasons[reason] = (result.reasons[reason] || 0) + 1;
        }
      }
      res.json(result);
    }),
  );
}
