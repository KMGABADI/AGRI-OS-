import React, { useState } from "react";
import { Modal, DataTable, Badge } from "../ui";
import { api, useWorkspace } from "../../lib/workspace";
import type { Row } from "../../model";
import StagedFilters from "./StagedFilters";
export default function BulkBeneficiaries({
  intervention,
  onClose,
}: {
  intervention: Row;
  onClose: () => void;
}) {
  const { snapshot, refresh, notify } = useWorkspace();
  const [filters, setFilters] = useState<Record<string, any>>({}),
    [preview, setPreview] = useState<any>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  const program = snapshot.data.programs.find(
      (p) => p.id === intervention.programId,
    ),
    season = snapshot.data.seasons.find((s) => s.id === intervention.seasonId);
  return (
    <Modal wide title="Assign beneficiaries in bulk" onClose={onClose}>
      <div className="cohort-target">
        <Badge tone="green">{program?.name || "Programme"}</Badge> →{" "}
        <Badge tone="gold">{season?.name || "Season"}</Badge> →{" "}
        <strong>{intervention.name}</strong>
      </div>
      <p>
        Choose a cohort by crop, previous season/programme participation,
        geography, cooperative, or approved field evidence. The complete
        matching cohort is frozen for review; farmers are not added one by one.
      </p>
      <StagedFilters
        value={filters}
        onChange={(v) => {
          setFilters(v);
          setPreview(null);
        }}
        includeFarmerCriteria
      />
      <label className="field">
        <span>Imported season / phase (optional exact value)</span>
        <input
          value={filters.legacyPhase || ""}
          onChange={(e) => {
            setFilters({ ...filters, legacyPhase: e.target.value });
            setPreview(null);
          }}
        />
      </label>
      <label className="toggle-row">
        <span>Only farmers with manager-approved field validation</span>
        <input
          type="checkbox"
          checked={!!filters.fieldValidated}
          onChange={(e) => {
            setFilters({
              ...filters,
              fieldValidated: e.target.checked,
              validationSeasonId: intervention.seasonId,
            });
            setPreview(null);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {preview && (
        <>
          <div className="import-outcomes">
            <span>{preview.matched.toLocaleString()} matched</span>
            <span>{preview.eligible.toLocaleString()} eligible</span>
            <span>{preview.duplicates.toLocaleString()} already enrolled</span>
          </div>
          <DataTable
            rows={preview.sample}
            columns={[
              { key: "name", label: "Preview sample" },
              { key: "farmerID", label: "Member ID" },
              { key: "state", label: "State" },
              { key: "crop", label: "Crop" },
            ]}
          />
          <p className="small-text muted">
            Sample only; confirmation processes every eligible farmer in safe
            batches of 500. Membership in earlier programmes or seasons is
            preserved.
          </p>
        </>
      )}
      {progress && <p role="status">{progress}</p>}
      <div className="form-actions">
        <button className="button" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              if (!preview) {
                setPreview(
                  await api("/api/operations/cohorts/preview", {
                    method: "POST",
                    body: JSON.stringify({
                      target: {
                        programId: intervention.programId,
                        seasonId: intervention.seasonId,
                        interventionId: intervention.id,
                        warehouseId: intervention.warehouseId || "",
                      },
                      filters,
                    }),
                  }),
                );
              } else {
                let remaining = 1,
                  total = 0;
                while (remaining) {
                  const r = await api(
                    "/api/operations/cohorts/" + preview.jobId + "/commit",
                    { method: "POST" },
                  );
                  total += r.enrolled;
                  remaining = r.remaining;
                  setProgress(
                    `${total.toLocaleString()} assigned; ${remaining.toLocaleString()} remaining`,
                  );
                }
                await refresh();
                notify(`${total.toLocaleString()} beneficiaries assigned`);
                onClose();
              }
            } catch (e: any) {
              setError(e.message);
            } finally {
              setPending(false);
            }
          }}
        >
          {pending
            ? "Processing…"
            : preview
              ? "Confirm full cohort"
              : "Preview matching cohort"}
        </button>
      </div>
    </Modal>
  );
}
