import React, { useState } from "react";
import { api, useWorkspace } from "../../lib/workspace";
import { Modal } from "../ui";
import FarmerPicker from "./FarmerPicker";
export default function PaystackCheckout({
  onClose,
  initialFarmer = "",
}: {
  onClose: () => void;
  initialFarmer?: string;
}) {
  const { refresh } = useWorkspace();
  const [farmerId, setFarmerId] = useState(initialFarmer),
    [type, setType] = useState("Membership"),
    [email, setEmail] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [checkout, setCheckout] = useState<any>(null);
  return (
    <Modal title="Membership payment with Paystack" onClose={onClose}>
      <p>
        Checkout uses the configured fee in naira. No amount is accepted from
        the browser, and no payment is marked paid until server/provider
        verification.
      </p>
      {checkout ? (
        <>
          <div className="info-strip">
            Checkout created. Reference: {checkout.reference}
          </div>
          <a
            className="button primary"
            href={checkout.url}
            target="_blank"
            rel="noreferrer"
          >
            Open secure Paystack checkout →
          </a>
          <div className="form-actions">
            <button className="button" onClick={onClose}>
              Close
            </button>
            <button
              className="button primary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await api(
                    "/api/payments/paystack/" + checkout.reference + "/verify",
                    { method: "POST" },
                  );
                  await refresh();
                  onClose();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setPending(false);
                }
              }}
            >
              Check payment status
            </button>
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            try {
              setCheckout(
                await api("/api/payments/paystack/initialize", {
                  method: "POST",
                  body: JSON.stringify({ farmerId, type, email }),
                }),
              );
              await refresh();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="field">
            <span>Member</span>
            <FarmerPicker
              id="checkout-member"
              value={farmerId}
              onChange={setFarmerId}
              required
            />
          </label>
          <label className="field">
            <span>Fee type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>Membership</option>
              <option>Registration</option>
            </select>
          </label>
          <label className="field">
            <span>Payer email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <div className="form-actions">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={pending}>
              {pending ? "Creating checkout…" : "Create secure checkout"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </Modal>
  );
}
