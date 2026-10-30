import type { Session, Row, Entity } from "../../src/model";
import type { Store } from "../database";
export function primaryScope(a: Session, r: Row) {
  return (
    (!a.organizationId || r.organizationId === a.organizationId) &&
    (!a.states?.length || a.states.includes(r.state)) &&
    (!a.lgas?.length || a.lgas.includes(r.lga))
  );
}
export async function relationshipScope(
  s: Store,
  a: Session,
  farmerId: string,
) {
  const parts = [
      "space=?",
      "entity IN ('participations','farmLocations','fieldValidations')",
      "json_extract(data,'$.farmerId')=?",
    ],
    args: any[] = [a.space, farmerId];
  if (a.organizationId) {
    parts.push("json_extract(data,'$.organizationId')=?");
    args.push(a.organizationId);
  }
  for (const [key, values] of [
    ["state", a.states],
    ["lga", a.lgas],
  ] as [string, string[] | undefined][]) {
    if (values?.length) {
      parts.push(
        `json_extract(data,'$.${key}') IN (${values.map(() => "?").join(",")})`,
      );
      args.push(...values);
    }
  }
  return !!(await s.db
    .prepare(`SELECT id FROM records WHERE ${parts.join(" AND ")} LIMIT 1`)
    .get(...args));
}
export function farmerScopeSql(a: Session) {
  const primary: string[] = [],
    baseArgs: any[] = [];
  if (a.organizationId) {
    primary.push("json_extract(data,'$.organizationId')=?");
    baseArgs.push(a.organizationId);
  }
  for (const [key, values] of [
    ["state", a.states],
    ["lga", a.lgas],
  ] as [string, string[] | undefined][]) {
    if (values?.length) {
      primary.push(
        `json_extract(data,'$.${key}') IN (${values.map(() => "?").join(",")})`,
      );
      baseArgs.push(...values);
    }
  }
  if (!primary.length) return { clause: "1=1", args: [] };
  const historical = [
      "p.space=?",
      "p.entity IN ('participations','farmLocations','fieldValidations')",
    ],
    args: any[] = [a.space];
  if (a.organizationId) {
    historical.push("json_extract(p.data,'$.organizationId')=?");
    args.push(a.organizationId);
  }
  for (const [key, values] of [
    ["state", a.states],
    ["lga", a.lgas],
  ] as [string, string[] | undefined][]) {
    if (values?.length) {
      historical.push(
        `json_extract(p.data,'$.${key}') IN (${values.map(() => "?").join(",")})`,
      );
      args.push(...values);
    }
  }
  return {
    clause: `((${primary.join(" AND ")}) OR id IN (SELECT json_extract(p.data,'$.farmerId') FROM records p WHERE ${historical.join(" AND ")}))`,
    args: [...baseArgs, ...args],
  };
}
