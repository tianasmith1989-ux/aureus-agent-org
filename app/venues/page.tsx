"use client";

import React, { useEffect, useState } from "react";

interface Venue {
  id: string;
  platform: string;
  name: string;
  link: string;
  size: string;
  fit: string;
  rules: string;
  angle: string;
  rank: number;
  status: string;
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

const PLAT_COLORS: Record<string, string> = {
  Reddit: "#E06A4B",
  Facebook: "#5B8FB9",
  Instagram: "#C97BA7",
  LinkedIn: "#5B8FB9",
  TikTok: "#CBC4B6",
  Discord: "#8C7BC9",
  YouTube: "#E0564B",
  Creator: "#C9A227",
};

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ venues: Venue[] }>("/api/venues")
      .then((d) => setVenues(d.venues ?? []))
      .catch(() => {});
  }, []);

  async function discover() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { venues: fresh } = await api<{ venues: Venue[] }>("/api/venues/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive: focus }),
      });
      setVenues((prev) => [...(fresh ?? []), ...prev]);
    } catch (e: any) {
      setError(e?.message || "Discovery failed.");
    }
    setBusy(false);
  }

  async function remove(id: string) {
    setVenues((v) => v.filter((x) => x.id !== id));
    try {
      await api("/api/venues", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* ignore */
    }
  }

  async function clearAll() {
    setVenues([]);
    try {
      await api("/api/venues", { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.shell}>
        <a href="/" style={S.back}>
          ← Back to the org
        </a>
        <div style={S.kicker}>FOUNDER COCKPIT · DISTRIBUTION</div>
        <h1 style={S.h1}>Venue Map</h1>
        <div style={S.sub}>
          Scout researches the best real places to post value-first content across every platform —
          Reddit, Facebook, Instagram, LinkedIn, TikTok, Discord, YouTube, and AU finance creators.{" "}
          <strong style={{ color: "var(--gold-bright)" }}>Research only.</strong> You decide where to show up.
        </div>

        <section style={S.command}>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Optional focus (e.g. mortgage payoff, FIRE for normal incomes, debt-free)…"
            style={S.input}
          />
          <div style={S.cmdRow}>
            <div style={S.phase}>
              {busy && <span style={S.spinner} />}
              {busy ? "Scout is researching the web…" : `${venues.length} venues`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {venues.length > 0 && (
                <button onClick={clearAll} disabled={busy} style={S.ghostBtn}>
                  Clear
                </button>
              )}
              <button
                onClick={discover}
                disabled={busy}
                style={{ ...S.button, ...(busy ? S.buttonOff : {}) }}
              >
                {busy ? "Researching…" : venues.length ? "Find more ⌖" : "Discover venues ⌖"}
              </button>
            </div>
          </div>
          {error && <div style={S.error}>⚠ {error}</div>}
        </section>

        {venues.map((v) => (
          <div key={v.id} style={S.card}>
            <div style={S.cardTop}>
              <span style={{ ...S.platBadge, color: PLAT_COLORS[v.platform] || "var(--gold)", borderColor: PLAT_COLORS[v.platform] || "var(--line)" }}>
                {v.platform || "—"}
              </span>
              {v.link ? (
                <a href={v.link} target="_blank" rel="noreferrer" style={S.name}>
                  {v.name}
                </a>
              ) : (
                <span style={S.name}>{v.name}</span>
              )}
              {v.size && <span style={S.size}>{v.size}</span>}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <a
                  href={`/moves?prefill=${encodeURIComponent(`Draft a value-first post for ${v.name} (${v.platform}). Angle: ${v.angle}`)}`}
                  style={S.draftBtn}
                >
                  Draft a move →
                </a>
                <button onClick={() => remove(v.id)} style={S.tinyBtn}>
                  Remove
                </button>
              </div>
            </div>
            {v.fit && (
              <div style={S.row}>
                <span style={S.rowLabel}>FIT</span> {v.fit}
              </div>
            )}
            {v.angle && (
              <div style={S.row}>
                <span style={S.rowLabel}>ANGLE</span> {v.angle}
              </div>
            )}
            {v.rules && (
              <div style={S.row}>
                <span style={S.rowLabel}>RULES</span> {v.rules}
              </div>
            )}
          </div>
        ))}

        <div style={S.footer}>
          Verify each venue&apos;s current self-promo rules yourself before posting. Nothing here posts for you.
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
:root{--bg:#0B0A07;--panel:#14110B;--panel2:#1B170F;--line:#2A2418;--gold:#C9A227;--gold-bright:#EBCB6B;--text:#EFE8D7;--muted:#A99C86;--dim:#6B6253;--ok:#74C49A;}
*{box-sizing:border-box;}
@keyframes spin{to{transform:rotate(360deg);}}
input::placeholder{color:var(--dim);}
input:focus{outline:none;border-color:var(--gold)!important;}
button{cursor:pointer;font-family:inherit;}
a{color:inherit;}
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
  shell: { maxWidth: 800, margin: "0 auto" },
  back: { color: "var(--muted)", fontSize: 13, textDecoration: "none" },
  kicker: { fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "3px", color: "var(--gold)", marginTop: 20 },
  h1: { fontFamily: "Fraunces,serif", fontWeight: 500, fontSize: 30, margin: "4px 0 8px" },
  sub: { fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 22 },
  command: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 18, marginBottom: 22 },
  input: { width: "100%", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", padding: "11px 14px", fontSize: 14, fontFamily: "inherit" },
  cmdRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 12, flexWrap: "wrap" },
  phase: { fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 },
  spinner: { width: 12, height: 12, border: "2px solid var(--line)", borderTopColor: "var(--gold)", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" },
  button: { background: "var(--gold)", color: "#100D06", border: "none", borderRadius: 9, padding: "10px 18px", fontWeight: 700, fontSize: 14 },
  buttonOff: { background: "var(--line)", color: "var(--dim)", cursor: "not-allowed" },
  ghostBtn: { background: "transparent", border: "1px solid var(--line)", color: "var(--muted)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5 },
  error: { background: "rgba(180,60,40,.12)", border: "1px solid rgba(180,60,40,.4)", color: "#E8A99a", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginTop: 12 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
  cardTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  platBadge: { fontFamily: "'Space Mono',monospace", fontSize: 9.5, letterSpacing: "1px", border: "1px solid", borderRadius: 5, padding: "2px 7px" },
  name: { fontFamily: "Fraunces,serif", fontSize: 16, color: "var(--text)", textDecoration: "none" },
  size: { fontSize: 11.5, color: "var(--dim)" },
  draftBtn: { fontSize: 11.5, color: "var(--gold-bright)", textDecoration: "none", border: "1px solid var(--line)", borderRadius: 7, padding: "4px 9px" },
  tinyBtn: { background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--muted)", borderRadius: 7, padding: "4px 10px", fontSize: 11 },
  row: { fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "3px 0", display: "flex", gap: 8 },
  rowLabel: { fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "1px", color: "var(--gold)", flexShrink: 0, width: 42, paddingTop: 2 },
  footer: { fontSize: 11.5, color: "var(--dim)", textAlign: "center", lineHeight: 1.5, marginTop: 18 },
};
