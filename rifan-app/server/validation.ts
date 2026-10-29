import { z } from "zod";
import { COUNTRIES_REGIONS } from "../src/lib/crossBorderData";
import { entityFields, type Entity, type Row } from "../src/model";
export const farmerSchema = z
  .object({
    firstName: z.string().trim().min(2),
    lastName: z.string().trim().min(2),
    primaryPhone: z
      .string()
      .regex(/^\+?[0-9]{10,15}$/, "Phone must contain 10–15 digits"),
    state: z.string().trim().min(2),
    lga: z.string().trim().min(2),
    gender: z.enum(["Male", "Female", "Other"]),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    farmSize: z.number().nonnegative().optional(),
    experience: z.number().nonnegative().optional(),
    bvn: z
      .string()
      .regex(/^$|^\d{11}$/, "BVN must be 11 digits")
      .optional(),
    nin: z
      .string()
      .regex(/^$|^\d{11}$/, "NIN must be 11 digits")
      .optional(),
    accountNumber: z
      .string()
      .regex(/^$|^\d{10}$/, "Account number must be 10 digits")
      .optional(),
  })
  .passthrough();
export function validate(entity: Entity, input: any): Row {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("A record object is required");
  const out = { ...input };
  const uppercaseFields = [
    "firstName",
    "middleName",
    "lastName",
    "fullName",
    "title",
    "ward",
    "community",
    "address",
    "variety",
    "insurance",
    "insurer",
    "anchor",
    "agent",
    "remarks",
    "name",
    "contactPerson",
    "manager",
    "note",
    "notes",
    "description",
    "message",
  ];
  for (const key of uppercaseFields)
    if (typeof out[key] === "string")
      out[key] = out[key].trim().normalize("NFC").toLocaleUpperCase("en-NG");
  for (const key of ["firstName", "lastName"])
    if (
      out[key] &&
      (!/^[\p{L}\p{M} .’'\-]+$/u.test(out[key]) || out[key].length > 100)
    )
      throw new Error(
        `${key} must contain a valid name of at most 100 characters`,
      );
  for (const [key, value] of Object.entries(out))
    if (typeof value === "string" && value.length > 10000 && key !== "mapping")
      throw new Error(`${key} is too long`);
  for (const f of entityFields[entity] || []) {
    if (
      f.required &&
      (out[f.key] === undefined || out[f.key] === null || out[f.key] === "")
    )
      throw new Error(`${f.label} is required`);
    if (f.type === "number" && out[f.key] !== undefined && out[f.key] !== "") {
      out[f.key] = Number(out[f.key]);
      if (!Number.isFinite(out[f.key]))
        throw new Error(`${f.label} must be a number`);
      if (f.min !== undefined && out[f.key] < f.min)
        throw new Error(`${f.label} must be at least ${f.min}`);
      if (f.max !== undefined && out[f.key] > f.max)
        throw new Error(`${f.label} must be at most ${f.max}`);
    } else if (f.type === "number" && out[f.key] === "") delete out[f.key];
    if (f.type === "select" && f.options && out[f.key]) {
      const option = f.options.find(
        (v) => v.toLowerCase() === String(out[f.key]).toLowerCase(),
      );
      if (!option) throw new Error(`Invalid ${f.label}`);
      out[f.key] = option;
    }
  }
  for (const key of [
    "dob",
    "registrationDate",
    "plantingDate",
    "harvestDate",
    "dateApplied",
    "startDate",
    "endDate",
    "dueDate",
  ])
    if (out[key]) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(String(out[key])) ||
        !Number.isFinite(Date.parse(out[key])) ||
        new Date(out[key]).toISOString().slice(0, 10) !== out[key]
      )
        throw new Error(`${key} must be a real date in YYYY-MM-DD format`);
    }
  if (out.dob && out.dob > new Date().toISOString().slice(0, 10))
    throw new Error("Date of birth cannot be in the future");
  if (out.plantingDate && out.harvestDate && out.harvestDate < out.plantingDate)
    throw new Error("Harvest date cannot precede planting date");
  if (out.startDate && out.endDate && out.endDate < out.startDate)
    throw new Error("End date cannot precede start date");
  if (entity === "farmers") {
    const country = Object.keys(COUNTRIES_REGIONS).find(
      (c) => c.toLowerCase() === String(out.country || "Nigeria").toLowerCase(),
    );
    if (!country) throw new Error("Choose a supported country");
    out.country = country;
    const regions = COUNTRIES_REGIONS[country];
    const state = Object.keys(regions).find(
      (k) => k.toLowerCase() === String(out.state).toLowerCase(),
    );
    if (!state)
      throw new Error("State/region does not match the selected country");
    out.state = state;
    const lga = regions[state].find(
      (k) =>
        k.toLowerCase().replace(/[^a-z0-9]/g, "") ===
        String(out.lga)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ""),
    );
    if (!lga)
      throw new Error("LGA/department does not belong to the selected state");
    out.lga = lga;

    if (typeof out.kycComplete === "string")
      out.kycComplete = ["true", "yes", "1"].includes(
        out.kycComplete.toLowerCase(),
      );
    const parsed = farmerSchema.safeParse(out);
    if (!parsed.success)
      throw new Error(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
    Object.assign(out, parsed.data);
    if ((out.latitude === undefined) !== (out.longitude === undefined))
      throw new Error(
        "Provide both latitude and longitude, or leave both blank",
      );
    for (const k of ["loanReq", "loanApproved", "yield_amount"])
      if (
        out[k] !== undefined &&
        (!Number.isFinite(Number(out[k])) || Number(out[k]) < 0)
      )
        throw new Error(`${k} must be non-negative`);
  }
  if (entity === "templates") {
    try {
      const m = JSON.parse(out.mapping);
      if (
        !m ||
        Array.isArray(m) ||
        typeof m !== "object" ||
        Object.values(m).some((v) => typeof v !== "string")
      )
        throw 0;
    } catch {
      throw new Error("Mapping must be a JSON object with string field names");
    }
  }
  if (entity === "workbooks") {
    let u: URL;
    try {
      u = new URL(out.url);
    } catch {
      throw new Error("A valid Google Sheets URL is required");
    }
    if (
      u.protocol !== "https:" ||
      u.hostname !== "docs.google.com" ||
      !/^\/spreadsheets\/d\/[A-Za-z0-9_-]+/.test(u.pathname)
    )
      throw new Error("Use a Google Sheets spreadsheet URL");
  }
  return out;
}
