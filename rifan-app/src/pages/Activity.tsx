import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useWorkspace } from "../lib/workspace";
import {
  PageHeading,
  DataTable,
  Badge,
  SearchBox,
  Empty,
} from "../components/ui";
export default function Activity() {
  const { snapshot, session } = useWorkspace();
  const [query, setQuery] = useState("");
  if (!["Super Admin", "Admin", "Manager"].includes(session.role))
    return (
      <Empty
        title="Access restricted"
        description="Audit history is available to managers and administrators."
      />
    );
  return (
    <>
      <PageHeading
        title="Audit trail"
        eyebrow="ACCOUNTABILITY AT EVERY STEP"
        description="A permanent record of who changed what, and when. Identity values are withheld from event details."
      />
      <section className="panel">
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search actions, team members or events…"
          />
          <Badge tone="neutral">Latest 300 events</Badge>
        </div>
        <DataTable
          rows={snapshot.activity.filter((r) =>
            JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
          )}
          columns={[
            {
              key: "timestamp",
              label: "When",
              render: (r) =>
                new Date(r.timestamp).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
            },
            { key: "userName", label: "Team member" },
            {
              key: "action",
              label: "Action",
              render: (r) => <Badge tone="neutral">{r.action}</Badge>,
            },
            { key: "entity", label: "Module" },
            { key: "details", label: "Event details" },
          ]}
        />
      </section>
    </>
  );
}
