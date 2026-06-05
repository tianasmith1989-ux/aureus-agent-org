"use client";

import React, { useEffect, useState } from "react";

interface Sub {
  stripeConfigured: boolean;
  plan: string | null;
  status: string;
  current_period_end: string | null;
}

async function api<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, opts);
  if (!res.ok) {
    let msg = "";
    try {
      msg = (await res.json())?.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function BillingPage() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Sub>("/api/subscription")
      .then(setSub)
      .catch((e) => setError(e.message));
  }, []);

  async function go(path: string, key: string, body?: any) {
    setBusy(key);
    setError("");
    try {
      const { url } = await api<{ url: string }>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      window.location.href = url;
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
      setBusy(null);
    }
  }

  const active = sub && ["active", "trialing", "past_due"].includes(sub.status);

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.shell}>
        <a href="/" style={S.back}>
          ← Back to the org
        </a>
        <div style={S.kicker}>BILLING</div>
        <h1 style={S.h1}>
          Aureus Plutus<span style={{ color: "var(--gold)" }}>.</span>
        </h1>

        {error && <div style={S.error}>⚠ {error}</div>}

        {sub && !sub.stripeConfigured && (
          <div style={S.note}>
            Stripe isn&apos;t configured yet. Add <code>STRIPE_SECRET_KEY</code> and the price IDs
            to <code>.env.local</code> to enable checkout.
          </div>
        )}

        <div style={S.statusCard}>
          <div style={S.statusLabel}>CURRENT PLAN</div>
          <div style={S.statusVal}>
            {sub ? (sub.plan ? `${sub.plan} · ${sub.status}` : "No active plan") : "Loading…"}
          </div>
          {sub?.current_period_end && (
            <div style={S.statusSub}>
              Renews/ends {new Date(sub.current_period_end).toLocaleDateString()}
            </div>
          )}
        </div>

        <div style={S.plans}>
          <div style={S.plan}>
            <div style={S.planName}>7-day trial</div>
            <div style={S.price}>
              $1<span style={S.per}>/ 7 days</span>
            </div>
            <div style={S.planNote}>then $14.99/month. Cancel anytime.</div>
            <button
              onClick={() => go("/api/stripe/checkout", "trial", { plan: "trial" })}
              disabled={!!busy}
              style={S.btn}
            >
              {busy === "trial" ? "Redirecting…" : "Start $1 trial"}
            </button>
          </div>

          <div style={{ ...S.plan, ...S.planFeatured }}>
            <div style={S.badge}>SAVE ~$81</div>
            <div style={S.planName}>Annual</div>
            <div style={S.price}>
              $99<span style={S.per}>/ year</span>
            </div>
            <div style={S.planNote}>~45% cheaper than monthly.</div>
            <button
              onClick={() => go("/api/stripe/checkout", "annual", { plan: "annual" })}
              disabled={!!busy}
              style={{ ...S.btn, ...S.btnGold }}
            >
              {busy === "annual" ? "Redirecting…" : "Go annual"}
            </button>
          </div>
        </div>

        {active && (
          <button onClick={() => go("/api/stripe/portal", "portal")} disabled={!!busy} style={S.manage}>
            {busy === "portal" ? "Opening…" : "Manage / cancel subscription"}
          </button>
        )}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
:root{--bg:#0B0A07;--panel:#14110B;--panel2:#1B170F;--line:#2A2418;--gold:#C9A227;--gold-bright:#EBCB6B;--text:#EFE8D7;--muted:#A99C86;--dim:#6B6253;--ok:#74C49A;}
*{box-sizing:border-box;}
button{cursor:pointer;font-family:inherit;}
code{font-family:'Space Mono',monospace;color:var(--gold-bright);font-size:12px;}
`;

const S: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Hanken Grotesk',sans-serif",
    background:
      "radial-gradient(1200px 500px at 80% -10%, rgba(201,162,39,.10), transparent 60%), var(--bg)",
    color: "var(--text)",
    minHeight: "100vh",
    padding: "40px 16px",
  },
  shell: { maxWidth: 720, margin: "0 auto" },
  back: { color: "var(--muted)", fontSize: 13, textDecoration: "none" },
  kicker: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "3px",
    color: "var(--gold)",
    marginTop: 20,
  },
  h1: { fontFamily: "Fraunces,serif", fontWeight: 500, fontSize: 30, margin: "4px 0 22px" },
  error: {
    background: "rgba(180,60,40,.12)",
    border: "1px solid rgba(180,60,40,.4)",
    color: "#E8A99a",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  note: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    padding: "12px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.6,
  },
  statusCard: {
    background: "linear-gradient(180deg,var(--panel2),var(--panel))",
    border: "1px solid var(--line)",
    borderRadius: 14,
    padding: "16px 18px",
    marginBottom: 22,
  },
  statusLabel: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 9,
    letterSpacing: "2px",
    color: "var(--dim)",
  },
  statusVal: { fontFamily: "Fraunces,serif", fontSize: 20, marginTop: 4, textTransform: "capitalize" },
  statusSub: { fontSize: 12, color: "var(--muted)", marginTop: 4 },
  plans: { display: "flex", gap: 16, flexWrap: "wrap" },
  plan: {
    flex: 1,
    minWidth: 240,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: 20,
    position: "relative",
  },
  planFeatured: { borderColor: "var(--gold)" },
  badge: {
    position: "absolute",
    top: 14,
    right: 14,
    fontFamily: "'Space Mono',monospace",
    fontSize: 9,
    letterSpacing: "1px",
    color: "#100D06",
    background: "var(--gold)",
    borderRadius: 5,
    padding: "3px 7px",
  },
  planName: { fontFamily: "Fraunces,serif", fontSize: 18, color: "var(--gold-bright)" },
  price: { fontFamily: "Fraunces,serif", fontSize: 34, margin: "8px 0 2px" },
  per: { fontSize: 14, color: "var(--muted)", marginLeft: 6 },
  planNote: { fontSize: 12.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 },
  btn: {
    width: "100%",
    background: "var(--panel2)",
    border: "1px solid var(--line)",
    color: "var(--text)",
    borderRadius: 10,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 600,
  },
  btnGold: { background: "var(--gold)", color: "#100D06", border: "none", fontWeight: 700 },
  manage: {
    marginTop: 22,
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 13,
  },
};
