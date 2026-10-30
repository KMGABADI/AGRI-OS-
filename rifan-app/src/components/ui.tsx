import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import type { Row, Field, Entity } from "../model";
import { names } from "../model";
import { NIGERIA_STATES } from "../lib/nigeriaData";
import { COUNTRIES_REGIONS } from "../lib/crossBorderData";
import { useWorkspace } from "../lib/workspace";
import FarmerPicker from "./operations/FarmerPicker";
export function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  const text = String(children);
  return (
    <span
      className={`badge ${tone || (["Active", "Completed", "Valid", "Verified", "Resolved", "Connected"].includes(text) ? "green" : ["Pending", "Planned", "Medium", "In Progress"].includes(text) ? "gold" : ["Suspended", "High", "Invalid", "Closed"].includes(text) ? "red" : "neutral")}`}
    >
      {children}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>
          {title}
          <span className="gold-dot">.</span>
        </h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Add your first record to get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">✧</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = () =>
      ref.current
        ?.querySelector<HTMLElement>("input,select,textarea,button")
        ?.focus();
    focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) || [],
        ).filter((el) => el.offsetParent !== null);
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <p>{description}</p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={pending}
          className="button danger"
          onClick={async () => {
            setPending(true);
            try {
              await onConfirm();
              onClose();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Removing…" : "Remove record"}
        </button>
      </div>
    </Modal>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export type Column = {
  key: string;
  label: React.ReactNode;
  render?: (r: Row) => React.ReactNode;
};
export function DataTable({
  rows,
  columns,
  onRow,
  empty = "No matching records",
  pageSize = 10,
}: {
  rows: Row[];
  columns: Column[];
  onRow?: (r: Row) => void;
  empty?: string;
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((current - 1) * pageSize, current * pageSize)
              .map((r) => (
                <tr key={r.id}>
                  {columns.map((c, i) => (
                    <td key={c.key}>
                      {onRow && i === (columns[0]?.key === "select" ? 1 : 0) ? (
                        <button className="table-link" onClick={() => onRow(r)}>
                          {c.render ? c.render(r) : r[c.key] || "—"}
                        </button>
                      ) : c.render ? (
                        c.render(r)
                      ) : (
                        (r[c.key] ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <Empty
          title={empty}
          description="Try another filter or add a record."
        />
      )}
      <div className="table-footer">
        <span>
          {rows.length
            ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, rows.length)} of ${rows.length}`
            : "0 records"}
        </span>
        <div>
          <button
            className="icon-button"
            disabled={current <= 1}
            aria-label="Previous page"
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            Page {current} of {pages}
          </span>
          <button
            className="icon-button"
            disabled={current >= pages}
            aria-label="Next page"
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string | number;
  note?: string;
  icon: any;
  tone?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </div>
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function RecordForm({
  entity,
  fields,
  initial = {},
  onSave,
  onClose,
  title,
}: {
  entity: Entity;
  fields: Field[];
  initial?: Partial<Row>;
  onSave: (r: Partial<Row>) => Promise<any>;
  onClose: () => void;
  title: string;
}) {
  const { snapshot } = useWorkspace();
  const [values, setValues] = useState<Record<string, any>>({
      country: "Nigeria",
      profileStatus: "Pending",
      status: "Active",
      ...initial,
    }),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [step, setStep] = useState(0);
  const grouped = entity === "farmers";
  let group = "Details";
  const groups: Record<string, Field[]> = {};
  for (const f of fields) {
    if (f.group) group = f.group;
    (groups[group] ??= []).push(f);
  }
  const groupNames = Object.keys(groups);
  const visible = grouped ? groups[groupNames[step]] : fields;
  const set = (key: string, value: any) =>
    setValues((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "country"
        ? { state: "", lga: "" }
        : key === "state"
          ? { lga: "" }
          : {}),
      ...(key === "organizationId"
        ? {
            programId: "",
            seasonId: "",
            interventionId: "",
            warehouseId: "",
            locationId: "",
          }
        : {}),
      ...(key === "programId"
        ? { seasonId: "", interventionId: "", locationId: "", warehouseId: "" }
        : {}),
      ...(key === "seasonId"
        ? { interventionId: "", locationId: "", warehouseId: "" }
        : {}),
    }));
  const field = (f: Field) => {
    let options: { value: string; label: string }[] = (f.options || []).map(
      (s) => ({ value: s, label: s }),
    );
    const refs: Record<string, Entity> = {
      organizationId: "organizations",
      programId: "programs",
      farmerId: "farmers",
      warehouseId: "warehouses",
      seasonId: "seasons",
      interventionId: "interventions",
      locationId: "farmLocations",
    };
    if (refs[f.key])
      options = snapshot.data[refs[f.key]]
        .filter(
          (r) =>
            f.key !== "programId" ||
            !values.organizationId ||
            r.organizationId === values.organizationId,
        )
        .map((r) => ({ value: r.id, label: r.name || names(r) }));
    if (
      refs[f.key] &&
      ["seasonId", "interventionId", "locationId", "warehouseId"].includes(
        f.key,
      )
    )
      options = options.filter((o) => {
        const r = snapshot.data[refs[f.key]].find((r) => r.id === o.value)!;
        return (
          (f.key !== "seasonId" ||
            !values.programId ||
            r.programId === values.programId) &&
          (f.key !== "interventionId" ||
            (!r.farmerId &&
              (!values.programId || r.programId === values.programId) &&
              (!values.seasonId || r.seasonId === values.seasonId))) &&
          (f.key !== "locationId" ||
            ((!values.farmerId || r.farmerId === values.farmerId) &&
              (!values.seasonId || r.seasonId === values.seasonId))) &&
          (f.key !== "warehouseId" ||
            !values.seasonId ||
            !snapshot.data.seasons.find((s) => s.id === values.seasonId)
              ?.warehouseIds?.length ||
            snapshot.data.seasons
              .find((s) => s.id === values.seasonId)
              ?.warehouseIds.includes(r.id))
        );
      });
    if (
      f.key === "state" &&
      ["farmers", "farmLocations", "fieldValidations"].includes(entity)
    )
      options = Object.keys(
        COUNTRIES_REGIONS[values.country || "Nigeria"] || NIGERIA_STATES,
      ).map((s) => ({ value: s, label: s }));
    if (
      f.key === "lga" &&
      ["farmers", "farmLocations", "fieldValidations"].includes(entity)
    )
      options = (
        COUNTRIES_REGIONS[values.country || "Nigeria"]?.[values.state] || []
      ).map((s) => ({ value: s, label: s }));
    if (f.type === "multiselect") {
      const selected = Array.isArray(values[f.key])
        ? values[f.key]
        : String(values[f.key] || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
      const list =
        f.key === "states"
          ? Object.keys(NIGERIA_STATES).map((name) => ({
              value: name,
              label: name,
            }))
          : f.key === "warehouseIds"
            ? snapshot.data.warehouses.map((w) => ({
                value: w.id,
                label: w.name,
              }))
            : options;
      return (
        <fieldset className="field full checkbox-fieldset" key={f.key}>
          <legend>{f.label}</legend>
          <div className="checkbox-grid">
            {list.map((o) => (
              <label key={o.value}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={(e) =>
                    set(
                      f.key,
                      e.target.checked
                        ? [...selected, o.value]
                        : selected.filter((v: string) => v !== o.value),
                    )
                  }
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    const id = "field-" + f.key;
    const common = {
      id,
      name: f.key,
      required: f.required,
      value: values[f.key] ?? "",
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => set(f.key, e.target.value),
    };
    return (
      <label
        className={`field ${f.type === "textarea" ? "full" : ""} ${f.type === "checkbox" ? "check-field" : ""}`}
        key={f.key}
        htmlFor={id}
      >
        <span>
          {f.label}
          {f.required && <b> *</b>}
        </span>
        {f.key === "farmerId" ? (
          <FarmerPicker
            id={id}
            value={values.farmerId || ""}
            onChange={(v) => set("farmerId", v)}
            required={f.required}
          />
        ) : f.type === "checkbox" ? (
          <input
            id={id}
            type="checkbox"
            checked={!!values[f.key]}
            onChange={(e) => set(f.key, e.target.checked)}
          />
        ) : f.type === "textarea" ? (
          <textarea {...common} rows={3} />
        ) : f.type === "select" || options.length > 0 ? (
          <select {...common}>
            <option value="">Select {f.label.toLowerCase()}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            type={f.type || "text"}
            min={f.min}
            max={f.max}
            step={f.type === "number" ? "any" : undefined}
          />
        )}
      </label>
    );
  };
  return (
    <Modal title={title} onClose={onClose} wide={grouped}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (grouped && step < groupNames.length - 1) {
            setStep((n) => n + 1);
            return;
          }
          setPending(true);
          setError("");
          try {
            const out = { ...values };
            fields
              .filter((f) => f.type === "number")
              .forEach((f) => {
                if (out[f.key] === "") delete out[f.key];
                else if (out[f.key] !== undefined)
                  out[f.key] = Number(out[f.key]);
              });
            await onSave({
              ...out,
              ...(initial.id
                ? {
                    expectedUpdatedAt:
                      initial.updatedAt || initial.createdAt || "",
                  }
                : {}),
            });
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setPending(false);
          }
        }}
      >
        {grouped && (
          <div className="form-steps">
            {groupNames.map((g, i) => (
              <button
                type="button"
                className={i === step ? "active" : ""}
                key={g}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                {g.split(" & ")[0]}
              </button>
            ))}
          </div>
        )}
        {grouped && <h3 className="form-section-title">{groupNames[step]}</h3>}
        {["farmLocations", "fieldValidations"].includes(entity) && (
          <div className="field-capture-toolbar">
            <button
              type="button"
              className="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  setError("GPS capture is unavailable on this device");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) =>
                    setValues((v) => ({
                      ...v,
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      gpsAccuracy: position.coords.accuracy,
                      captureMethod: "Device GPS",
                    })),
                  (e) => setError(e.message),
                  { enableHighAccuracy: true, timeout: 15000 },
                );
              }}
            >
              Capture device GPS
            </button>
            <label className="button">
              Upload surveyed boundary
              <input
                className="visually-hidden"
                type="file"
                accept=".geojson,.json,.kml,.gpx,.zip"
                onChange={async (e) => {
                  if (e.target.files?.[0])
                    try {
                      const { parseBoundary } = await import("../lib/geodata");
                      setValues((v) => ({ ...v, farmBoundary: null }));
                      const boundary = await parseBoundary(e.target.files[0]);
                      setValues((v) => ({ ...v, farmBoundary: boundary }));
                    } catch (err: any) {
                      setError(err.message);
                    }
                }}
              />
            </label>
            {values.farmBoundary && <Badge>Boundary attached</Badge>}
            {values.gpsAccuracy && (
              <small>
                GPS accuracy: {Math.round(values.gpsAccuracy)} metres
              </small>
            )}
          </div>
        )}
        <div className="form-grid">{visible.map(field)}</div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button"
            onClick={step > 0 ? () => setStep((n) => n - 1) : onClose}
          >
            {step > 0 ? "Back" : "Cancel"}
          </button>
          <button disabled={pending} className="button primary" type="submit">
            {pending ? (
              <>
                <LoaderCircle className="spin" size={15} />
                Saving…
              </>
            ) : grouped && step < groupNames.length - 1 ? (
              "Continue"
            ) : (
              "Save record"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
