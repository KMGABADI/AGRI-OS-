import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Wallet,
  Users,
  ShieldCheck,
  Plus,
  Globe,
  ArrowUpRight,
  Check,
  X,
  Receipt,
  Download,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import {
  PageHeading,
  StatCard,
  DataTable,
  Badge,
  Modal,
  SearchBox,
  Empty,
} from "../components/ui";
import { pdfImage } from "../lib/pdf-image";
import { pdfFont } from "../lib/pdf-font";
import { names, money, type Row } from "../model";
export default function Membership() {
  const { snapshot, session, refresh, notify } = useWorkspace();
  const [params] = useSearchParams();
  const [tab, setTab] = useState("Payments"),
    [payment, setPayment] = useState(false),
    [query, setQuery] = useState(""),
    [processing, setProcessing] = useState("");
  const d = snapshot.data;
  const filtered = d.payments.filter(
    (p) =>
      (!params.get("farmer") || p.farmerId === params.get("farmer")) &&
      [
        p.reference,
        names(d.farmers.find((f) => f.id === p.farmerId) || { id: "" }),
        p.type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const admin = ["Super Admin", "Admin"].includes(session.role),
    canRecord = admin || session.role === "Manager";
  const verify = async (row: Row, approve: boolean) => {
    setProcessing(row.id);
    try {
      await api("/api/membership/payments/" + row.id + "/verify", {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
      await refresh();
      notify(approve ? "Payment verified" : "Payment rejected");
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setProcessing("");
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="MEMBERSHIP THAT MEANS MORE"
        title="Members & fees"
        description="A clear view of applications, fee obligations, and verified membership payments."
        actions={
          canRecord && (
            <button className="button primary" onClick={() => setPayment(true)}>
              <Plus size={16} />
              Record payment
            </button>
          )
        }
      />
      <div className="stats-grid">
        <StatCard
          label="Registered members"
          value={snapshot.summary.totalFarmers}
          icon={Users}
        />
        <StatCard
          label="Verified collections"
          value={money(
            d.payments
              .filter((p) => p.status === "Verified")
              .reduce((a, p) => a + p.amount, 0),
          )}
          note="Only verified ledger entries"
          icon={Wallet}
        />
        <StatCard
          label="Awaiting verification"
          value={
            d.payments.filter((p) => p.status === "Pending verification").length
          }
          icon={ShieldCheck}
          tone="gold"
        />
        <StatCard
          label="Applications to review"
          value={
            d.applications.filter((a) =>
              ["Submitted", "Needs information"].includes(a.status),
            ).length
          }
          icon={Receipt}
          tone="gold"
        />
      </div>
      <div className="fee-summary">
        <div>
          <small>REGISTRATION FEE</small>
          <strong>
            {Number(snapshot.settings.registrationFee) > 0
              ? money(snapshot.settings.registrationFee)
              : "Not configured"}
          </strong>
        </div>
        <div>
          <small>MEMBERSHIP FEE</small>
          <strong>
            {Number(snapshot.settings.membershipFee) > 0
              ? money(snapshot.settings.membershipFee)
              : "Not configured"}{" "}
            <span>{snapshot.settings.membershipCycle}</span>
          </strong>
        </div>
        <Link to="/settings">
          Manage fee schedule <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="tabs">
        {["Payments", "Applications", "Member status", "Farmer website"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {tab === "Payments" && (
        <section className="panel">
          <div className="table-toolbar">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search payment reference or member…"
            />
            <span className="small-text muted">NGN · Verified ledger</span>
          </div>
          <DataTable
            rows={filtered}
            columns={[
              {
                key: "reference",
                label: "Reference",
                render: (r) => (
                  <span className="two-lines">
                    <strong>{r.reference}</strong>
                    <small>
                      {new Date(r.date).toLocaleDateString("en-NG", {
                        timeZone: "Africa/Lagos",
                      })}
                    </small>
                  </span>
                ),
              },
              {
                key: "farmerId",
                label: "Member",
                render: (r) => {
                  const f = d.farmers.find((f) => f.id === r.farmerId);
                  return f ? (
                    <Link className="text-link" to={"/farmers/" + f.id}>
                      {names(f)}
                    </Link>
                  ) : (
                    "Member unavailable"
                  );
                },
              },
              {
                key: "type",
                label: "Fee type",
                render: (r) => r.type + " · " + r.period,
              },
              {
                key: "amount",
                label: "Amount",
                render: (r) => money(r.amount),
              },
              { key: "method", label: "Method" },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge>{r.status}</Badge>,
              },
              {
                key: "actions",
                label: "Review",
                render: (r) => (
                  <div className="row-actions">
                    {admin && r.status === "Pending verification" && (
                      <>
                        <button
                          disabled={processing === r.id}
                          className="icon-button"
                          aria-label={"Verify payment " + r.reference}
                          onClick={() => verify(r, true)}
                        >
                          <Check size={17} />
                        </button>
                        <button
                          disabled={processing === r.id}
                          className="icon-button delete"
                          aria-label={"Reject payment " + r.reference}
                          onClick={() => verify(r, false)}
                        >
                          <X size={17} />
                        </button>
                      </>
                    )}
                    {r.status === "Verified" && (
                      <button
                        className="icon-button"
                        aria-label={"Download receipt " + r.reference}
                        onClick={() =>
                          downloadReceipt(
                            r,
                            d.farmers.find((f) => f.id === r.farmerId),
                            snapshot.settings.logo,
                          ).catch((e) => notify(e.message, true))
                        }
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            empty="No payments recorded"
          />
        </section>
      )}
      {tab === "Applications" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Membership applications</h3>
              <p>
                The future farmer website will submit applications directly into
                this review queue.
              </p>
            </div>
            <Badge tone="neutral">Website pending launch</Badge>
          </div>
          <DataTable
            rows={d.applications}
            columns={[
              {
                key: "farmerId",
                label: "Applicant",
                render: (r) => {
                  const f = d.farmers.find((f) => f.id === r.farmerId);
                  return f ? (
                    <Link to={"/farmers/" + f.id}>{names(f)}</Link>
                  ) : (
                    "Not found"
                  );
                },
              },
              {
                key: "date",
                label: "Submitted",
                render: (r) => new Date(r.date).toLocaleDateString("en-NG"),
              },
              { key: "source", label: "Source" },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge>{r.status}</Badge>,
              },
              {
                key: "action",
                label: "Review",
                render: (r) =>
                  canRecord && (
                    <select
                      aria-label="Review application"
                      value=""
                      onChange={async (e) => {
                        try {
                          await api(
                            "/api/membership/applications/" + r.id + "/review",
                            {
                              method: "POST",
                              body: JSON.stringify({ status: e.target.value }),
                            },
                          );
                          await refresh();
                          notify("Application reviewed");
                        } catch (e: any) {
                          notify(e.message, true);
                        }
                      }}
                    >
                      <option value="">Choose action</option>
                      <option>Approved</option>
                      <option>Needs information</option>
                      <option>Rejected</option>
                    </select>
                  ),
              },
            ]}
          />
        </section>
      )}
      {tab === "Member status" && (
        <section className="panel">
          <DataTable
            rows={d.farmers}
            columns={[
              {
                key: "name",
                label: "Member",
                render: (f) => (
                  <Link to={"/farmers/" + f.id} className="text-link">
                    {names(f)}
                  </Link>
                ),
              },
              { key: "farmerID", label: "Member ID" },
              { key: "state", label: "Chapter" },
              {
                key: "kycComplete",
                label: "Identity",
                render: (f) => (
                  <Badge>{f.kycComplete ? "Verified" : "Pending"}</Badge>
                ),
              },
              {
                key: "membershipStatus",
                label: "Membership",
                render: (f) => (
                  <Badge>{f.membershipStatus || "Not assessed"}</Badge>
                ),
              },
              {
                key: "paymentStatus",
                label: "Payment",
                render: (f) => (
                  <Badge>{f.paymentStatus || "Not recorded"}</Badge>
                ),
              },
            ]}
          />
        </section>
      )}
      {tab === "Farmer website" && (
        <section className="panel website-plan">
          <div className="website-icon">
            <Globe size={35} />
          </div>
          <Badge tone="gold">PREPARED FOR A LATER LAUNCH</Badge>
          <h2>One doorway for every farmer.</h2>
          <p>
            Your future RIFAN registration website can feed membership
            applications directly into this database. Each applicant will move
            through review, identity verification and membership payment.
          </p>
          <div className="journey">
            <span>Farmer registers</span>
            <ArrowUpRight size={16} />
            <span>Chapter reviews</span>
            <ArrowUpRight size={16} />
            <span>Payment verified</span>
            <ArrowUpRight size={16} />
            <span>Membership activated</span>
          </div>
          <div className="detail-grid">
            <div>
              <h3>Prepared in this app</h3>
              <ul>
                <li>Independent RIFAN member database</li>
                <li>Consent-aware registration API</li>
                <li>Application review queue</li>
                <li>Configurable registration and membership fees</li>
                <li>Receipt references and verified payment history</li>
              </ul>
            </div>
            <div>
              <h3>Needed before launch</h3>
              <ul>
                <li>Build and publish the public farmer website</li>
                <li>Set approved fees and membership terms</li>
                <li>Choose and connect a payment provider</li>
                <li>Verify provider webhooks and reconciliation</li>
                <li>Enable public registration after deployment checks</li>
              </ul>
            </div>
          </div>
          <p className="small-text muted">
            Online payment collection is disabled. Recording a payment here does
            not charge a bank account or send money.
          </p>
        </section>
      )}
      {payment && (
        <PaymentForm
          initialFarmer={params.get("farmer") || ""}
          onClose={() => setPayment(false)}
        />
      )}
    </>
  );
}
function PaymentForm({
  onClose,
  initialFarmer,
}: {
  onClose: () => void;
  initialFarmer: string;
}) {
  const { snapshot, refresh, notify } = useWorkspace();
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <Modal title="Record membership payment" onClose={onClose}>
      <p>
        Record an already received payment. An administrator must verify it
        before it counts towards membership.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError("");
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api("/api/membership/payments", {
              method: "POST",
              body: JSON.stringify(values),
            });
            await refresh();
            notify("Payment recorded — awaiting verification");
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field full">
            <span>Member</span>
            <select name="farmerId" defaultValue={initialFarmer} required>
              <option value="">Choose a member</option>
              {snapshot.data.farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {names(f)} · {f.farmerID}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fee type</span>
            <select name="type">
              <option>Registration</option>
              <option>Membership</option>
            </select>
          </label>
          <label className="field">
            <span>Amount received (₦)</span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label className="field">
            <span>Payment method</span>
            <select name="method">
              <option>Bank transfer</option>
              <option>Cash</option>
              <option>POS</option>
            </select>
          </label>
          <label className="field">
            <span>Membership year</span>
            <input
              name="period"
              defaultValue={new Date().getFullYear()}
              pattern="[0-9]{4}"
              required
            />
          </label>
          <label className="field full">
            <span>Receipt / bank transaction reference</span>
            <input name="reference" minLength={4} required />
          </label>
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? "Recording…" : "Record for verification"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
async function downloadReceipt(
  row: Row,
  farmer: Row | undefined,
  logo: string,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  await pdfFont(pdf);
  const image = await pdfImage(logo);
  pdf.setGState(pdf.GState({ opacity: 0.05 }));
  pdf.addImage(image, "JPEG", 40, 80, 130, 130);
  pdf.setGState(pdf.GState({ opacity: 1 }));
  pdf.addImage(image, "JPEG", 85, 15, 40, 40);
  pdf.setTextColor(25, 76, 43);
  pdf.setFontSize(22);
  pdf.text("RIFAN CONNECT", 105, 70, { align: "center" });
  pdf.setFontSize(13);
  pdf.text("VERIFIED MEMBERSHIP RECEIPT", 105, 82, { align: "center" });
  pdf.setFontSize(11);
  const lines = [
    `Reference: ${row.reference}`,
    `Member: ${farmer ? names(farmer) : "Unavailable"}`,
    `Member ID: ${farmer?.farmerID || ""}`,
    `Fee: ${row.type} / ${row.period}`,
    `Amount: NGN ${Number(row.amount).toFixed(2)}`,
    `Method: ${row.method}`,
    `Received: ${new Date(row.date).toLocaleDateString("en-NG")}`,
    `Verified: ${new Date(row.verifiedAt).toLocaleDateString("en-NG")}`,
  ];
  pdf.text(lines, 30, 110, { lineHeightFactor: 2 });
  pdf.setFontSize(9);
  pdf.text(
    "Generated from the RIFAN verified ledger. Confirm reference with your chapter.",
    105,
    230,
    { align: "center" },
  );
  pdf.save(
    "RIFAN-receipt-" + row.reference.replace(/[^a-zA-Z0-9-]/g, "_") + ".pdf",
  );
}
