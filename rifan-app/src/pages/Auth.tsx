import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Wheat,
  ShieldCheck,
  Users,
  ChartNoAxesCombined,
} from "lucide-react";
import { api } from "../lib/workspace";
import type { Session } from "../model";
export default function Auth({ onLogin }: { onLogin: (s: Session) => void }) {
  const [status, setStatus] = useState<{
      needsSetup: boolean;
      demoEnabled: boolean;
    } | null>(null),
    [mode, setMode] = useState("login"),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    api("/api/auth/status")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);
  const enterDemo = async () => {
    setPending(true);
    setError("");
    try {
      onLogin(await api("/api/auth/demo", { method: "POST", body: "{}" }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <img
            src="/rifan-logo.png"
            alt="Rice Farmers Association of Nigeria logo"
          />
          <div>
            <strong>
              RIFAN <span>Connect</span>
            </strong>
            <small>RICE FARMERS ASSOCIATION OF NIGERIA</small>
          </div>
        </div>
        <div className="auth-copy">
          <div className="eyebrow light">
            <span />A SHARED VISION. A STRONGER HARVEST.
          </div>
          <h1>
            Rooted in community.
            <br />
            Growing a<br />
            <em>better tomorrow.</em>
          </h1>
          <p>
            One connected home for our farmers, our cooperatives, and the future
            of Nigerian rice.
          </p>
          <div className="auth-pillars">
            <span>
              <Users size={19} />
              Connected farmers
            </span>
            <span>
              <Wheat size={19} />
              Thriving fields
            </span>
            <span>
              <ChartNoAxesCombined size={19} />
              Measurable impact
            </span>
          </div>
        </div>
        <div className="auth-landscape">
          <RiceLandscape />
        </div>
        <footer>From the field to the nation’s table.</footer>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">WELCOME TO RIFAN Connect</span>
          <h2>
            {mode === "setup"
              ? "Build your RIFAN workspace."
              : "A new season of possibilities."}
          </h2>
          <p>
            {mode === "setup"
              ? "Create the first administrator account for your independent database."
              : "Sign in to manage your members and grow your impact."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError("");
              const values = Object.fromEntries(new FormData(e.currentTarget));
              try {
                onLogin(
                  await api(`/api/auth/${mode}`, {
                    method: "POST",
                    body: JSON.stringify(values),
                  }),
                );
              } catch (e: any) {
                setError(e.message);
              } finally {
                setPending(false);
              }
            }}
          >
            {mode === "setup" && (
              <label className="field">
                <span>Your full name</span>
                <input name="name" autoComplete="name" required minLength={2} />
              </label>
            )}
            <label className="field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                placeholder="you@organization.ng"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                placeholder={
                  mode === "setup"
                    ? "At least 12 characters"
                    : "Enter your password"
                }
                autoComplete={
                  mode === "setup" ? "new-password" : "current-password"
                }
                minLength={mode === "setup" ? 12 : 1}
                required
              />
            </label>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button className="button primary auth-submit" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "setup"
                  ? "Create workspace"
                  : "Sign in to workspace"}
              <ArrowRight size={18} />
            </button>
          </form>
          {status?.needsSetup && (
            <button
              className="text-button setup-link"
              onClick={() => setMode(mode === "login" ? "setup" : "login")}
            >
              {mode === "login"
                ? "First time here? Create your workspace"
                : "Already have an account? Sign in"}
            </button>
          )}
          {status?.demoEnabled && (
            <div className="demo-entry">
              <div className="divider">
                <span>EXPLORE BEFORE YOU BEGIN</span>
              </div>
              <button
                className="button demo-button"
                disabled={pending}
                onClick={enterDemo}
              >
                Explore the demo workspace <ArrowRight size={17} />
              </button>
              <small>
                Sample records only. Your real farmer data stays separate.
              </small>
            </div>
          )}
          <div className="secure-note">
            <ShieldCheck size={17} />
            Your association. Your data. Your workspace.
          </div>
        </div>
        <footer>RIFAN Connect · Growing together. Feeding a nation.</footer>
      </section>
    </div>
  );
}
export function RiceLandscape() {
  return (
    <svg viewBox="0 0 800 250" fill="none" aria-hidden="true">
      <path d="M-50 155Q160 55 400 135T850 130V300H-50Z" fill="#31613a" />
      <path d="M-50 210Q180 115 400 170T850 150V300H-50Z" fill="#547744" />
      <path
        d="M50 300L340 150M180 300L390 160M320 300L445 170M470 300L510 174M630 300L570 175M790 300L630 170"
        stroke="#b8ab60"
        strokeWidth="2"
        opacity=".6"
      />
      <circle cx="650" cy="80" r="35" fill="#d1b865" />
      <g stroke="#c9af59" strokeWidth="3">
        <path d="M110 245Q130 160 105 80M120 190Q80 160 75 140M124 167Q160 137 162 119M120 139Q88 115 88 100" />
        <path d="M690 245Q680 180 710 130M690 210L665 185M696 180L725 160" />
      </g>
    </svg>
  );
}
