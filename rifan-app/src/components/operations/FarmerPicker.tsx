import React, { useEffect, useState } from "react";
import { api } from "../../lib/workspace";
import { names, type Row } from "../../model";
export default function FarmerPicker({
  id,
  value,
  onChange,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [q, setQ] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null>(null);
  useEffect(() => {
    if (value)
      api<Row>("/api/farmers/" + value)
        .then(setSelected)
        .catch(() => {});
  }, [value]);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => {
      api("/api/farmers?limit=25&q=" + encodeURIComponent(q), {
        signal: c.signal,
      })
        .then((r) => setRows(r.rows))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q]);
  const options =
    selected && !rows.some((r) => r.id === selected.id)
      ? [selected, ...rows]
      : rows;
  return (
    <span className="farmer-picker">
      <input
        aria-label="Find farmer by name or member ID"
        placeholder="Search the full farmer registry…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        id={id}
        required={required}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a farmer</option>
        {options.map((r) => (
          <option value={r.id} key={r.id}>
            {names(r)} · {r.farmerID}
          </option>
        ))}
      </select>
    </span>
  );
}
