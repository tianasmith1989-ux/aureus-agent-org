"use client";

import React, { useState, useRef, useEffect, type ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  MANAGERS_META as MANAGERS,
  ALL_AGENTS_META as ALL_AGENTS,
  COMPANY_DEFAULT,
} from "@/lib/roster";

/* ───────────────────────── Types ───────────────────────── */

interface PlanItem {
  agent: string;
  task: string;
}
interface ResultItem {
  agent: string;
  task: string;
  name: string;
  role: string;
  glyph: string;
  social: boolean;
  output: string;
}
interface RunReport {
  plan: PlanItem[];
  results: ResultItem[];
  report: string;
}
interface MemItem {
  brief: string;
  divisions: string;
  gist: string;
  at: string;
}
interface Post {
  id: string;
  day: number;
  platform: string;
  hook: string;
  post: string;
  hashtags: string;
  posted: boolean;
  status?: string;
  scheduled_at?: string | null;
}

/* ───────────────────────── API helper ───────────────────────── */

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

/* ───────────────────────── Markdown ───────────────────────── */

function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={key + i} style={{ color: "var(--text)", fontWeight: 600 }}>
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={key + i}>{p}</span>
    ),
  );
}
function Markdown({ text }: { text: string }) {
  return (
    <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
      {(text || "").split("\n").map((raw, i) => {
        const line = raw.replace(/\s+$/, "");
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        if (/^#{1,3}\s/.test(line))
          return (
            <div
              key={i}
              style={{
                fontFamily: "Fraunces,serif",
                fontSize: 15,
                color: "var(--gold-bright)",
                margin: "10px 0 4px",
              }}
            >
              {inline(line.replace(/^#{1,3}\s/, ""), "h" + i)}
            </div>
          );
        if (/^[-*]\s/.test(line))
          return (
            <div key={i} style={{ display: "flex", gap: 8, margin: "2px 0", lineHeight: 1.55 }}>
              <span style={{ color: "var(--gold)" }}>—</span>
              <span>{inline(line.replace(/^[-*]\s/, ""), "li" + i)}</span>
            </div>
          );
        return (
          <div key={i} style={{ lineHeight: 1.6, margin: "2px 0" }}>
            {inline(line, "p" + i)}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Constants ───────────────────────── */

const EXAMPLES: Record<string, string[]> = {
  atlas: [
    "Our $1 7-day trials aren't converting to paid — diagnose why and fix it.",
    "Find mortgage brokers and finance creators who could distribute Aureus.",
  ],
  mercury: [
    "Write a launch announcement for our Mortgage Accelerator feature.",
    "Plan a New Year debt-free campaign with content, social, and a growth test.",
  ],
  both: [
    "Plan a full EOFY growth push — marketing drives signups, growth converts trials.",
    "Reduce churn: marketing re-engages lapsed users, growth fixes activation.",
  ],
};
const PLAT: Record<string, string> = { LinkedIn: "#5B8FB9", X: "#CBC4B6", Instagram: "#C97BA7" };

/* ───────────────────────── App ───────────────────────── */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [savedTag, setSavedTag] = useState(false);
  const [profile, setProfile] = useState(COMPANY_DEFAULT);
  const [profileOpen, setProfileOpen] = useState(false);
  const [division, setDivision] = useState("atlas");
  const [brief, setBrief] = useState("");
  const [phase, setPhase] = useState("idle");
  const [status, setStatus] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<Record<string, RunReport>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [memory, setMemory] = useState<MemItem[]>([]);
  const [error, setError] = useState("");

  // calendar
  const [calOpen, setCalOpen] = useState(false);
  const [calGoal, setCalGoal] = useState("");
  const [calDays, setCalDays] = useState(5);
  const [calPlatforms, setCalPlatforms] = useState<Record<string, boolean>>({
    LinkedIn: true,
    X: true,
    Instagram: true,
  });
  const [calendar, setCalendar] = useState<Post[]>([]);
  const [calBusy, setCalBusy] = useState(false);
  const [calErr, setCalErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [schedTime, setSchedTime] = useState<Record<string, string>>({});

  const feedRef = useRef<HTMLElement | null>(null);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = ["planning", "working", "reporting"].includes(phase);
  const activeMgrs = division === "both" ? ["atlas", "mercury"] : [division];
  const exKey = division === "both" ? "both" : division;

  // load persisted state from the server
  useEffect(() => {
    (async () => {
      try {
        const [co, mem, cal] = await Promise.all([
          api<{ profile: string }>("/api/company"),
          api<{ memory: MemItem[] }>("/api/memory"),
          api<{ posts: Post[] }>("/api/calendar"),
        ]);
        if (co?.profile) setProfile(co.profile);
        setMemory(mem?.memory ?? []);
        setCalendar(cal?.posts ?? []);
      } catch {
        /* keep defaults */
      }
      setLoaded(true);
    })();
  }, []);

  // persist profile (debounced)
  useEffect(() => {
    if (!loaded) return;
    if (profileTimer.current) clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(async () => {
      try {
        await api("/api/company", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile }),
        });
        setSavedTag(true);
      } catch {
        /* ignore */
      }
    }, 800);
    return () => {
      if (profileTimer.current) clearTimeout(profileTimer.current);
    };
  }, [profile, loaded]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [runs]);

  async function run(directive?: string) {
    const text = (directive ?? brief).trim();
    if (!text || busy) return;
    setError("");
    setRuns({});
    setPhase("working");
    // mark managers + their specialists active while we wait
    const active: Record<string, string> = {};
    activeMgrs.forEach((id) => {
      active[id] = "active";
      MANAGERS[id].agents.forEach((a) => (active[a.id] = "active"));
    });
    setStatus(active);

    try {
      const { reports } = await api<{ reports: Record<string, RunReport> }>("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive: text, divisions: activeMgrs }),
      });
      setRuns(reports);
      const done: Record<string, string> = {};
      activeMgrs.forEach((id) => {
        done[id] = "done";
        (reports[id]?.results || []).forEach((r) => (done[r.agent] = "done"));
      });
      setStatus(done);
      setPhase("done");
      // refresh memory from server (it persisted this brief)
      try {
        const m = await api<{ memory: MemItem[] }>("/api/memory");
        setMemory(m?.memory ?? []);
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
      setPhase("error");
      setStatus({});
    }
  }

  async function generateCalendar() {
    if (calBusy) return;
    const plats = Object.keys(calPlatforms).filter((k) => calPlatforms[k]);
    if (!plats.length) {
      setCalErr("Pick at least one platform.");
      return;
    }
    setCalErr("");
    setCalBusy(true);
    try {
      const { posts } = await api<{ posts: Post[] }>("/api/calendar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: calGoal, days: calDays, platforms: plats }),
      });
      setCalendar(posts ?? []);
    } catch (e: any) {
      setCalErr(e?.message || "Failed to generate.");
    }
    setCalBusy(false);
  }

  async function togglePosted(id: string) {
    const cur = calendar.find((p) => p.id === id);
    const next = !cur?.posted;
    setCalendar((c) => c.map((p) => (p.id === id ? { ...p, posted: next } : p)));
    try {
      await api("/api/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, posted: next }),
      });
    } catch {
      /* keep optimistic state */
    }
  }

  async function schedulePost(id: string) {
    const t = schedTime[id];
    if (!t) {
      setCalErr("Pick a date/time to schedule.");
      return;
    }
    const iso = new Date(t).toISOString();
    setCalErr("");
    setCalendar((c) =>
      c.map((p) => (p.id === id ? { ...p, status: "scheduled", scheduled_at: iso } : p)),
    );
    try {
      await api("/api/calendar/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, scheduled_at: iso }),
      });
    } catch (e: any) {
      setCalErr(e?.message || "Failed to schedule.");
    }
  }

  function copyPost(p: Post) {
    const t = p.post + (p.hashtags ? "\n\n" + p.hashtags : "");
    try {
      navigator.clipboard?.writeText(t);
    } catch {
      /* ignore */
    }
    setCopied(p.id);
    setTimeout(() => setCopied(null), 1400);
  }

  async function clearCalendar() {
    setCalendar([]);
    try {
      await api("/api/calendar", { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }

  async function clearMemory() {
    setMemory([]);
    try {
      await api("/api/memory", { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }

  const dotColor = (st: string) =>
    st === "active" ? "var(--gold-bright)" : st === "done" ? "var(--ok)" : "var(--dim)";
  const phaseLabel =
    ({
      idle: "Awaiting your brief",
      working: "Division is working…",
      done: "Reports delivered",
      error: "Error",
    } as Record<string, string>)[phase] || "";
  const calDaysList = [...new Set(calendar.map((p) => p.day))].sort((a, b) => a - b);
  const postedCount = calendar.filter((p) => p.posted).length;

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.shell}>
        <header style={S.header}>
          <div>
            <div style={S.kicker}>AUTONOMOUS GROWTH ORG</div>
            <h1 style={S.wordmark}>
              AUREUS PLUTUS<span style={{ color: "var(--gold)" }}>.</span>
            </h1>
            <div style={S.sub}>
              aureusplutus.app · Premium Finance Pro{" "}
              {loaded && savedTag && <span style={{ color: "var(--ok)" }}>· saved ✓</span>}
              {" · "}
              <a href="/moves" style={{ color: "var(--gold)", textDecoration: "none" }}>
                Today&apos;s Moves
              </a>
              {" · "}
              <a href="/billing" style={{ color: "var(--gold)", textDecoration: "none" }}>
                Billing
              </a>
            </div>
          </div>
          <div style={S.reportsTo}>
            <div style={S.reportsLabel}>REPORTS TO</div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}
            >
              <div style={S.reportsYou}>You</div>
              <UserButton />
            </div>
          </div>
        </header>

        {/* Profile */}
        <div style={S.bar}>
          <button onClick={() => setProfileOpen((o) => !o)} style={S.barToggle}>
            <span style={{ color: "var(--gold)" }}>⚙</span> Company profile{" "}
            <span style={{ color: "var(--dim)", fontSize: 11 }}>— grounds all 12 agents</span>
            <span style={{ marginLeft: "auto", color: "var(--dim)" }}>
              {profileOpen ? "▾" : "▸"}
            </span>
          </button>
          {profileOpen && (
            <div style={{ padding: "0 14px 14px" }}>
              <textarea
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                rows={9}
                style={S.mono}
              />
              <div style={S.hint}>
                Injected server-side into every agent call. Saved automatically.
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {(
            [
              ["atlas", "❖ Growth"],
              ["mercury", "☿ Marketing"],
              ["both", "⛬ Whole company"],
            ] as [string, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => !busy && setDivision(k)}
              style={{ ...S.tab, ...(division === k ? S.tabOn : {}) }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Org */}
        <section style={S.org}>
          {activeMgrs.map((id) => {
            const mgr = MANAGERS[id];
            return (
              <div key={id} style={{ flex: 1, minWidth: 260 }}>
                <div style={{ ...S.directorCard, ...(status[id] ? S.cardLive : {}) }}>
                  <div style={S.dirLeft}>
                    <div style={S.glyphBig}>{mgr.glyph}</div>
                    <div>
                      <div style={S.agentName}>{mgr.name}</div>
                      <div style={S.agentRole}>{mgr.role}</div>
                    </div>
                  </div>
                  <span style={{ ...S.statusDot, background: dotColor(status[id]) }} />
                </div>
                <div style={S.connector} />
                <div style={S.grid}>
                  {mgr.agents.map((a) => (
                    <div
                      key={a.id}
                      style={{ ...S.agentCard, ...(status[a.id] === "active" ? S.cardLive : {}) }}
                    >
                      <div style={S.glyph}>{a.glyph}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.agentName2}>{a.name}</div>
                        <div style={S.agentRole}>{a.role}</div>
                      </div>
                      <span style={{ ...S.statusDot, background: dotColor(status[a.id]) }} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Command */}
        <section style={S.command}>
          <div style={S.cmdLabel}>
            BRIEF YOUR{" "}
            {division === "both"
              ? "ORG"
              : division === "atlas"
                ? "GROWTH DIRECTOR"
                : "MARKETING MANAGER"}
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            placeholder="Tell them what you want to achieve…"
            style={S.textarea}
            rows={3}
          />
          <div style={S.cmdRow}>
            <div style={S.phase}>
              {busy && <span style={S.spinner} />}
              {phaseLabel}
            </div>
            <button
              onClick={() => run()}
              disabled={busy || !brief.trim()}
              style={{ ...S.button, ...(busy || !brief.trim() ? S.buttonOff : {}) }}
            >
              {busy ? "Working…" : "Dispatch ▸"}
            </button>
          </div>
          <div style={S.chips}>
            {EXAMPLES[exKey].map((ex, i) => (
              <button key={i} onClick={() => setBrief(ex)} disabled={busy} style={S.chip}>
                {ex}
              </button>
            ))}
          </div>
        </section>

        {/* Feed */}
        {(Object.keys(runs).length > 0 || error) && (
          <section ref={feedRef as any} style={S.feed}>
            {error && <div style={S.error}>⚠ {error}</div>}
            {activeMgrs.map((id) => {
              const r = runs[id];
              const mgr = MANAGERS[id];
              if (!r) return null;
              return (
                <div key={id} style={S.divisionBlock}>
                  <div style={S.divHeader}>
                    {mgr.glyph} {mgr.name} · {mgr.division}
                  </div>
                  {r.plan?.length > 0 && (
                    <div style={S.dispatch}>
                      <span style={S.dispatchLabel}>dispatched</span>{" "}
                      {r.plan.map((p, i) => {
                        const a = ALL_AGENTS.find((x) => x.id === p.agent);
                        return (
                          <span key={i} style={S.tag}>
                            {a?.glyph} {a?.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {(r.results || []).map((res, i) => {
                    const key = id + i;
                    const isOpen = open[key] ?? false;
                    return (
                      <div
                        key={key}
                        style={{ ...S.resultCard, ...(res.social ? S.socialCard : {}) }}
                      >
                        <button
                          onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                          style={S.resultHead}
                        >
                          <span style={S.resGlyph}>{res.glyph}</span>
                          <span style={S.resName}>{res.name}</span>
                          <span style={S.resRole}>{res.role}</span>
                          {res.social && <span style={S.socialBadge}>SOCIAL DRAFTS</span>}
                          <span style={S.caret}>{isOpen ? "▾" : "▸"}</span>
                        </button>
                        {isOpen && (
                          <div style={S.resultBody}>
                            <div style={S.taskNote}>Task · {res.task}</div>
                            <Markdown text={res.output} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {r.report && (
                    <div style={S.reportCard}>
                      <div style={S.reportHead}>
                        <span style={S.glyph}>{mgr.glyph}</span>
                        <span style={S.resName}>Report from {mgr.name}</span>
                        <span style={S.toYou}>→ to You</span>
                      </div>
                      <div style={S.reportBody}>
                        <Markdown text={r.report} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Content Calendar */}
        <div style={S.bar}>
          <button onClick={() => setCalOpen((o) => !o)} style={S.barToggle}>
            <span style={{ color: "var(--gold)" }}>✦</span> Content calendar{" "}
            <span style={{ color: "var(--dim)", fontSize: 11 }}>
              — Lyra schedules your social posts
            </span>
            {calendar.length > 0 && (
              <span style={S.calCount}>
                {postedCount}/{calendar.length} posted
              </span>
            )}
            <span style={{ marginLeft: calendar.length ? 10 : "auto", color: "var(--dim)" }}>
              {calOpen ? "▾" : "▸"}
            </span>
          </button>
          {calOpen && (
            <div style={{ padding: "0 14px 16px" }}>
              <div style={S.calControls}>
                <input
                  value={calGoal}
                  onChange={(e) => setCalGoal(e.target.value)}
                  placeholder="Theme / goal (e.g. launch net-worth tracking)"
                  style={S.calInput}
                />
                <div style={S.calRow}>
                  <span style={S.calLabel}>Days</span>
                  {[3, 5, 7].map((d) => (
                    <button
                      key={d}
                      onClick={() => setCalDays(d)}
                      style={{ ...S.pill, ...(calDays === d ? S.pillOn : {}) }}
                    >
                      {d}
                    </button>
                  ))}
                  <span style={{ ...S.calLabel, marginLeft: 10 }}>Platforms</span>
                  {Object.keys(PLAT).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCalPlatforms((s) => ({ ...s, [p]: !s[p] }))}
                      style={{
                        ...S.pill,
                        ...(calPlatforms[p]
                          ? { ...S.pillOn, borderColor: PLAT[p], color: PLAT[p] }
                          : {}),
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div style={S.calRow}>
                  <button
                    onClick={generateCalendar}
                    disabled={calBusy}
                    style={{ ...S.button, ...(calBusy ? S.buttonOff : {}) }}
                  >
                    {calBusy ? "Drafting…" : calendar.length ? "Regenerate ✦" : "Generate ✦"}
                  </button>
                  {calendar.length > 0 && (
                    <button onClick={clearCalendar} style={S.ghostBtn}>
                      Clear
                    </button>
                  )}
                  {calBusy && <span style={S.spinner} />}
                </div>
                {calErr && <div style={S.error}>⚠ {calErr}</div>}
              </div>

              {calDaysList.map((d) => (
                <div key={d} style={S.dayBlock}>
                  <div style={S.dayLabel}>DAY {d}</div>
                  {calendar
                    .filter((p) => p.day === d)
                    .map((p) => (
                      <div key={p.id} style={{ ...S.postCard, ...(p.posted ? S.postDone : {}) }}>
                        <div style={S.postTop}>
                          <span
                            style={{
                              ...S.platBadge,
                              color: PLAT[p.platform],
                              borderColor: PLAT[p.platform],
                            }}
                          >
                            {p.platform}
                          </span>
                          {p.hook && <span style={S.postHook}>{p.hook}</span>}
                          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                            <button onClick={() => copyPost(p)} style={S.tinyBtn}>
                              {copied === p.id ? "Copied ✓" : "Copy"}
                            </button>
                            <button
                              onClick={() => togglePosted(p.id)}
                              style={{ ...S.tinyBtn, ...(p.posted ? S.tinyOn : {}) }}
                            >
                              {p.posted ? "Posted ✓" : "Mark posted"}
                            </button>
                          </div>
                        </div>
                        <div style={S.postBody}>{p.post}</div>
                        {p.hashtags && <div style={S.postTags}>{p.hashtags}</div>}
                        {!p.posted && (
                          <div style={S.schedRow}>
                            <input
                              type="datetime-local"
                              value={schedTime[p.id] || ""}
                              onChange={(e) =>
                                setSchedTime((s) => ({ ...s, [p.id]: e.target.value }))
                              }
                              style={S.schedInput}
                            />
                            <button onClick={() => schedulePost(p.id)} style={S.tinyBtn}>
                              Schedule
                            </button>
                            {p.status === "scheduled" && p.scheduled_at && (
                              <span style={S.schedBadge}>
                                Scheduled ✓ {new Date(p.scheduled_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ))}
              {calendar.length > 0 && (
                <div style={S.hint}>
                  Saved to your database. Copy-paste to publish — auto-posting comes in Step 5.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Memory */}
        {memory.length > 0 && (
          <section style={S.memory}>
            <div style={S.memHeadRow}>
              <span style={S.memHead}>⟳ MEMORY · CRM</span>
              <button onClick={clearMemory} style={S.ghostBtn}>
                Clear
              </button>
            </div>
            {memory
              .slice()
              .reverse()
              .map((m, i) => (
                <div key={i} style={S.memRow}>
                  <span style={S.memTime}>{m.at}</span>
                  <span style={S.memDiv}>{m.divisions}</span>
                  <span style={S.memBrief}>{m.brief}</span>
                </div>
              ))}
            <div style={S.hint}>Persisted in Postgres. The org references this on every brief.</div>
          </section>
        )}

        <footer style={S.footer}>
          Pick a division → brief the manager → specialists run server-side in parallel → reports
          return to you. Everything saves to your database. ⌘/Ctrl + Enter to dispatch.
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
:root{--bg:#0B0A07;--panel:#14110B;--panel2:#1B170F;--line:#2A2418;--gold:#C9A227;--gold-bright:#EBCB6B;--text:#EFE8D7;--muted:#A99C86;--dim:#6B6253;--ok:#74C49A;}
*{box-sizing:border-box;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
textarea::placeholder,input::placeholder{color:var(--dim);}
textarea:focus,input:focus{outline:none;border-color:var(--gold)!important;}
button{cursor:pointer;font-family:inherit;}
::-webkit-scrollbar{width:8px;}::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px;}
`;

const S: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Hanken Grotesk',sans-serif",
    background:
      "radial-gradient(1200px 500px at 80% -10%, rgba(201,162,39,.10), transparent 60%), var(--bg)",
    color: "var(--text)",
    minHeight: "100%",
    padding: "26px 16px 40px",
  },
  shell: { maxWidth: 880, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1px solid var(--line)",
    paddingBottom: 16,
    marginBottom: 18,
  },
  kicker: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "3px",
    color: "var(--gold)",
    marginBottom: 6,
  },
  wordmark: {
    fontFamily: "Fraunces,serif",
    fontWeight: 500,
    fontSize: 34,
    margin: 0,
    letterSpacing: ".5px",
  },
  sub: { fontSize: 11.5, color: "var(--dim)", marginTop: 4, fontFamily: "'Space Mono',monospace" },
  reportsTo: { textAlign: "right" },
  reportsLabel: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 9,
    letterSpacing: "2px",
    color: "var(--dim)",
  },
  reportsYou: { fontFamily: "Fraunces,serif", fontSize: 22, color: "var(--text)", marginTop: 2 },
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
  calCount: {
    marginLeft: "auto",
    fontFamily: "'Space Mono',monospace",
    fontSize: 10.5,
    color: "var(--ok)",
  },
  mono: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--text)",
    padding: "12px 14px",
    fontSize: 12.5,
    fontFamily: "'Space Mono',monospace",
    lineHeight: 1.6,
    resize: "vertical",
  },
  hint: { fontSize: 11, color: "var(--dim)", marginTop: 8 },
  tabs: { display: "flex", gap: 8, marginBottom: 18 },
  tab: {
    flex: 1,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 10,
    padding: "10px 0",
    fontSize: 13,
    fontWeight: 600,
  },
  tabOn: {
    background: "linear-gradient(180deg,var(--panel2),var(--panel))",
    borderColor: "var(--gold)",
    color: "var(--gold-bright)",
  },
  org: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 22 },
  directorCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(180deg,var(--panel2),var(--panel))",
    border: "1px solid var(--line)",
    borderRadius: 14,
    padding: "15px 17px",
  },
  dirLeft: { display: "flex", alignItems: "center", gap: 13 },
  cardLive: {
    borderColor: "var(--gold)",
    boxShadow: "0 0 0 1px rgba(201,162,39,.35), 0 8px 30px -12px rgba(201,162,39,.4)",
  },
  glyphBig: { fontSize: 24, color: "var(--gold-bright)", width: 32, textAlign: "center" },
  glyph: { fontSize: 17, color: "var(--gold)", width: 22, textAlign: "center", flexShrink: 0 },
  agentName: { fontFamily: "Fraunces,serif", fontSize: 17, color: "var(--text)" },
  agentName2: { fontFamily: "Fraunces,serif", fontSize: 15, color: "var(--text)" },
  agentRole: { fontSize: 11, color: "var(--muted)", letterSpacing: ".3px" },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    animation: "pulse 1.6s infinite",
  },
  connector: { width: 1, height: 16, background: "var(--line)", margin: "0 auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9 },
  agentCard: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 11,
    padding: "11px 12px",
    transition: "all .25s ease",
  },
  command: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  cmdLabel: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "2px",
    color: "var(--gold)",
    marginBottom: 10,
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
  ghostBtn: {
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12.5,
  },
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
  feed: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxHeight: 620,
    overflowY: "auto",
    paddingRight: 4,
    marginBottom: 16,
  },
  error: {
    background: "rgba(180,60,40,.12)",
    border: "1px solid rgba(180,60,40,.4)",
    color: "#E8A99a",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginTop: 8,
  },
  divisionBlock: { display: "flex", flexDirection: "column", gap: 10, animation: "rise .3s ease" },
  divHeader: {
    fontFamily: "Fraunces,serif",
    fontSize: 16,
    color: "var(--gold-bright)",
    borderBottom: "1px solid var(--line)",
    paddingBottom: 6,
  },
  dispatch: { fontSize: 13, color: "var(--muted)" },
  dispatchLabel: { color: "var(--gold-bright)", fontFamily: "Fraunces,serif" },
  tag: {
    display: "inline-block",
    background: "var(--panel2)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    padding: "2px 8px",
    margin: "0 4px 4px 0",
    fontSize: 12,
    color: "var(--text)",
  },
  resultCard: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    overflow: "hidden",
  },
  socialCard: { borderColor: "rgba(201,123,167,.35)" },
  resultHead: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "transparent",
    border: "none",
    padding: "13px 15px",
    color: "var(--text)",
  },
  resGlyph: { fontSize: 16, color: "var(--gold)" },
  resName: { fontFamily: "Fraunces,serif", fontSize: 15 },
  resRole: { fontSize: 11, color: "var(--muted)" },
  socialBadge: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 9,
    letterSpacing: "1px",
    color: "#C97BA7",
    border: "1px solid rgba(201,123,167,.4)",
    borderRadius: 5,
    padding: "2px 6px",
  },
  caret: { marginLeft: "auto", color: "var(--dim)" },
  resultBody: { padding: "0 16px 16px", borderTop: "1px solid var(--line)", paddingTop: 12 },
  taskNote: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10.5,
    color: "var(--dim)",
    marginBottom: 10,
  },
  reportCard: {
    background: "linear-gradient(180deg,rgba(201,162,39,.06),var(--panel))",
    border: "1px solid var(--gold)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 12px 40px -18px rgba(201,162,39,.5)",
  },
  reportHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px",
    borderBottom: "1px solid var(--line)",
  },
  toYou: {
    marginLeft: "auto",
    fontFamily: "'Space Mono',monospace",
    fontSize: 11,
    color: "var(--gold-bright)",
  },
  reportBody: { padding: 16 },
  calControls: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 },
  calInput: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--text)",
    padding: "10px 14px",
    fontSize: 13.5,
    fontFamily: "inherit",
  },
  calRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  calLabel: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "1px",
    color: "var(--dim)",
    marginRight: 2,
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
  dayBlock: { marginTop: 14 },
  dayLabel: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "2px",
    color: "var(--gold)",
    marginBottom: 8,
    borderBottom: "1px solid var(--line)",
    paddingBottom: 4,
  },
  postCard: {
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: 11,
    padding: "12px 14px",
    marginBottom: 8,
  },
  postDone: { opacity: 0.55, borderColor: "rgba(116,196,154,.4)" },
  postTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  platBadge: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 9.5,
    letterSpacing: "1px",
    border: "1px solid",
    borderRadius: 5,
    padding: "2px 7px",
  },
  postHook: { fontFamily: "Fraunces,serif", fontSize: 13.5, color: "var(--text)" },
  postBody: { fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55, whiteSpace: "pre-wrap" },
  postTags: { fontSize: 12, color: "var(--gold)", marginTop: 8 },
  schedRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
  schedInput: {
    background: "var(--panel2)",
    border: "1px solid var(--line)",
    color: "var(--text)",
    borderRadius: 7,
    padding: "4px 8px",
    fontSize: 11.5,
    fontFamily: "inherit",
    colorScheme: "dark",
  },
  schedBadge: { fontSize: 11, color: "var(--gold)" },
  tinyBtn: {
    background: "var(--panel2)",
    border: "1px solid var(--line)",
    color: "var(--muted)",
    borderRadius: 7,
    padding: "4px 9px",
    fontSize: 11,
  },
  tinyOn: { color: "var(--ok)", borderColor: "rgba(116,196,154,.4)" },
  memory: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  memHeadRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  memHead: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10,
    letterSpacing: "2px",
    color: "var(--gold)",
  },
  memRow: {
    display: "flex",
    gap: 10,
    alignItems: "baseline",
    padding: "6px 0",
    borderTop: "1px solid var(--line)",
    fontSize: 12.5,
  },
  memTime: {
    fontFamily: "'Space Mono',monospace",
    fontSize: 10.5,
    color: "var(--dim)",
    flexShrink: 0,
  },
  memDiv: { color: "var(--gold-bright)", flexShrink: 0, fontSize: 11 },
  memBrief: { color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  footer: { fontSize: 11.5, color: "var(--dim)", textAlign: "center", lineHeight: 1.5 },
};
