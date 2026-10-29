import React, { useState } from "react";
import { Link,useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Warehouse,
  Target,
  CheckCircle2,
  Activity,
  ArrowDownUp,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  DataTable,
  RecordForm,
  Badge,
  SearchBox,
  Confirm,
  StatCard,
  Modal,
  type Column,
} from "../components/ui";
import {
  type Entity,
  type Row,
  entityFields,
  canEdit,
  format,
  names,
} from "../model";
const configs: Record<
  string,
  {
    title: string;
    eyebrow: string;
    description: string;
    singular: string;
    columns: Column[];
  }
> = {
  organizations: {
    title: "Cooperatives & partners",
    eyebrow: "STRONGER CONNECTIONS",
    description:
      "Bring chapters, cooperatives and partners into one coordinated network.",
    singular: "organization",
    columns: [
      {
        key: "name",
        label: "Organization",
        render: (r) => (
          <span className="two-lines">
            <strong>{r.name}</strong>
            <small>{r.type}</small>
          </span>
        ),
      },
      { key: "region", label: "Region" },
      { key: "states", label: "Coverage", render:r=>Array.isArray(r.states)?r.states.join(", "):r.states||"—" },
      { key: "contactPerson", label: "Contact person" },
      { key: "contactPhone", label: "Phone" },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge>{r.status}</Badge>,
      },
    ],
  },
  programs: {
    title: "Programmes",
    eyebrow: "A PLAN FOR EVERY SEASON",
    description:
      "Coordinate programme delivery, partnerships and beneficiary targets.",
    singular: "programme",
    columns: [
      { key: "name", label: "Programme" },
      { key: "startDate", label: "Start date" },
      { key: "endDate", label: "End date" },
      { key: "target", label: "Target members" },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge>{r.status}</Badge>,
      },
    ],
  },
  warehouses: {
    title: "Warehouses",
    eyebrow: "SAFE STORAGE. SECURE SUPPLY.",
    description:
      "Know where your grain is stored, and how much capacity remains.",
    singular: "warehouse",
    columns: [
      {
        key: "name",
        label: "Storage facility",
        render: (r) => (
          <span className="two-lines">
            <strong>{r.name}</strong>
            <small>{r.state}</small>
          </span>
        ),
      },
      { key: "commodity", label: "Commodity" },
      {
        key: "capacity",
        label: "Capacity",
        render: (r) => format(r.capacity) + " MT",
      },
      {
        key: "currentInventory",
        label: "Inventory",
        render: (r) => (
          <div className="inventory-cell">
            <span>{format(r.currentInventory)} MT</span>
            <div className="bar-track">
              <span
                style={{
                  width:
                    Math.min(
                      100,
                      ((r.currentInventory || 0) / r.capacity) * 100,
                    ) + "%",
                }}
              />
            </div>
          </div>
        ),
      },
      { key: "manager", label: "Manager" },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge>{r.status}</Badge>,
      },
    ],
  },
  interventions: {
    title: "Programmes & impact",
    eyebrow: "TURNING SUPPORT INTO PROGRESS",
    description:
      "Track field interventions, follow up delivery, and measure observed outcomes.",
    singular: "intervention",
    columns: [
      {
        key: "name",
        label: "Intervention",
        render: (r) => (
          <span className="two-lines">
            <strong>{r.name}</strong>
            <small>{r.type}</small>
          </span>
        ),
      },
      { key: "farmerId", label: "Beneficiary" },
      { key: "dateApplied", label: "Date" },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge>{r.status}</Badge>,
      },
      {
        key: "impactScore",
        label: "Impact",
        render: (r) =>
          r.impactScore !== undefined ? r.impactScore + "/100" : "Not assessed",
      },
    ],
  },
};
export default function EntityPage({ entity }: { entity: Entity }) {
  const { snapshot, session, save, remove } = useWorkspace();
  const navigate=useNavigate();
  const config = configs[entity];
  const rows = snapshot.data[entity];
  const [query, setQuery] = useState(""),
    [edit, setEdit] = useState<Partial<Row> | null>(null),
    [deleting, setDeleting] = useState<Row | null>(null),
    [stock, setStock] = useState<Row | null>(null);
  const writable = canEdit(session.role, entity);
  const columns = config.columns.map((c) =>
    c.key === "farmerId"
      ? {
          ...c,
          render: (r: Row) => {
            const f = snapshot.data.farmers.find((f) => f.id === r.farmerId);
            return f ? (
              <Link className="text-link" to={"/farmers/" + f.id}>
                {names(f)}
              </Link>
            ) : (
              "Unknown farmer"
            );
          },
        }
      : c,
  );
  if (writable)
    columns.push({
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="row-actions">
          {entity === "warehouses" && (
            <button
              title="Record stock movement"
              aria-label={"Record stock movement for " + r.name}
              className="icon-button"
              onClick={() => setStock(r)}
            >
              <ArrowDownUp size={16} />
            </button>
          )}
          <button
            title="Edit"
            aria-label={"Edit " + (r.name || "record")}
            className="icon-button"
            onClick={() => setEdit(r)}
          >
            <Pencil size={15} />
          </button>
          {["Super Admin", "Admin", "Manager"].includes(session.role) && (
            <button
              aria-label={"Delete " + (r.name || "record")}
              className="icon-button delete"
              onClick={() => setDeleting(r)}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    });
  const filtered = rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={config.title}
        eyebrow={config.eyebrow}
        description={config.description}
        actions={
          <>
            {entity === "interventions" && (
              <Link to="/programs" className="button">
                Manage programmes
              </Link>
            )}
            {writable && (
              <button className="button primary" onClick={() => setEdit({})}>
                <Plus size={17} />
                Add {config.singular}
              </button>
            )}
          </>
        }
      />
      {entity === "interventions" && (
        <div className="stats-grid three">
          <StatCard
            label="Total interventions"
            value={rows.length}
            icon={Target}
          />
          <StatCard
            label="Completed"
            value={rows.filter((r) => r.status === "Completed").length}
            icon={CheckCircle2}
          />
          <StatCard
            label="Average observed impact"
            value={
              rows.some((r) => r.impactScore !== undefined)
                ? Math.round(
                    rows
                      .filter((r) => r.impactScore !== undefined)
                      .reduce((a, r) => a + r.impactScore, 0) /
                      rows.filter((r) => r.impactScore !== undefined).length,
                  ) + "/100"
                : "Not assessed"
            }
            note="Only assessed interventions are included"
            icon={Activity}
            tone="gold"
          />
        </div>
      )}
      {entity === "warehouses" && (
        <div className="stats-grid three">
          <StatCard
            label="Storage facilities"
            value={rows.length}
            icon={Warehouse}
          />
          <StatCard
            label="Total reserve"
            value={
              format(
                rows.reduce((a, r) => a + Number(r.currentInventory || 0), 0),
              ) + " MT"
            }
            icon={Warehouse}
          />
          <StatCard
            label="Available capacity"
            value={
              format(
                rows.reduce(
                  (a, r) =>
                    a +
                    Number(r.capacity || 0) -
                    Number(r.currentInventory || 0),
                  0,
                ),
              ) + " MT"
            }
            icon={Warehouse}
            tone="gold"
          />
        </div>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={"Search " + config.title.toLowerCase() + "…"}
          />
          <span className="muted small-text">{filtered.length} records</span>
        </div>
        <DataTable rows={filtered} columns={columns} onRow={r=>navigate("/records/"+entity+"/"+r.id)} />
      </section>
      {entity === "warehouses" && (
        <section className="panel section-spacing">
          <div className="panel-heading">
            <div>
              <h3>Stock movement ledger</h3>
              <p>
                Receipts and dispatches are recorded against warehouse capacity.
              </p>
            </div>
          </div>
          <DataTable
            rows={snapshot.data.movements}
            columns={[
              {
                key: "date",
                label: "Date",
                render: (r) => new Date(r.date).toLocaleDateString("en-NG"),
              },
              {
                key: "warehouseId",
                label: "Warehouse",
                render: (r) =>
                  rows.find((w) => w.id === r.warehouseId)?.name || "Unknown",
              },
              {
                key: "type",
                label: "Movement",
                render: (r) => <Badge>{r.type}</Badge>,
              },
              { key: "quantity", label: "Quantity (MT)" },
              { key: "reference", label: "Reference" },
            ]}
          />
        </section>
      )}
      {edit && (
        <RecordForm
          entity={entity}
          fields={entityFields[entity] || []}
          initial={edit}
          title={`${edit.id ? "Edit" : "Add"} ${config.singular}`}
          onSave={(r) => save(entity, r)}
          onClose={() => setEdit(null)}
        />
      )}
      {deleting && (
        <Confirm
          title={"Remove " + config.singular + "?"}
          description="Related records must be reassigned before removal. This action is recorded in your audit trail."
          onConfirm={() => remove(entity, deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
      {stock && <StockForm warehouse={stock} onClose={() => setStock(null)} />}
    </>
  );
}
export function StockForm({
  warehouse,
  onClose,
}: {
  warehouse: Row;
  onClose: () => void;
}) {
  const { refresh, notify } = useWorkspace();
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <Modal title="Record stock movement" onClose={onClose}>
      <p>
        <strong>{warehouse.name}</strong> · {format(warehouse.currentInventory)}{" "}
        / {format(warehouse.capacity)} MT
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError("");
          try {
            const values = Object.fromEntries(new FormData(e.currentTarget));
            await api("/api/stock", {
              method: "POST",
              body: JSON.stringify({ ...values, warehouseId: warehouse.id }),
            });
            await refresh();
            notify("Stock movement recorded");
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span>Movement</span>
            <select name="type">
              <option>Receipt</option>
              <option>Dispatch</option>
            </select>
          </label>
          <label className="field">
            <span>Quantity (MT)</span>
            <input
              name="quantity"
              type="number"
              step="any"
              min="0.001"
              required
            />
          </label>
          <label className="field full">
            <span>Reference / destination</span>
            <input name="reference" required />
          </label>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? "Recording…" : "Record movement"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
