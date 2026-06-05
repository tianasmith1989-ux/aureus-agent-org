// POST /api/calendar/generate -> { posts }
// body: { goal, days, platforms }
// Runs Lyra server-side to draft a content calendar; persists if DB configured.
import { type NextRequest } from "next/server";
import { ask, hasAnthropicKey } from "@/lib/anthropic";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { calendarSys, parseArray } from "@/lib/agents";
import { loadProfile, rowToPost, type CalendarPost } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORMS = ["LinkedIn", "X", "Instagram"];

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const goal = String(body?.goal ?? "").trim();
  const plats: string[] = Array.isArray(body?.platforms)
    ? body.platforms.filter((p: string) => PLATFORMS.includes(p))
    : [];
  if (!plats.length) {
    return Response.json({ error: "Pick at least one platform." }, { status: 400 });
  }
  const days = Math.max(1, Math.min(14, Number(body?.days) || 5));

  if (!hasAnthropicKey()) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const profile = await loadProfile();

  let arr: any[];
  try {
    const out = await ask(
      calendarSys(profile),
      `Create a ${days}-day social content calendar for Aureus Plutus. Platforms: ${plats.join(
        ", ",
      )}. Goal/theme: "${goal || "awareness and education"}". Include 1 post per selected platform per day. Vary angles across days (education, feature spotlight, tip, customer story, social proof). Number days 1..${days}.`,
    );
    arr = parseArray(out).filter((p: any) => p && p.post);
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to generate." }, { status: 500 });
  }

  const norm = arr.map((p: any) => ({
    day: Number(p.day) || 1,
    platform: plats.includes(p.platform) ? p.platform : plats[0],
    hook: p.hook || "",
    post: String(p.post),
    hashtags: p.hashtags || "",
  }));

  // Persist (replacing the prior calendar) if the DB is configured.
  if (isDbConfigured()) {
    try {
      const db = getDb();
      await db.from("calendar_posts").delete().not("id", "is", null);
      const { data } = await db
        .from("calendar_posts")
        .insert(norm.map((n) => ({ ...n, status: "draft" })))
        .select();
      return Response.json({ posts: (data ?? []).map(rowToPost) });
    } catch {
      // fall through to non-persisted response
    }
  }

  const posts: CalendarPost[] = norm.map((n, i) => ({
    id: `${Date.now()}-${i}`,
    ...n,
    posted: false,
  }));
  return Response.json({ posts });
}
