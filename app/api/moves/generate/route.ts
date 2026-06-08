// POST /api/moves/generate  body: { directive }  -> { moves }
// Founder Cockpit: Scout picks value-first channels, Echo/Aria draft each post
// in the founder's voice (education-only, compliant). Drafting only — no posting.
import { type NextRequest } from "next/server";
import { ask, hasAnthropicKey } from "@/lib/anthropic";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { founderScoutSys, founderCopySys, parseArray } from "@/lib/agents";
import { loadProfile, rowToMove, type Move } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const directive = String(body?.directive ?? "").trim();
  if (!directive) return Response.json({ error: "Missing directive." }, { status: 400 });
  if (!hasAnthropicKey()) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  const profile = await loadProfile();

  // 1. Scout chooses target communities/channels (or honours an explicit target).
  let targets: { community: string; angle: string }[];
  try {
    const scoutText = await ask(founderScoutSys(profile), `Founder directive:\n"${directive}"`);
    targets = parseArray(scoutText)
      .filter((t: any) => t && t.community)
      .slice(0, 5)
      .map((t: any) => ({ community: String(t.community), angle: String(t.angle ?? "") }));
  } catch (e: any) {
    return Response.json({ error: e?.message || "Channel selection failed." }, { status: 500 });
  }
  if (!targets.length) {
    targets = [{ community: "Your community", angle: directive }];
  }

  // 2. Echo/Aria draft one founder-voice post per target (in parallel).
  let drafts: { community: string; angle: string; text: string }[];
  try {
    drafts = await Promise.all(
      targets.map(async (t) => {
        const text = await ask(
          founderCopySys(profile),
          `Community: ${t.community}\nAngle: ${t.angle}\nFounder directive: "${directive}"\n\nWrite the post.`,
        );
        return { community: t.community, angle: t.angle, text };
      }),
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || "Drafting failed." }, { status: 500 });
  }

  // 3. Persist as drafts (best-effort; fall back to temp ids if DB unreachable).
  if (isDbConfigured()) {
    try {
      const db = getDb();
      const { data, error } = await db
        .from("moves")
        .insert(drafts.map((d) => ({ directive, ...d, status: "draft" })))
        .select();
      if (!error && data) {
        return Response.json({ moves: data.map(rowToMove), persisted: true });
      }
      if (error) console.error("[moves/generate] persist failed:", error.message);
    } catch (e: any) {
      console.error("[moves/generate] persist failed:", e?.message);
    }
  }

  const moves: Move[] = drafts.map((d, i) => ({
    id: `${Date.now()}-${i}`,
    directive,
    community: d.community,
    angle: d.angle,
    text: d.text,
    status: "draft",
    posted: false,
    posted_at: null,
    created_at: new Date().toISOString(),
  }));
  return Response.json({ moves, persisted: false });
}
