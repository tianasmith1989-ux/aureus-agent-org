"use client";

import React, { useEffect, useState } from "react";

interface Move {
  id: string;
  directive: string | null;
  community: string;
  angle: string;
  text: string;
  status: string;
  source?: string;
  source_url?: string | null;
  posted: boolean;
  posted_at: string | null;
  created_at: string | null;
}

const ADAPT_PLATFORMS = ["Reddit", "Instagram", "LinkedIn", "TikTok", "YouTube", "X"];

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

const EXAMPLES = [
  "Draft my r/AusFinance founder story post — why I built Aureus.",
  "Give me 5 value-first posts for AU finance communities.",
  "Write a LinkedIn post on paying your mortgage off years early (education only).",
];

export default function MovesPage() {
  const [brief, setBrief] = useState("");
  const [moves, setMoves] = useState<Move[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 2b — Adapt one idea across platforms
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [source, setSource] = useState("");
  const [adaptPlatforms, setAdaptPlatforms] = useState<Record<string, boolean>>({
    Reddit: true,
    Instagram: true,
    LinkedIn: true,
    TikTok: false,
    YouTube: false,
    X: false,
  });
  const [adaptBusy, setAdaptBusy] = useState(false);

  // 2c — Monitoring (Reddit + YouTube)
  const [monOpen, setMonOpen] = useState(false);
  const [keywords, setKeywords] = useState<{ id: string; keyword: string }[]>([]);
  const [newKw, setNewKw] = useState("");
  const [monBusy, setMonBusy] = useState(false);
  const [monMsg, setMonMsg] = useState("");

  useEffect(() => {
    api<{ moves: Move[] }>("/api/moves")
      .then((d) => setMoves(d.moves ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
    api<{ keywords: { id: string; keyword: string }[] }>("/api/monitor/keywords")
      .then((d) => setKeywords(d.keywords ?? []))
      .catch(() => {});
    // Prefill the brief from a Venue Map deep-link (?prefill=...).
    try {
      const p = new URLSearchParams(window.location.search).get("prefill");
      if (p) setBrief(p);
    } catch {
      /* ignore */
    }
  }, []);

  async function adapt() {
    const src = source.trim();
    const plats = Object.keys(adaptPlatforms).filter((k) => adaptPlatforms[k]);
    if (!src || adaptBusy) return;
    if (!plats.length) {
      setError("Pick at least one platform to adapt for.");
      return;
    }
    setAdaptBusy(true);
    setError("");
    try {
      const { moves: fresh } = await api<{ moves: Move[] }>("/api/moves/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: src, platforms: plats }),
      });
      setMoves((prev) => [...(fresh ?? []), ...prev]);
    } catch (e: any) {
      setError(e?.message || "Adaptation failed.");
    }
    setAdaptBusy(false);
  }

  async function generate(directive?: string) {
    const text = (directive ?? brief).trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const { moves: fresh } = await api<{ moves: Move[] }>("/api/moves/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive: text }),
      });
      // New drafts on top; keep any prior ones below.
      setMoves((prev) => [...(fresh ?? []), ...prev]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    }
    setBusy(false);
  }

  async function addKeyword() {
    const kw = newKw.trim();
    if (!kw) return;
    setNewKw("");
    try {
      const { keyword } = await api<{ keyword: { id: string; keyword: string } }>(
        "/api/monitor/keywords",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        },
      );
      if (keyword) setKeywords((k) => [...k, keyword]);
    } catch {
      /* ignore */
    }
  }

  async function removeKeyword(id: string) {
    setKeywords((k) => k.filter((x) => x.id !== id));
    try {
      await api("/api/monitor/keywords", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* ignore */
    }
  }

  async function runMonitorNow() {
    if (monBusy) return;
    setMonBusy(true);
    setMonMsg("");
    try {
      const r = await api<{ drafted: number; scanned: number; reddit: number; youtube: number; note?: string }>(
        "/api/monitor/run",
        { method: "POST" },
      );
      setMonMsg(
        r.note
          ? r.note
          : `Scanned ${r.scanned} · drafted ${r.drafted} (Reddit ${r.reddit}, YouTube ${r.youtube}).`,
      );
      if (r.drafted > 0) {
        const d = await api<{ moves: Move[] }>("/api/moves");
        setMoves(d.moves ?? []);
      }
    } catch (e: any) {
      setMonMsg(e?.message || "Monitor run failed.");
    }
    setMonBusy(false);
  }

  function copy(m: Move) {
    try {
      navigator.clipboard?.writeText(m.text);
    } catch {
      /* ignore */
    }
    setCopied(m.id);
    setTimeout(() => setCopied(null), 1400);
  }

  async function togglePosted(m: Move) {
    const next = !m.posted;
    setMoves((c) =>
      c.map((x) =>
        x.id === m.id
          ? { ...x, posted: next, status: next ? "posted" : "draft", posted_at: next ? new Date().toISOString() : null }
          : x,
      ),
    );
    try {
      await api("/api/moves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, posted: next }),
      });
    } catch {
      /* keep optimistic state */
    }
  }

  async function clearAll() {
    setMoves([]);
    try {
      await api("/api/moves", { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }

  const postedCount = moves.filter((m) => m.posted).length;

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.shell}>
        <a href="/" style={S.back}>
          ← Back to the org
        </a>
        <div style={S.kicker}>FOUNDER COCKPIT</div>
        <h1 style={S.h1}>Today&apos;s Moves</h1>
        <div style={S.sub}>
          Brief a target → Scout picks the channel, Echo &amp; Aria draft it in your founder
          voice. <strong style={{ color: "var(--gold-bright)" }}>Drafting only — you post.</strong>{" "}
          Education-only, on-profile, compliant.
        </div>

        <section style={S.command}>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
            }}
            placeholder="e.g. draft my r/AusFinance founder story post…"
            style={S.textarea}
            rows={3}
          />
          <div style={S.cmdRow}>
            <div style={S.phase}>
              {busy && <span style={S.spinner} />}
              {busy ? "Drafting your moves…" : loaded ? `${postedCount}/${moves.length} posted` : ""}
            </div>
            <button
              onClick={() => generate()}
              disabled={busy || !brief.trim()}
              style={{ ...S.button, ...(busy || !brief.trim() ? S.buttonOff : {}) }}
            >
              {busy ? "Working…" : "Draft moves ▸"}
            </button>
          </div>
          <div style={S.chips}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => setBrief(ex)} disabled={busy} style={S.chip}>
                {ex}
              </button>
            ))}
          </div>
          {error && <div style={S.error}>⚠ {error}</div>}
        </section>

        {/* 2b — Adapt one idea across platforms */}
        <div style={S.bar}>
          <button onClick={() => setAdaptOpen((o) => !o)} style={S.barToggle}>
            <span style={{ color: "var(--gold)" }}>⇄</span> Adapt one idea across platforms{" "}
            <span style={{ color: "var(--dim)", fontSize: 11 }}>— one idea → native drafts</span>
            <span style={{ marginLeft: "auto", color: "var(--dim)" }}>{adaptOpen ? "▾" : "▸"}</span>
          </button>
          {adaptOpen && (
            <div style={{ padding: "0 14px 16px" }}>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Paste a post or idea — agents reshape it natively per platform…"
                style={S.textarea}
                rows={4}
              />
              <div style={{ ...S.chips, marginTop: 10 }}>
                {ADAPT_PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAdaptPlatforms((s) => ({ ...s, [p]: !s[p] }))}
                    style={{ ...S.pill, ...(adaptPlatforms[p] ? S.pillOn : {}) }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div style={{ ...S.cmdRow, marginTop: 12 }}>
                <div style={S.phase}>
                  {adaptBusy && <span style={S.spinner} />}
                  {adaptBusy ? "Reshaping per platform…" : ""}
                </div>
                <button
                  onClick={adapt}
                  disabled={adaptBusy || !source.trim()}
                  style={{ ...S.button, ...(adaptBusy || !source.trim() ? S.buttonOff : {}) }}
                >
                  {adaptBusy ? "Working…" : "Adapt ⇄"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2c — Monitoring (Reddit + YouTube only) */}
        <div style={S.bar}>
          <button onClick={() => setMonOpen((o) => !o)} style={S.barToggle}>
            <span style={{ color: "var(--gold)" }}>◴</span> Monitoring{" "}
            <span style={{ color: "var(--dim)", fontSize: 11 }}>— Reddit + YouTube, drafts replies</span>
            <span style={{ marginLeft: "auto", color: "var(--dim)" }}>{monOpen ? "▾" : "▸"}</span>
          </button>
          {monOpen && (
            <div style={{ padding: "0 14px 16px" }}>
              <div style={S.monNote}>
                Scheduled scans of Reddit &amp; YouTube for your keywords draft education-first
                replies into the list below (MONITOR badge) for your approval. Read-only — nothing
                posts. Other platforms have no read API.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {keywords.map((k) => (
                  <span key={k.id} style={S.kwChip}>
                    {k.keyword}
                    <button onClick={() => removeKeyword(k.id)} style={S.kwX}>
                      ×
                    </button>
                  </span>
                ))}
                {keywords.length === 0 && <span style={{ fontSize: 12, color: "var(--dim)" }}>No keywords yet.</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={newKw}
                  onChange={(e) => setNewKw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addKeyword();
                  }}
                  placeholder="Add a keyword (e.g. offset account, debt snowball)…"
                  style={{ ...S.input, flex: 1, minWidth: 200 }}
                />
                <button onClick={addKeyword} style={S.ghostBtn}>
                  Add
                </button>
                <button
                  onClick={runMonitorNow}
                  disabled={monBusy}
                  style={{ ...S.button, ...(monBusy ? S.buttonOff : {}) }}
                >
                  {monBusy ? "Scanning…" : "Run now ◴"}
                </button>
              </div>
              {monMsg && <div style={S.monMsg}>{monMsg}</div>}
            </div>
          )}
        </div>

        {moves.length > 0 && (
          <div style={S.listHead}>
            <span style={S.listLabel}>YOUR DRAFTS</span>
            <button onClick={clearAll} style={S.ghostBtn}>
              Clear
            </button>
          </div>
        )}

        {moves.map((m) => (
          <div key={m.id} style={{ ...S.card, ...(m.posted ? S.cardPosted : {}) }}>
            <div style={S.cardTop}>
              <span style={S.community}>{m.community}</span>
              {m.source && m.source !== "founder" && (
                <span style={S.sourceTag}>{m.source === "adapt" ? "ADAPTED" : "MONITOR"}</span>
              )}
              {m.angle && <span style={S.angle}>{m.angle}</span>}
              {m.source_url && (
                <a href={m.source_url} target="_blank" rel="noreferrer" style={S.threadLink}>
                  ↗ thread
                </a>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => copy(m)} style={S.tinyBtn}>
                  {copied === m.id ? "Copied ✓" : "Copy"}
                </button>
                <button
                  onClick={() => togglePosted(m)}
                  style={{ ...S.tinyBtn, ...(m.posted ? S.tinyOn : {}) }}
                >
                  {m.posted ? "Posted ✓" : "Mark posted"}
                </button>
              </div>
            </div>
            <div style={S.body}>{m.text}</div>
            {m.posted && m.posted_at && (
              <div style={S.postedAt}>Logged to CRM · {new Date(m.posted_at).toLocaleString()}</div>
            )}
          </div>
        ))}

        <div style={S.footer}>
          Nothing here posts automatically. Reddit monitoring (read-only) comes in Phase 2.
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
textarea::placeholder{color:var(--dim);}
textarea:focus{outline:none;border-color:var(--gold)!important;}
button{cursor:pointer;font-family:inherit;}
::-webkit-scrollbar{width:8px;}::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px;}
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
  shell: { maxWidth: 760, margin: "0 auto" },
  back: { color: "var(--muted)", fontSize: 13, textDecoration: "none" },
  kicker: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "3px",
    color: "var(--gold)",
    marginTop: 20,
  },
  h1: { fontFamily: "Fraunces,serif", fontWeight: 500, fontSize: 30, margin: "4px 0 8px" },
  sub: { fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 22 },
  command: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 22,
  },
  textarea: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--text)",
    padding: "12px 14px",
    fontSize: 14.5,
    fontFamily: "inherit",
    resize: "vertical",
    lineHeight: 1.5,
  },
  cmdRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  phase: { fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 },
  spinner: {
    width: 12,
    height: 12,
    border: "2px solid var(--line)",
    borderTopColor: "var(--gold)",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin .8s linear infinite",
  },
  button: {
    background: "var(--gold)",
    color: "#100D06",
    border: "none",
    borderRadius: 9,
    padding: "10px 20px",
    fontWeight: 700,
    fontSize: 14,
  },
  buttonOff: { background: "var(--line)", color: "var(--dim)", cursor: "not-allowed" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: {
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 20,
    padding: "6px 12px",
    fontSize: 11.5,
    fontFamily: "inherit",
    textAlign: "left",
  },
  error: {
    background: "rgba(180,60,40,.12)",
    border: "1px solid rgba(180,60,40,.4)",
    color: "#E8A99a",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginTop: 12,
  },
  listHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listLabel: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "2px",
    color: "var(--gold)",
  },
  ghostBtn: {
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
  },
  card: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 12,
  },
  cardPosted: { opacity: 0.62, borderColor: "rgba(116,196,154,.4)" },
  cardTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  community: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 11,
    letterSpacing: ".5px",
    color: "var(--gold-bright)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    padding: "3px 8px",
  },
  angle: { fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" },
  sourceTag: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 8.5,
    letterSpacing: "1px",
    color: "var(--gold)",
    border: "1px solid var(--line)",
    borderRadius: 5,
    padding: "2px 6px",
  },
  threadLink: { fontSize: 11.5, color: "var(--gold-bright)", textDecoration: "none" },
  bar: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  barToggle: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "none",
    color: "var(--text)",
    padding: "12px 14px",
    fontSize: 13.5,
    fontWeight: 600,
  },
  pill: {
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
  },
  pillOn: { borderColor: "var(--gold)", color: "var(--gold-bright)", background: "rgba(201,162,39,.08)" },
  input: {
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--text)",
    padding: "10px 12px",
    fontSize: 13.5,
    fontFamily: "inherit",
  },
  monNote: { fontSize: 12, color: "var(--dim)", lineHeight: 1.6, marginBottom: 12 },
  kwChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--panel2)",
    border: "1px solid var(--line)",
    borderRadius: 20,
    padding: "4px 6px 4px 12px",
    fontSize: 12,
    color: "var(--text)",
  },
  kwX: {
    background: "transparent",
    border: "none",
    color: "var(--dim)",
    fontSize: 15,
    lineHeight: 1,
    padding: "0 4px",
  },
  monMsg: { fontSize: 12, color: "var(--ok)", marginTop: 10 },
  body: { fontSize: 14, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" },
  postedAt: { fontSize: 11, color: "var(--ok)", marginTop: 10 },
  tinyBtn: {
    background: "var(--panel2)",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 7,
    padding: "4px 10px",
    fontSize: 11,
  },
  tinyOn: { color: "var(--ok)", borderColor: "rgba(116,196,154,.4)" },
  footer: { fontSize: 11.5, color: "var(--dim)", textAlign: "center", lineHeight: 1.5, marginTop: 18 },
};
