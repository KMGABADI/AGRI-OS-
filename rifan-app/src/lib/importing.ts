import type { Row } from "../model";
export const normalizeHeader = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const aliases: Record<string, string> = {
  firstname: "firstName",
  surname: "lastName",
  lastname: "lastName",
  middlename: "middleName",
  fullname: "fullName",
  name: "fullName",
  phone: "primaryPhone",
  phonenumber: "primaryPhone",
  mobile: "primaryPhone",
  mobilenumber: "primaryPhone",
  primaryphone: "primaryPhone",
  state: "state",
  statename: "state",
  lga: "lga",
  localgovernment: "lga",
  ward: "ward",
  community: "community",
  gender: "gender",
  sex: "gender",
  bvn: "bvn",
  bankverificationnumber: "bvn",
  nin: "nin",
  nationalidentitynumber: "nin",
  farmerid: "farmerID",
  farmsize: "farmSize",
  farmsizeha: "farmSize",
  hectares: "farmSize",
  regdate: "registrationDate",
  registrationdate: "registrationDate",
  dateofbirth: "dob",
  dob: "dob",
  status: "profileStatus",
  kyccomplete: "kycComplete",
  accountnumber: "accountNumber",
  bankname: "bankName",
  crop: "crop",
  country: "country",
  plantingdate: "plantingDate",
  harvestdate: "harvestDate",
  latitude: "latitude",
  longitude: "longitude",
  organizationid: "organizationId",
  programid: "programId",
  marital: "marital",
  education: "education",
  address: "address",
  landownership: "landOwnership",
  soiltype: "soilType",
  soilfertility: "soilFertility",
  irrigation: "irrigation",
  mechanization: "mechanization",
  variety: "variety",
  loanreq: "loanReq",
  loanapproved: "loanApproved",
  insurance: "insurance",
  insurer: "insurer",
  anchor: "anchor",
  remarks: "remarks",
  experience: "experience",
  agent: "agent",
  phase: "phase",
};
export function suggestMapping(headers: string[]) {
  return Object.fromEntries(
    headers.map((h) => [h, aliases[normalizeHeader(h)] || ""]),
  );
}
export function normalizeInput(
  input: Record<string, any>,
  mapping: Record<string, string>,
) {
  const targets = Object.values(mapping).filter(Boolean);
  if (new Set(targets).size !== targets.length)
    throw new Error(
      "Map each RIFAN field only once; duplicate target mappings are not allowed",
    );
  const out: Record<string, any> = {};
  const changes: string[] = [];
  for (const [from, to] of Object.entries(mapping)) {
    if (!to || input[from] === undefined || input[from] === null) continue;
    let v = input[from];
    if (typeof v === "string") v = v.trim().normalize("NFC");
    if (v === "") continue;
    out[to] = v;
  }
  if (out.primaryPhone) {
    let p = String(out.primaryPhone).replace(/[\s()\-.]/g, "");
    if (/^234\d{10}$/.test(p)) p = "+" + p;
    else if (
      /^[789]\d{9}$/.test(p) &&
      (!out.country || out.country === "Nigeria")
    ) {
      p = "0" + p;
      changes.push("Restored Nigerian phone leading zero");
    }
    if (p !== out.primaryPhone) changes.push("Normalized phone punctuation");
    out.primaryPhone = p;
  }
  if (out.gender) {
    const g = String(out.gender).toLowerCase();
    out.gender = ["m", "male"].includes(g)
      ? "Male"
      : ["f", "female"].includes(g)
        ? "Female"
        : g === "other"
          ? "Other"
          : out.gender;
  }
  for (const key of [
    "farmSize",
    "experience",
    "latitude",
    "longitude",
    "loanReq",
    "loanApproved",
    "yield_amount",
  ])
    if (out[key] !== undefined) {
      const original = out[key];
      const n = Number(String(original).replaceAll(",", ""));
      out[key] = Number.isFinite(n) ? n : original;
    }
  if (out.kycComplete !== undefined) {
    out.sourceKycComplete =
      out.kycComplete === true ||
      ["true", "1", "yes"].includes(String(out.kycComplete).toLowerCase());
    out.kycComplete = false;
    changes.push("Source verification claim retained for review");
  }
  const stateAliases: Record<string, string> = {
    abuja: "FCT",
    federalcapitalterritory: "FCT",
  };
  const stateKey = String(out.state || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (stateAliases[stateKey]) {
    out.state = stateAliases[stateKey];
    changes.push("Canonical FCT state name");
  }
  const knownLgaAliases: Record<string, Record<string, string>> = {
    Benue: { oturkpo: "Otukpo" },
    Adamawa: { larmurde: "Lamurde" },
    Kwara: { ekitikwarastate: "Ekiti" },
    FCT: {
      municipalareacouncil: "Municipal",
      abujamunicipal: "Municipal",
      abujamunicipalareacouncil: "Municipal",
      amac: "Municipal",
    },
  };
  const lgaKey = String(out.lga || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const stateName = String(out.state || "");
  const aliasGroup = Object.entries(knownLgaAliases).find(
    ([key]) => key.toLowerCase() === stateName.toLowerCase(),
  )?.[1];
  if (aliasGroup?.[lgaKey]) {
    out.lga = aliasGroup[lgaKey];
    changes.push("Applied reviewed LGA spelling alias");
  }
  if (
    out.irrigation &&
    String(out.irrigation)
      .toLowerCase()
      .replace(/[^a-z]/g, "") === "rainfed"
  ) {
    out.irrigation = "Rain-fed";
    changes.push("Canonical rain-fed irrigation label");
  }
  if (out.marital && String(out.marital).toLowerCase() === "divorce") {
    out.marital = "Divorced";
    changes.push("Canonical divorced marital status");
  }
  if (out.registrationDate && /^\d{4}$/.test(String(out.registrationDate))) {
    out.registrationYear = Number(out.registrationDate);
    out.sourceRegistrationDate = String(out.registrationDate);
    delete out.registrationDate;
    changes.push(
      "Year-only registration retained as a year, not an invented day",
    );
  }
  if (out.dob && /^\d{1,2}-[A-Za-z]{3}-\d{2}$/.test(String(out.dob))) {
    out.sourceDob = out.dob;
    out.dobStatus = "Needs century confirmation";
    delete out.dob;
    changes.push("Ambiguous two-digit birth year retained for confirmation");
  }
  if (out.profileStatus) {
    out.sourceProfileStatus = out.profileStatus;
    out.profileStatus = "Pending";
  }
  out.country ||= "Nigeria";
  out.gender ||= "Other";
  out.profileStatus ||= "Pending";
  return { data: out, changes };
}
export async function parseUpload(
  file: File,
): Promise<{
  sheets: { name: string; headers: string[]; rows: Record<string, any>[] }[];
  encoding: string;
}> {
  if (file.size > 100 * 1024 * 1024)
    throw new Error(
      "Use files under 100 MB; split larger registers into separate files.",
    );
  const ext = file.name.split(".").pop()?.toLowerCase();
  let bytes = new Uint8Array(await file.arrayBuffer());
  let actual = file.name;
  let encoding = "UTF-8";
  if (ext === "zip") {
    const { unzipSync } = await import("fflate");
    const files = unzipSync(bytes, {
      filter: (entry) => {
        if (entry.originalSize > 150 * 1024 * 1024)
          throw new Error("ZIP entry exceeds the 150 MB uncompressed limit");
        return (
          /\.(csv|xlsx|xls)$/i.test(entry.name) &&
          !entry.name.startsWith("__MACOSX/")
        );
      },
    });
    const entries = Object.entries(files);
    if (entries.length !== 1)
      throw new Error(
        "Upload a ZIP containing exactly one CSV or Excel register.",
      );
    actual = entries[0][0];
    bytes = entries[0][1];
  }
  if (/\.csv$/i.test(actual)) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
      encoding = "Windows-1252";
    }
    const Papa = await import("papaparse");
    const parsed = Papa.default.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
    });
    if (parsed.errors.length)
      throw new Error(
        `CSV row ${parsed.errors[0].row ?? "?"}: ${parsed.errors[0].message}`,
      );
    const headers = parsed.meta.fields || [];
    if (new Set(headers.map(normalizeHeader)).size !== headers.length)
      throw new Error("CSV headers must be unique after normalization");
    return { encoding, sheets: [{ name: actual, headers, rows: parsed.data }] };
  }
  if (!/\.(xlsx|xls)$/i.test(actual))
    throw new Error("Choose CSV, XLSX, XLS, or a ZIP containing one register");
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      cellText: true,
    });
    return {
      encoding: "Excel",
      sheets: wb.SheetNames.map((name) => {
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(
          wb.Sheets[name],
          { defval: "", raw: false, dateNF: "yyyy-mm-dd" },
        );
        return { name, headers: Object.keys(rows[0] || {}), rows };
      }),
    };
  } catch {
    throw new Error(
      "Excel workbook is incomplete, damaged or unsupported. Re-save it as a new XLSX or export its sheets to UTF-8 CSV and upload again. The original file has not been changed.",
    );
  }
}
