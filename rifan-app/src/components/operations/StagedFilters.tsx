import React from "react";
import { useWorkspace } from "../../lib/workspace";
import { NIGERIA_STATES } from "../../lib/nigeriaData";
export type Filters = Record<string, any>;
export default function StagedFilters({
  value,
  onChange,
  includeFarmerCriteria = false,
}: {
  value: Filters;
  onChange: (v: Filters) => void;
  includeFarmerCriteria?: boolean;
}) {
  const { snapshot } = useWorkspace();
  const d = snapshot.data;
  const set = (key: string, next: string) => {
    const out = { ...value, [key]: next };
    const depend: Record<string, string[]> = {
      organizationId: [
        "programId",
        "seasonId",
        "interventionId",
        "warehouseId",
      ],
      programId: ["seasonId", "interventionId", "warehouseId"],
      seasonId: ["interventionId", "warehouseId"],
      state: ["lga"],
    };
    for (const dep of depend[key] || []) delete out[dep];
    onChange(out);
  };
  const choices = [
    ["organizationId", "Organization", d.organizations],
    [
      "programId",
      "Programme",
      d.programs.filter(
        (p) =>
          !value.organizationId || p.organizationId === value.organizationId,
      ),
    ],
    [
      "seasonId",
      "Season",
      d.seasons.filter(
        (p) => !value.programId || p.programId === value.programId,
      ),
    ],
    [
      "interventionId",
      "Intervention",
      d.interventions.filter(
        (p) =>
          !p.farmerId &&
          (!value.programId || p.programId === value.programId) &&
          (!value.seasonId || p.seasonId === value.seasonId),
      ),
    ],
  ] as const;
  return (
    <div className="staged-filters">
      {choices.map(([key, label, rows]) => (
        <label className="field" key={key}>
          <span>{label}</span>
          <select
            aria-label={"Filter " + label.toLowerCase()}
            value={value[key] || ""}
            onChange={(e) => set(key, e.target.value)}
          >
            <option value="">All {label.toLowerCase()}s</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      {includeFarmerCriteria && (
        <>
          <label className="field">
            <span>Crop</span>
            <select
              value={value.crop || ""}
              onChange={(e) => set("crop", e.target.value)}
            >
              <option value="">All crops</option>
              {[
                "Rice",
                "Maize",
                "Cassava",
                "Sorghum",
                "Millet",
                "Soybean",
                "Yam",
                "Vegetables",
                "Cotton",
                "Groundnut",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>State</span>
            <select
              value={value.state || ""}
              onChange={(e) => set("state", e.target.value)}
            >
              <option value="">All states</option>
              {Object.keys(NIGERIA_STATES).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>LGA</span>
            <select
              value={value.lga || ""}
              onChange={(e) => set("lga", e.target.value)}
            >
              <option value="">All LGAs</option>
              {(NIGERIA_STATES[value.state] || []).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
