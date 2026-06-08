// POST /api/moves/adapt  body: { source, platforms[] }  -> { moves }
// One idea/post -> a native version per platform, dropped into the Cockpit (2b).
import { type NextRequest } from "next/server";
import { ask, hasAnthropicKey } from "@/lib/anthropic";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { platformAdaptSys } from "@/lib/agents";
import { loadProfile, rowToMove, type Move } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORMS = ["Reddit", "Instagram", "LinkedIn", "TikTok", "YouTube", "X"];

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const source = String(body?.source ?? "").trim();
  const platforms: string[] = Array.isArray(body?.platforms)
    ? body.platforms.filter((p: string) => PLATFORMS.includes(p))
    : [];
  if (!source) return Response.json({ error: "Paste a post or idea to adapt." }, { status: 400 });
  if (!platforms.length) return Response.json({ error: "Pick at least one platform." }, { status: 400 });
  if (!hasAnthropicKey()) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }

  const profile = await loadProfile();

  let drafts: { community: string; angle: string; text: string }[];
  try {
    drafts = await Promise.all(
      platforms.map(async (platform) => {
        const text = await ask(
          platformAdaptSys(profile),
          `Platform: ${platform}\nSource idea/post:\n"""\n${source}\n"""\n\nAdapt it for ${platform}.`,
        );
        return { community: platform, angle: "Adapted from your idea", text };
      }),
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || "Adaptation failed." }, { status: 500 });
  }

  if (isDbConfigured()) {
    try {
      const db = getDb();
      const { data, error } = await db
        .from("moves")
        .insert(drafts.map((d) => ({ directive: "Platform adaptation", ...d, status: "draft", source: "adapt" })))
        .select();
      if (!error && data) return Response.json({ moves: data.map(rowToMove), persisted: true });
      if (error) console.error("[moves/adapt] persist failed:", error.message);
    } catch (e: any) {
      console.error("[moves/adapt] persist failed:", e?.message);
    }
  }

  const moves: Move[] = drafts.map((d, i) => ({
    id: `${Date.now()}-${i}`,
    directive: "Platform adaptation",
    community: d.community,
    angle: d.angle,
    text: d.text,
    status: "draft",
    source: "adapt",
    source_url: null,
    posted: false,
    posted_at: null,
    created_at: new Date().toISOString(),
  }));
  return Response.json({ moves, persisted: false });
}
