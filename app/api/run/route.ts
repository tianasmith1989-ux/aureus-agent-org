// POST /api/run — the agent brain, server-side.
// Replaces the prototype's client-side orchestration. The Anthropic key never
// leaves the server. Each manager: plans -> dispatches specialists -> synthesizes.
import { type NextRequest } from "next/server";
import { ask, hasAnthropicKey } from "@/lib/anthropic";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { MANAGERS_META, ALL_AGENTS_META } from "@/lib/roster";
import { plannerSys, synthSys, agentSystem, parseArray } from "@/lib/agents";
import { loadProfile, loadPrior } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlanItem {
  agent: string;
  task: string;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const directive = String(body?.directive ?? "").trim();
  let divisions: string[] = Array.isArray(body?.divisions) ? body.divisions : [];
  divisions = divisions.filter((d) => d in MANAGERS_META);

  if (!directive) {
    return Response.json({ error: "Missing directive." }, { status: 400 });
  }
  if (!divisions.length) divisions = ["atlas"];

  if (!hasAnthropicKey()) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const profile = await loadProfile();
  const prior = await loadPrior();

  const reports: Record<string, any> = {};

  try {
    await Promise.all(
      divisions.map(async (id) => {
        const mgr = MANAGERS_META[id];

        // 1. Manager plans -> JSON of {agent, task}
        const ctx = prior ? `\n\nPRIOR CONTEXT (memory):\n${prior}` : "";
        const planText = await ask(
          plannerSys(mgr, profile),
          `Directive from your manager:\n"${directive}"${ctx}`,
        );
        let plan: PlanItem[] = parseArray(planText).filter(
          (p: any) => p && mgr.agents.some((a) => a.id === p.agent),
        );
        if (!plan.length) plan = [{ agent: mgr.agents[0].id, task: directive }];

        // 2. Specialists run in parallel
        const results = await Promise.all(
          plan.map(async (p) => {
            const meta = ALL_AGENTS_META.find((a) => a.id === p.agent)!;
            let output: string;
            try {
              output = await ask(agentSystem(p.agent, profile), p.task);
            } catch {
              output = "⚠ This agent hit an error and couldn't finish.";
            }
            return {
              agent: p.agent,
              task: p.task,
              name: meta.name,
              role: meta.role,
              glyph: meta.glyph,
              social: Boolean(meta.social),
              output,
            };
          }),
        );

        // 3. Manager synthesizes the report
        const synthInput =
          `Manager directive: "${directive}"\n\nSpecialists reported:\n\n` +
          results
            .map((r) => `## ${r.name} (${r.role})\nTask: ${r.task}\n\n${r.output}`)
            .join("\n\n---\n\n");
        const report = await ask(synthSys(mgr, profile), synthInput);

        reports[id] = {
          plan: plan.map((p) => ({ agent: p.agent, task: p.task })),
          results,
          report,
        };
      }),
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || "Agent run failed." }, { status: 500 });
  }

  // 4. Persist to memory (best-effort; never fails the run, but surface the
  //    error so a misconfigured DB / blocked host / RLS issue is visible).
  let persisted = false;
  let persistError: string | null = null;
  if (isDbConfigured()) {
    try {
      const gist = Object.entries(reports)
        .map(([id, r]: [string, any]) => {
          const firstLine =
            (r.report || "").split("\n").find((l: string) => l.trim())?.slice(0, 90) || "done";
          return `${MANAGERS_META[id].name}: ${firstLine}`;
        })
        .join(" | ");
      const { error } = await getDb().from("briefs").insert({
        directive,
        divisions: divisions.map((d) => MANAGERS_META[d].division).join(" + "),
        gist,
        report: reports,
      });
      if (error) persistError = error.message;
      else persisted = true;
    } catch (e: any) {
      persistError = e?.message || "persist failed";
    }
    if (persistError) console.error("[/api/run] brief persist failed:", persistError);
  }

  return Response.json({ reports, persisted, persistError });
}
