// GET    /api/memory -> { memory: [{ brief, divisions, gist, at }] }
// DELETE /api/memory -> { ok }
import { isDbConfigured, getDb } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export async function GET() {
  if (!isDbConfigured()) return Response.json({ memory: [] });
  try {
    const { data } = await getDb()
      .from("briefs")
      .select("directive,divisions,gist,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const memory = (data ?? [])
      .map((r: any) => ({
        brief: r.directive,
        divisions: r.divisions ?? "",
        gist: r.gist ?? "",
        at: fmt(r.created_at),
      }))
      // The UI reverses to show newest last, matching the prototype's ordering.
      .reverse();
    return Response.json({ memory });
  } catch (e: any) {
    return Response.json({ memory: [], error: e?.message });
  }
}

export async function DELETE() {
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    await getDb().from("briefs").delete().not("id", "is", null);
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to clear memory." }, { status: 500 });
  }
}
