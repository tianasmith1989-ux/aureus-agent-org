// POST /api/venues/discover  body: { directive? }  -> { venues }
// Scout + web search researches a ranked venue map across ALL platforms (2a).
// Research only — no platform APIs. Appends to the venues table.
import { type NextRequest } from "next/server";
import { askWithWebSearch, hasAnthropicKey } from "@/lib/anthropic";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { venueScoutSys, parseArray } from "@/lib/agents";
import { loadProfile, rowToVenue, type Venue } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Web search makes this slow; give it room.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* optional body */
  }
  const directive = String(body?.directive ?? "").trim();
  if (!hasAnthropicKey()) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }

  const profile = await loadProfile();
  const prompt = directive
    ? `Research the best venues for this focus: "${directive}". Then return the ranked JSON array.`
    : `Research the best venues across all platforms for Aureus's value-first founder content. Then return the ranked JSON array.`;

  let parsed: any[];
  try {
    const out = await askWithWebSearch(venueScoutSys(profile), prompt, 4000);
    parsed = parseArray(out).filter((v: any) => v && v.name);
  } catch (e: any) {
    return Response.json({ error: e?.message || "Venue discovery failed." }, { status: 500 });
  }

  const norm = parsed.slice(0, 40).map((v: any, i: number) => ({
    platform: String(v.platform ?? ""),
    name: String(v.name ?? ""),
    link: String(v.link ?? ""),
    size: String(v.size ?? ""),
    fit: String(v.fit ?? ""),
    rules: String(v.rules ?? ""),
    angle: String(v.angle ?? ""),
    rank: i,
  }));

  if (isDbConfigured()) {
    try {
      const db = getDb();
      const { data, error } = await db.from("venues").insert(norm.map((n) => ({ ...n, status: "active" }))).select();
      if (!error && data) {
        return Response.json({ venues: data.map(rowToVenue), persisted: true });
      }
      if (error) console.error("[venues/discover] persist failed:", error.message);
    } catch (e: any) {
      console.error("[venues/discover] persist failed:", e?.message);
    }
  }

  const venues: Venue[] = norm.map((n, i) => ({
    id: `${Date.now()}-${i}`,
    ...n,
    status: "active",
    created_at: new Date().toISOString(),
  }));
  return Response.json({ venues, persisted: false });
}
