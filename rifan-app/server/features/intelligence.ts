import type { Row } from "../../src/model";
import type { FeatureContext } from "./context";
export const quantile = (values: number[], p: number) => {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const at = (s.length - 1) * p,
    lo = Math.floor(at);
  return s[lo] + (s[Math.ceil(at)] - s[lo]) * (at - lo);
};
export function analyse(input: {
  farmers: Row[];
  locations: Row[];
  tasks: Row[];
  validations: Row[];
  participations: Row[];
  seasons: Row[];
  now?: Date;
}) {
  const now = (input.now || new Date()).toISOString().slice(0, 10);
  const signals: {
    id: string;
    priority: string;
    title: string;
    recommendation: string;
    count: number;
    source: string;
  }[] = [];
  const add = (
    id: string,
    priority: string,
    title: string,
    recommendation: string,
    count: number,
    source: string,
  ) => {
    if (count)
      signals.push({ id, priority, title, recommendation, count, source });
  };
  const validGPS = (r: Row) =>
    Number.isFinite(r.latitude) && Number.isFinite(r.longitude);
  add(
    "missing-location",
    "High",
    "Farm sites need location evidence",
    "Capture a GPS point, a surveyed boundary and an address during the next field visit. Do not infer individual farm coordinates from state centres.",
    input.farmers.filter(
      (f) =>
        !validGPS(f) &&
        !input.locations.some(
          (l) => l.farmerId === f.id && (validGPS(l) || l.farmBoundary),
        ),
    ).length,
    "Loaded farmer/site records",
  );
  add(
    "overdue",
    "High",
    "Scheduled work is overdue",
    "Review overdue activities with the assigned officer, record the actual outcome, and revise dates with a reason.",
    input.tasks.filter(
      (t) => t.endDate < now && !["Completed", "Cancelled"].includes(t.status),
    ).length,
    "Recorded activity dates/statuses",
  );
  add(
    "validation",
    "Medium",
    "Field validation is pending",
    "Approve or reject submitted field evidence before using it to target verified-beneficiary cohorts.",
    input.validations.filter((v) => v.status === "Pending").length,
    "Field-validation workflow",
  );
  add(
    "soil",
    "Medium",
    "Low soil fertility recorded",
    "Arrange soil testing and a locally approved nutrient plan before prescribing fertilizer rates.",
    input.farmers.filter((f) => f.soilFertility === "Low").length,
    "Recorded soil fertility",
  );
  add(
    "harvest",
    "Medium",
    "Harvest activities are approaching",
    "Confirm maturity in the field; plan labour, drying, transport and available warehouse capacity.",
    input.tasks.filter(
      (t) =>
        t.stage === "Harvest" &&
        t.startDate >= now &&
        Date.parse(t.startDate) - Date.parse(now) <= 14 * 86400000 &&
        t.status !== "Completed",
    ).length,
    "Scheduled harvest activities",
  );
  const groups = new Map<
    string,
    { kg: number; ha: number; crop: string; state: string }
  >();
  for (const t of input.tasks) {
    if (
      t.stage !== "Harvest" ||
      t.status !== "Completed" ||
      !(Number(t.actualYield) > 0) ||
      !t.locationId
    )
      continue;
    const l = input.locations.find((l) => l.id === t.locationId);
    if (!l || !(Number(l.farmSize) > 0)) continue;
    const key = [t.farmerId, t.seasonId, t.locationId].join(":");
    const g = groups.get(key) || {
      kg: 0,
      ha: Number(l.farmSize),
      crop: l.crop || "Not recorded",
      state: l.state,
    };
    g.kg += Number(t.actualYield);
    groups.set(key, g);
  }
  const samples = [...groups.values()];
  const yields = samples.map((v) => v.kg / v.ha).filter(Number.isFinite);
  const forecast =
    yields.length >= 3
      ? {
          method: "Historical median yield per hectare",
          observations: yields.length,
          medianKgPerHa: quantile(yields, 0.5),
          lowerKgPerHa: quantile(yields, 0.25),
          upperKgPerHa: quantile(yields, 0.75),
          interval:
            "Observed interquartile range; not a probability or guaranteed yield",
          limitations:
            "Compare the same crop, locality and production system. Weather, pests, management and measurement quality can change outcomes.",
        }
      : {
          method: "Insufficient measured history",
          observations: yields.length,
          medianKgPerHa: null,
          lowerKgPerHa: null,
          upperKgPerHa: null,
          limitations:
            "At least three completed farmer-season-site harvest observations with actual kilograms and measured hectares are required.",
        };
  return {
    generatedAt: new Date().toISOString(),
    mode: "Explainable rules and descriptive historical estimates",
    forecast,
    signals,
    coverage: {
      farmerWindow: input.farmers.length,
      sites: input.locations.length,
      participations: input.participations.length,
      validations: input.validations.length,
      activities: input.tasks.length,
    },
    disclaimer:
      "Decision support, not a guaranteed prediction. Confirm agronomic interventions with qualified extension officers.",
  };
}
export function intelligenceFor(
  ctx: FeatureContext,
  actor: any,
  filters: any = {},
) {
  const filtered = (entity: any) => {
    const rows: Row[] = [];
    for (const item of ctx.s.db
      .prepare(
        "SELECT data FROM records WHERE space=? AND entity=? ORDER BY rowid DESC",
      )
      .iterate(actor.space, entity) as any) {
      const r = JSON.parse(item.data);
      if (
        ctx.allowed(actor, entity, r) &&
        (!filters.programId || r.programId === filters.programId) &&
        (!filters.seasonId || r.seasonId === filters.seasonId) &&
        (!filters.interventionId ||
          r.interventionId === filters.interventionId) &&
        (!filters.farmerId || r.farmerId === filters.farmerId) &&
        (!filters.state || r.state === filters.state) &&
        (!filters.crop || r.crop === filters.crop)
      )
        rows.push(r);
      if (rows.length === 1000) break;
    }
    return rows;
  };
  const { where, args } = ctx.farmerWhere(actor, {
    state: filters.state,
    crop: filters.crop,
  });
  const farmers = (
    ctx.s.db
      .prepare(
        `SELECT data FROM records WHERE ${where} ${filters.farmerId ? "AND id=?" : ""} LIMIT 1000`,
      )
      .all(
        ...args,
        ...(filters.farmerId ? [String(filters.farmerId)] : []),
      ) as any[]
  ).map((r) => JSON.parse(r.data));
  return analyse({
    farmers,
    locations: filtered("farmLocations"),
    tasks: filtered("harvestTasks"),
    validations: filtered("fieldValidations"),
    participations: filtered("participations"),
    seasons: filtered("seasons"),
  });
}
export function registerIntelligence(ctx: FeatureContext) {
  ctx.app.get("/api/intelligence", (req: any, res, next) => {
    try {
      res.json(intelligenceFor(ctx, req.actor, req.query));
    } catch (e) {
      next(e);
    }
  });
  ctx.app.post("/api/intelligence/advice", (req: any, res, next) => {
    try {
      const info = intelligenceFor(ctx, req.actor, req.body.filters || {});
      const q = String(req.body.question || "")
        .slice(0, 10000)
        .toLowerCase();
      const recommendations = info.signals.map((s) => s.recommendation);
      if (/pest|disease|blast/.test(q))
        recommendations.unshift(
          "Inspect symptoms and field distribution; identify the pest or disease with an extension officer before choosing a registered treatment. Do not infer a diagnosis from text alone.",
        );
      if (/water|irrigat/.test(q))
        recommendations.unshift(
          "Check soil moisture, crop stage, water availability and the local forecast before changing irrigation. Record observations at the actual farm site.",
        );
      if (/stor|dry|moisture/.test(q))
        recommendations.unshift(
          "Measure grain moisture with a calibrated meter, dry to the buyer/storage specification, clean stores, and record lot quantities and warehouse capacity.",
        );
      res.json({
        mode: "Local evidence-based rules",
        text: recommendations.length
          ? recommendations.join("\n\n")
          : "Record field validations, actual farm locations, planting dates and measured harvest outcomes to generate more specific recommendations.",
        evidence: info,
        providerCalled: false,
      });
    } catch (e) {
      next(e);
    }
  });
}
