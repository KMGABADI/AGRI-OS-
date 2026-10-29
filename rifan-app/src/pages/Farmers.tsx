import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Plus,
  Download,
  Upload,
  Printer,
  FileBadge,
  Users,
  ShieldCheck,
  SlidersHorizontal,
  MapPin,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  StatCard,
  DataTable,
  Badge,
  SearchBox,
  RecordForm,
  Modal,
} from "../components/ui";
import { canEdit, farmerFields, format, names } from "../model";
import { printCards, exportCards, cardMembers } from "../lib/id-cards";
import { exportRows } from "../lib/export";
export default function Farmers() {
  const { snapshot, session, save, notify } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(""),
    [state, setState] = useState(""),
    [status, setStatus] = useState(""),
    [gender, setGender] = useState(""),
    [org, setOrg] = useState(""),
    [more, setMore] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    [cardBusy, setCardBusy] = useState(false);
  const navigate = useNavigate();
  const [remote, setRemote] = useState<{ rows: any[]; total: number }>({
      rows: [],
      total: 0,
    }),
    [offset, setOffset] = useState(0),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    setOffset(0);
  }, [query, state, status, gender, org]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        q: query,
        state,
        profileStatus: status,
        gender,
        organizationId: org,
        limit: "25",
        offset: String(offset),
      });
      api("/api/farmers?" + params, { signal: controller.signal })
        .then(setRemote)
        .catch((e) => {
          if (e.name !== "AbortError") notify(e.message, true);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    query,
    state,
    status,
    gender,
    org,
    offset,
    snapshot.summary.totalFarmers,
  ]);
  const farmers = remote.rows;
  const filtered = farmers;
  const register = params.get("register") === "1";
  return (
    <>
      <PageHeading
        eyebrow="THE HEART OF OUR ASSOCIATION"
        title="Farmer registry"
        description="One reliable record for every farmer. Connected to every part of their journey."
        actions={
          <>
            <button className="button" onClick={() => setBatchOpen(true)}>
              <FileBadge size={16} />
              Prepare card batch
            </button>
            <button
              className="button"
              onClick={() =>
                exportRows("RIFAN-farmers", filtered).catch((e) =>
                  notify(e.message, true),
                )
              }
            >
              <Download size={16} />
              Export loaded page
            </button>
            {canEdit(session.role, "farmers") && (
              <button
                className="button primary"
                onClick={() => setParams({ register: "1" })}
              >
                <Plus size={17} />
                Register farmer
              </button>
            )}
          </>
        }
      />
      <div className="stats-grid three">
        <StatCard
          label="Total members"
          value={format(snapshot.summary.totalFarmers)}
          icon={Users}
          note="All registered farmer records"
        />
        <StatCard
          label="Verified identities"
          value={format(snapshot.summary.verified)}
          icon={ShieldCheck}
          note="Confirmed KYC status"
        />
        <StatCard
          label="Farm area on record"
          value={`${format(snapshot.summary.hectares)} ha`}
          icon={MapPin}
          note="Across all registered members"
          tone="gold"
        />
      </div>
      <section className="panel">
        {selected.length > 0 && (
          <div className="bulk-card-actions">
            <strong>{selected.length} selected</strong>
            <button
              className="button small-button"
              onClick={() => {
                try {
                  printCards(selected);
                } catch (e: any) {
                  notify(e.message, true);
                }
              }}
            >
              <Printer size={15} />
              Print cards
            </button>
            <button
              className="button small-button"
              disabled={cardBusy}
              onClick={async () => {
                setCardBusy(true);
                try {
                  await exportCards(
                    await cardMembers(selected),
                    snapshot.settings.logo,
                  );
                } catch (e: any) {
                  notify(e.message, true);
                } finally {
                  setCardBusy(false);
                }
              }}
            >
              <FileBadge size={15} />
              {cardBusy ? "Preparing…" : "Bulk PDF"}
            </button>
            <button
              className="button small-button"
              disabled={cardBusy}
              onClick={async () => {
                setCardBusy(true);
                try {
                  await exportCards(
                    await cardMembers(selected),
                    snapshot.settings.logo,
                    true,
                  );
                } catch (e: any) {
                  notify(e.message, true);
                } finally {
                  setCardBusy(false);
                }
              }}
            >
              <Download size={15} />
              Individual PDFs (ZIP)
            </button>
            <button className="text-button" onClick={() => setSelected([])}>
              Clear selection
            </button>
          </div>
        )}
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search name, member ID or phone…"
          />
          <div className="inline-filters">
            <select
              aria-label="Filter farmer state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">All states</option>
              {snapshot.summary.regions.map((r: any) => (
                <option key={r.name}>{r.name}</option>
              ))}
            </select>
            <select
              aria-label="Filter membership status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {["Active", "Pending", "Suspended"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button
              className={`button ${more ? "selected" : ""}`}
              onClick={() => setMore(!more)}
            >
              <SlidersHorizontal size={15} />
              Filters
            </button>
          </div>
        </div>
        {more && (
          <div className="extra-filters">
            <label className="field">
              <span>Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">All genders</option>
                {["Male", "Female", "Other"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cooperative</span>
              <select value={org} onChange={(e) => setOrg(e.target.value)}>
                <option value="">All cooperatives</option>
                {snapshot.data.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setState("");
                setStatus("");
                setGender("");
                setOrg("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        <DataTable
          pageSize={25}
          rows={filtered}
          onRow={(r) => navigate("/farmers/" + r.id)}
          columns={[
            {
              key: "select",
              label: (
                <input
                  type="checkbox"
                  aria-label="Select all farmers on this page"
                  checked={
                    filtered.length > 0 &&
                    filtered.every((f) => selected.includes(f.id))
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [
                            ...new Set([
                              ...selected,
                              ...filtered.map((f) => f.id),
                            ]),
                          ]
                        : selected.filter(
                            (id) => !filtered.some((f) => f.id === id),
                          ),
                    )
                  }
                />
              ),
              render: (f) => (
                <input
                  type="checkbox"
                  aria-label={"Select " + names(f)}
                  checked={selected.includes(f.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, f.id]
                        : selected.filter((id) => id !== f.id),
                    )
                  }
                />
              ),
            },
            {
              key: "name",
              label: "Farmer",
              render: (f) => (
                <span className="member-cell">
                  <span className="avatar small">
                    {f.firstName?.[0]}
                    {f.lastName?.[0]}
                  </span>
                  <span>
                    <strong>{names(f)}</strong>
                    <small>{f.farmerID}</small>
                  </span>
                </span>
              ),
            },
            {
              key: "state",
              label: "Location",
              render: (f) => (
                <span className="two-lines">
                  <span>{f.state}</span>
                  <small>{f.lga}</small>
                </span>
              ),
            },
            { key: "primaryPhone", label: "Phone" },
            {
              key: "farmSize",
              label: "Farm size",
              render: (f) =>
                f.farmSize !== undefined
                  ? format(f.farmSize) + " ha"
                  : "Not recorded",
            },
            { key: "crop", label: "Crop" },
            {
              key: "profileStatus",
              label: "Status",
              render: (f) => <Badge>{f.profileStatus}</Badge>,
            },
            {
              key: "kyc",
              label: "Verification",
              render: (f) => (
                <span className={f.kycComplete ? "verified-text" : "muted"}>
                  {f.kycComplete ? "✓ Verified" : "Pending KYC"}
                </span>
              ),
            },
          ]}
        />
        <div className="table-footer server-pagination">
          <span>
            {loading
              ? "Loading…"
              : `${offset + 1}–${Math.min(offset + 25, remote.total)} of ${remote.total.toLocaleString()} members`}
          </span>
          <div>
            <button
              className="button small-button"
              disabled={offset === 0 || loading}
              onClick={() => setOffset((v) => Math.max(0, v - 25))}
            >
              Previous
            </button>
            <button
              className="button small-button"
              disabled={offset + 25 >= remote.total || loading}
              onClick={() => setOffset((v) => v + 25)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <div className="info-strip">
        <Upload size={18} />
        <span>
          Have a spreadsheet of farmers? Import, validate and review records
          before they reach your database.
        </span>
        <Link to="/upload">Open data hub →</Link>
      </div>
      {batchOpen && (
        <Modal
          title="Prepare a farmer ID card batch"
          onClose={() => setBatchOpen(false)}
        >
          <p>
            Select a range from your current filtered registry. Prepare up to
            500 cards per batch; use the next range for larger registers.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCardBusy(true);
              const form = new FormData(e.currentTarget);
              try {
                const start = Math.max(1, Number(form.get("start")) || 1),
                  count = Math.min(500, Number(form.get("count")) || 100);
                const params = new URLSearchParams({
                  q: query,
                  state,
                  profileStatus: status,
                  gender,
                  organizationId: org,
                  limit: String(count),
                  offset: String(start - 1),
                });
                const page = await api("/api/farmers?" + params);
                setSelected(page.rows.map((r: any) => r.id));
                setBatchOpen(false);
                notify(
                  `${page.rows.length} members selected for card printing/export`,
                );
              } catch (e: any) {
                notify(e.message, true);
              } finally {
                setCardBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Start at record</span>
                <input
                  name="start"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                />
              </label>
              <label className="field">
                <span>Number of cards (maximum 500)</span>
                <input
                  name="count"
                  type="number"
                  min="1"
                  max="500"
                  defaultValue="100"
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="button"
                onClick={() => setBatchOpen(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={cardBusy}>
                Prepare selection
              </button>
            </div>
          </form>
        </Modal>
      )}
      {register && (
        <RecordForm
          entity="farmers"
          fields={farmerFields}
          title="Register a farmer"
          onSave={(r) => save("farmers", r)}
          onClose={() => setParams({})}
        />
      )}
    </>
  );
}
