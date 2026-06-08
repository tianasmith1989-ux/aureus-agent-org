// POST /api/monitor/run — manual "Run monitor now" (Clerk-gated by middleware).
import { runMonitor } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const result = await runMonitor();
  return Response.json(result);
}
