import {
  randomInt,
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Express, Response } from "express";
import type { Store } from "../database";
import type { Session } from "../../src/model";
import { admin, reject, route } from "./context";
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};
export type Mailer = {
  send: (message: MailMessage) => Promise<void>;
};
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function emailConfigured() {
  return !!(
    (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) ||
    (process.env.SMTP_HOST &&
      process.env.SMTP_FROM &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD)
  );
}
export async function deliver(message: MailMessage) {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error("Email service did not accept the message");
    return;
  }
  if (!emailConfigured()) throw new Error("Email provider is not configured");
  const { default: nodemailer } = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM, ...message });
  } finally {
    transport.close();
  }
}
export function createSecurity(s: Store, mailer?: Mailer) {
  const configured = () => !!mailer || emailConfigured();
  const password = (u: any, value: any) =>
    typeof value === "string" &&
    value.length <= 1000 &&
    timingSafeEqual(Buffer.from(u.hash, "hex"), scryptSync(value, u.salt, 64));
  const needs = async (u: any) =>
    !!(
      u.twofa_enabled ||
      u.twofa_required ||
      (await s.settings(u.space)).requireTwoFactor
    );
  const send = async (u: any, purpose: string) => {
    if (!configured())
      reject(
        503,
        "Branded email OTP requires a configured email provider. Contact your administrator.",
      );
    const last = (await s.db
      .prepare(
        "SELECT created FROM otp_challenges WHERE user_id=? AND purpose=? ORDER BY created DESC LIMIT 1",
      )
      .get(u.id, purpose)) as any;
    if (last && Date.now() - last.created < 60000)
      reject(
        429,
        "An OTP was recently sent. Wait one minute before requesting another.",
      );
    const id = randomUUID(),
      code = String(randomInt(0, 1000000)).padStart(6, "0"),
      salt = randomBytes(16).toString("hex");
    await s.db
      .prepare(
        "INSERT INTO otp_challenges(id,user_id,space,purpose,hash,salt,expires,created) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        u.id,
        u.space,
        purpose,
        scryptSync(code, salt, 64).toString("hex"),
        salt,
        Date.now() + 5 * 60000,
        Date.now(),
      );
    const branding = await s.settings(u.space);
    const logoBase = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
    const logo = logoBase
      ? `<img width="64" alt="RIFAN" src="${escape(logoBase.replace(/\/$/, "") + "/rifan-logo.png")}"/>`
      : "";
    const message = {
      to: u.email,
      subject: `${branding.appName} verification code`,
      text: `${branding.appName}\nYour verification code is ${code}. It expires in 5 minutes. Do not share this code. If you did not request this, contact your administrator.`,
      html: `<div style="background:#f4f5ed;padding:32px;font-family:Arial,sans-serif"><div style="max-width:480px;margin:auto;background:white;border:1px solid #ddd8bb;border-radius:12px;overflow:hidden"><header style="background:#194c2b;color:white;padding:24px">${logo}<h1 style="font-size:24px">${escape(String(branding.appName))}</h1><p>MEMBERSHIP &amp; FARM MANAGEMENT</p></header><div style="padding:28px;color:#243428"><p>Hello ${escape(u.name)},</p><p>Use this verification code to ${purpose === "login" ? "complete your sign-in" : "confirm your security change"}:</p><p style="font-size:36px;letter-spacing:8px;color:#194c2b;font-weight:bold">${code}</p><p>This code expires in <strong>5 minutes</strong>. Never share it.</p><p>If you did not request this, contact your administrator.</p></div><footer style="padding:18px;background:#efe9d5;color:#594b20">Growing together. Feeding a nation.</footer></div></div>`,
    };
    try {
      if (mailer) await mailer.send(message);
      else await deliver(message);
    } catch {
      await s.db.prepare("DELETE FROM otp_challenges WHERE id=?").run(id);
      reject(
        503,
        "OTP email could not be sent. No security setting was changed.",
      );
    }
    return {
      requiresOtp: true,
      challengeId: id,
      expiresIn: 300,
      message: "A verification code was sent to your account email.",
    };
  };
  const consume = async (
    id: any,
    code: any,
    purpose: string,
    userId?: string,
  ) => {
    if (
      typeof id !== "string" ||
      typeof code !== "string" ||
      !/^\d{6}$/.test(code)
    )
      reject(400, "Enter the six-digit verification code");
    const challenge = await s.db
      .prepare(
        "UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND purpose=? AND expires>=? AND attempts<5" +
          (userId ? " AND user_id=?" : "") +
          " RETURNING *",
      )
      .get(id, purpose, Date.now(), ...(userId ? [userId] : []));
    if (!challenge)
      reject(
        401,
        "OTP is expired, unavailable or exhausted. Sign in/request a new code.",
      );
    if (
      !timingSafeEqual(
        Buffer.from(challenge.hash, "hex"),
        scryptSync(code, challenge.salt, 64),
      )
    )
      reject(401, "Verification code is incorrect");
    const consumed = await s.db
      .prepare("DELETE FROM otp_challenges WHERE id=? RETURNING id")
      .get(id);
    if (!consumed)
      reject(401, "OTP was already used. Sign in/request a new code.");
    const u = (await s.db
      .prepare("SELECT * FROM users WHERE id=? AND space=?")
      .get(challenge.user_id, challenge.space)) as any;
    if (!u) reject(401, "Account is unavailable");
    return u;
  };
  return {
    configured,
    needs,
    password,
    send,
    mountPublic(
      app: Express,
      issue: (res: Response, actor: Session) => Promise<Session>,
    ) {
      app.post(
        "/api/auth/otp/verify",
        route(async (req, res) => {
          const u = await consume(req.body.challengeId, req.body.code, "login");
          const scope = JSON.parse(u.scope || "{}");
          await s.audit(
            { id: u.id, name: u.name, space: u.space } as Session,
            "2FA_LOGIN",
            "users",
            u.id,
            "Email OTP verified",
          );
          res.json(
            await issue(res, {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              mustChangePassword: !!u.must_change_password,
              space: u.space,
              demo: false,
              ...scope,
            }),
          );
        }),
      );
    },
    mountPrivate(app: Express) {
      app.get(
        "/api/security/2fa",
        route(async (req, res) => {
          const u = (await s.db
            .prepare(
              "SELECT twofa_enabled,twofa_required FROM users WHERE id=? AND space=?",
            )
            .get(req.actor.id, req.actor.space)) as any;
          res.json({
            enabled: !!u?.twofa_enabled,
            required:
              !!u?.twofa_required ||
              !!(await s.settings(req.actor.space)).requireTwoFactor,
            emailConfigured: configured(),
            demo: req.actor.demo,
          });
        }),
      );
      app.post(
        "/api/security/2fa/change",
        route(async (req, res) => {
          if (req.actor.demo)
            reject(400, "Security changes require a private workspace account");
          const u = (await s.db
            .prepare("SELECT * FROM users WHERE id=? AND space=?")
            .get(req.actor.id, req.actor.space)) as any;
          if (!u || !password(u, req.body.currentPassword))
            reject(403, "Current password is incorrect");
          if (typeof req.body.enabled !== "boolean")
            reject(400, "Choose whether to enable 2FA");
          if (
            !req.body.enabled &&
            (u.twofa_required ||
              (await s.settings(req.actor.space)).requireTwoFactor)
          )
            reject(403, "An administrator requires two-factor authentication");
          res.json(await send(u, req.body.enabled ? "enable" : "disable"));
        }),
      );
      app.post(
        "/api/security/2fa/confirm",
        route(async (req, res) => {
          const purpose = req.body.enabled === true ? "enable" : "disable";
          if (typeof req.body.enabled !== "boolean")
            reject(400, "Choose whether to enable 2FA");
          const u = await consume(
            req.body.challengeId,
            req.body.code,
            purpose,
            req.actor.id,
          );
          if (
            purpose === "disable" &&
            (u.twofa_required ||
              (await s.settings(req.actor.space)).requireTwoFactor)
          )
            reject(403, "An administrator requires two-factor authentication");
          await s.transaction(async () => {
            await s.db
              .prepare("UPDATE users SET twofa_enabled=? WHERE id=?")
              .run(purpose === "enable" ? 1 : 0, u.id);
            await s.db
              .prepare("DELETE FROM sessions WHERE user_id=?")
              .run(u.id);
            await s.audit(
              req.actor,
              "2FA_CHANGE",
              "users",
              u.id,
              purpose === "enable"
                ? "Enabled email two-factor authentication"
                : "Disabled optional email two-factor authentication",
            );
          });
          res.json({ success: true, signInAgain: true });
        }),
      );
      app.put(
        "/api/security/users/:id/2fa",
        route(async (req, res) => {
          if (!admin(req.actor) || req.actor.demo)
            reject(403, "Administrator access required");
          const actor = (await s.db
            .prepare("SELECT * FROM users WHERE id=?")
            .get(req.actor.id)) as any;
          const target = (await s.db
            .prepare("SELECT * FROM users WHERE id=? AND space=?")
            .get(req.params.id, req.actor.space)) as any;
          if (!target) reject(404, "User not found");
          if (
            req.actor.role === "Admin" &&
            ["Super Admin", "Admin"].includes(target.role) &&
            target.id !== req.actor.id
          )
            reject(403, "Only a Super Admin can manage administrator security");
          if (!password(actor, req.body.currentPassword))
            reject(403, "Confirm your administrator password");
          if (
            typeof req.body.enabled !== "boolean" ||
            typeof req.body.required !== "boolean"
          )
            reject(400, "Security choices must be true or false");
          if ((req.body.enabled || req.body.required) && !configured())
            reject(
              503,
              "Configure email delivery before enabling required 2FA",
            );
          await s.transaction(async () => {
            await s.db
              .prepare(
                "UPDATE users SET twofa_enabled=?,twofa_required=? WHERE id=?",
              )
              .run(
                req.body.enabled || req.body.required ? 1 : 0,
                req.body.required ? 1 : 0,
                target.id,
              );
            await s.db
              .prepare("DELETE FROM sessions WHERE user_id=?")
              .run(target.id);
            await s.db
              .prepare("DELETE FROM otp_challenges WHERE user_id=?")
              .run(target.id);
            await s.audit(
              req.actor,
              "2FA_ADMIN",
              "users",
              target.id,
              "Administrator updated email 2FA policy",
            );
          });
          res.json({ success: true });
        }),
      );
    },
  };
}
