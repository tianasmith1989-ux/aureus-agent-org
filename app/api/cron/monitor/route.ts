// GET /api/cron/monitor — scheduled Reddit + YouTube monitoring.
// Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
import { type NextRequest } from "next/server";
import { runMonitor } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await runMonitor();
  return Response.json(result);
}
