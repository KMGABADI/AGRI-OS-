import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Warehouse, Wheat, Package, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "../lib/workspace";
import {
  PageHeading,
  StatCard,
  Badge,
  SearchBox,
  Empty,
} from "../components/ui";
import { format, canEdit, type Row } from "../model";
import { StockForm } from "./EntityPage";
export default function FoodBank() {
  const { snapshot, session } = useWorkspace();
  const [query, setQuery] = useState(""),
    [stock, setStock] = useState<Row | null>(null);
  const rows = snapshot.data.warehouses.filter((w) =>
    [w.name, w.state, w.commodity]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const capacity = rows.reduce((a, w) => a + Number(w.capacity || 0), 0),
    inventory = rows.reduce((a, w) => a + Number(w.currentInventory || 0), 0);
  return (
    <>
      <PageHeading
        title="Food bank"
        eyebrow="FROM LOCAL HARVEST TO NATIONAL RESILIENCE"
        description="Keep a shared picture of grain reserves and the storage network behind them."
        actions={
          <Link className="button primary" to="/warehouses">
            Manage storage <ArrowUpRight size={16} />
          </Link>
        }
      />
      <div className="stats-grid three">
        <StatCard
          label="Grain in reserve"
          value={format(inventory) + " MT"}
          icon={Wheat}
        />
        <StatCard
          label="Storage capacity"
          value={format(capacity) + " MT"}
          icon={Warehouse}
        />
        <StatCard
          label="Capacity utilization"
          value={
            (capacity ? Math.round((inventory / capacity) * 100) : 0) + "%"
          }
          icon={Package}
          tone="gold"
        />
      </div>
      <div className="table-toolbar no-panel">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Find a warehouse, chapter or commodity…"
        />
      </div>
      <div className="warehouse-grid">
        {rows.map((w) => (
          <article className="panel warehouse-card" key={w.id}>
            <div className="warehouse-card-top">
              <span className="stat-icon green">
                <Warehouse size={25} />
              </span>
              <Badge>{w.status}</Badge>
            </div>
            <small>{w.state || "Location not recorded"}</small>
            <h2>{w.name}</h2>
            <p>
              {w.commodity} · Managed by {w.manager || "Unassigned"}
            </p>
            <div className="warehouse-capacity">
              <strong>
                {format(w.currentInventory)} <span>MT in storage</span>
              </strong>
              <span>{format(w.capacity)} MT capacity</span>
            </div>
            <div className="bar-track">
              <span
                style={{
                  width:
                    Math.min(
                      100,
                      (Number(w.currentInventory || 0) / Number(w.capacity)) *
                        100,
                    ) + "%",
                }}
              />
            </div>
            <div className="warehouse-card-bottom">
              <span>
                {format(w.capacity - w.currentInventory)} MT available
              </span>
              {canEdit(session.role, "warehouses") && (
                <button className="text-link" onClick={() => setStock(w)}>
                  Record movement <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title="Your storage network starts here"
          description="Add a warehouse to begin tracking reserves."
        />
      )}
      {stock && <StockForm warehouse={stock} onClose={() => setStock(null)} />}
    </>
  );
}
