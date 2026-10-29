import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import express from "express";
import type { Express, Response } from "express";
import type { Store } from "../database";
import type { Session, Row } from "../../src/model";
import { route, reject, manager, type FeatureContext } from "./context";
export interface PaymentGateway {
  initialize: (payload: any) => Promise<any>;
  verify: (reference: string) => Promise<any>;
}
export function paymentState(s: Store, space: string, farmerId: string) {
  const f = s.get(space, "farmers", farmerId);
  if (!f) return;
  const settings = s.settings(space);
  const rows = s
    .all(space, "payments")
    .filter((p) => p.farmerId === farmerId && p.status === "Verified");
  const registration = rows
    .filter((p) => p.type === "Registration")
    .reduce((a, p) => a + Number(p.amount), 0);
  const membership = rows
    .filter(
      (p) =>
        p.type === "Membership" &&
        p.period === String(new Date().getFullYear()),
    )
    .reduce((a, p) => a + Number(p.amount), 0);
  const paid =
    rows.length > 0 &&
    registration >= Number(settings.registrationFee) &&
    membership >= Number(settings.membershipFee);
  s.put(space, "farmers", {
    ...f,
    paymentStatus: paid ? "Paid" : rows.length ? "Part paid" : "Unpaid",
    membershipStatus: paid && f.kycComplete ? "Active" : "Awaiting review",
  });
}
export function createPaystack(
  s: Store,
  adapter?: PaymentGateway,
  secretOverride?: string,
) {
  const secret = () => secretOverride || process.env.PAYSTACK_SECRET_KEY;
  const request = async (url: string, body?: any) => {
    if (!secret()) reject(503, "Paystack is not configured");
    const r = await fetch("https://api.paystack.co" + url, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${secret()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const result = (await r.json()) as any;
    if (!r.ok || result.status !== true)
      reject(502, "Paystack could not complete the transaction request");
    return result.data;
  };
  const gateway = adapter || {
    initialize: (payload: any) => request("/transaction/initialize", payload),
    verify: (reference: string) =>
      request("/transaction/verify/" + encodeURIComponent(reference)),
  };
  const find = (reference: string) => {
    const r = s.db
      .prepare(
        "SELECT space,data FROM records WHERE entity='payments' AND json_extract(data,'$.provider')='Paystack' AND json_extract(data,'$.reference')=? LIMIT 1",
      )
      .get(reference) as any;
    return r ? { space: r.space, row: JSON.parse(r.data) as Row } : null;
  };
  const verify = async (reference: string) => {
    const found = find(reference);
    if (!found) reject(404, "Payment reference is unavailable");
    if (found.row.status === "Verified")
      return { status: "Verified", duplicate: true };
    const data = await gateway.verify(reference);
    if (data.reference !== reference || data.status !== "success")
      reject(409, "Paystack has not confirmed a successful payment");
    if (
      data.currency !== "NGN" ||
      !Number.isSafeInteger(Number(data.amount)) ||
      Number(data.amount) !== Number(found.row.amountMinor)
    )
      reject(
        409,
        "Paystack amount/currency does not match the membership obligation",
      );
    s.transaction(() => {
      const latest = s.get(found.space, "payments", found.row.id)!;
      if (latest.status === "Verified") return;
      s.put(found.space, "payments", {
        ...latest,
        status: "Verified",
        verifiedAt: new Date().toISOString(),
        verifiedBy: "paystack",
        providerTransactionId: String(data.id),
        paidAt: data.paid_at || new Date().toISOString(),
      });
      paymentState(s, found.space, latest.farmerId);
      s.audit(
        {
          id: "paystack",
          name: "Paystack verification",
          space: found.space,
        } as Session,
        "PAYMENT_VERIFIED",
        "payments",
        latest.id,
        "Verified signed/provider-confirmed NGN membership payment",
      );
    });
    return { status: "Verified", duplicate: false };
  };
  return {
    configured: () => !!secret(),
    mountWebhook(app: Express) {
      app.post(
        "/api/paystack/webhook",
        express.raw({ type: "application/json", limit: "1mb" }),
        async (req, res, next) => {
          try {
            if (!secret()) reject(503, "Payment provider is not configured");
            const signature = String(req.headers["x-paystack-signature"] || "");
            if (
              !/^[a-f0-9]{128}$/i.test(signature) ||
              !Buffer.isBuffer(req.body)
            )
              reject(401, "Invalid payment signature");
            const expected = createHmac("sha512", secret()!)
              .update(req.body)
              .digest();
            if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
              reject(401, "Invalid payment signature");
            let event: any;
            try {
              event = JSON.parse(req.body.toString("utf8"));
            } catch {
              reject(400, "Invalid webhook JSON");
            }
            if (
              event.event !== "charge.success" ||
              !find(event.data?.reference)
            ) {
              res.json({ received: true, ignored: true });
              return;
            }
            await verify(event.data.reference);
            res.json({ received: true });
          } catch (e) {
            next(e);
          }
        },
      );
    },
    mountPrivate(ctx: FeatureContext) {
      ctx.app.get(
        "/api/payments/config",
        route((_req, res) =>
          res.json({ paystackConfigured: !!secret(), currency: "NGN" }),
        ),
      );
      ctx.app.post(
        "/api/payments/paystack/initialize",
        route(async (req, res) => {
          if (!manager(req.actor) || req.actor.demo)
            reject(403, "Use an authorized private workspace account");
          if (!secret())
            reject(503, "Configure Paystack securely before starting checkout");
          const { farmerId, type, email } = req.body;
          const f = s.get(req.actor.space, "farmers", farmerId);
          if (!f || !ctx.allowed(req.actor, "farmers", f))
            reject(404, "Member not found");
          if (
            !["Registration", "Membership"].includes(type) ||
            typeof email !== "string" ||
            !/^\S+@\S+\.\S+$/.test(email)
          )
            reject(400, "Provide a fee type and payer email");
          const settings = s.settings(req.actor.space),
            amount = Number(
              type === "Registration"
                ? settings.registrationFee
                : settings.membershipFee,
            ),
            amountMinor = Math.round(amount * 100);
          if (!(amount > 0) || !Number.isSafeInteger(amountMinor))
            reject(400, "Configure a positive, valid fee before checkout");
          const reference = "rifan-" + randomUUID();
          const row = {
            id: randomUUID(),
            farmerId,
            type,
            reference,
            amount,
            amountMinor,
            currency: "NGN",
            provider: "Paystack",
            method: "Paystack",
            period: String(new Date().getFullYear()),
            status: "Pending checkout",
            date: new Date().toISOString(),
            recordedBy: req.actor.id,
          };
          s.put(req.actor.space, "payments", row);
          try {
            const base =
              process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
            const result = await gateway.initialize({
              email,
              amount: amountMinor,
              currency: "NGN",
              reference,
              ...(base
                ? {
                    callback_url:
                      base.replace(/\/$/, "") +
                      "/membership?reference=" +
                      reference,
                  }
                : {}),
              metadata: { farmerId, type, space: req.actor.space },
            });
            const url = new URL(result.authorization_url);
            if (
              url.protocol !== "https:" ||
              (!adapter && url.hostname !== "checkout.paystack.com")
            )
              reject(502, "Provider returned an invalid checkout URL");
            s.audit(
              req.actor,
              "CHECKOUT_CREATED",
              "payments",
              row.id,
              "Created Paystack checkout; no payment recorded until provider verification",
            );
            res.status(201).json({ reference, url: url.href });
          } catch (e) {
            s.put(req.actor.space, "payments", {
              ...row,
              status: "Checkout failed",
            });
            throw e;
          }
        }),
      );
      ctx.app.post(
        "/api/payments/paystack/:reference/verify",
        route(async (req, res) => {
          const found = find(req.params.reference);
          if (!found || found.space !== req.actor.space)
            reject(404, "Payment not found");
          const f = s.get(req.actor.space, "farmers", found.row.farmerId);
          if (!f || !ctx.allowed(req.actor, "farmers", f))
            reject(403, "Payment outside your access scope");
          res.json(await verify(req.params.reference));
        }),
      );
    },
  };
}
