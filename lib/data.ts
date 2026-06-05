// Server-side data helpers shared across API routes.
import { isDbConfigured, getDb } from "./supabase";
import { COMPANY_DEFAULT } from "./agents";

// Load the grounding profile (from DB if configured, else the built-in default).
export async function loadProfile(): Promise<string> {
  if (!isDbConfigured()) return COMPANY_DEFAULT;
  try {
    const { data } = await getDb().from("company").select("profile").limit(1).maybeSingle();
    return data?.profile ?? COMPANY_DEFAULT;
  } catch {
    return COMPANY_DEFAULT;
  }
}

// Recent brief memory, formatted for the planner's prior-context block.
export async function loadPrior(): Promise<string> {
  if (!isDbConfigured()) return "";
  try {
    const { data } = await getDb()
      .from("briefs")
      .select("directive,gist")
      .order("created_at", { ascending: false })
      .limit(2);
    return (data ?? [])
      .map((m: any) => `• "${m.directive}" → ${m.gist ?? ""}`)
      .join("\n");
  } catch {
    return "";
  }
}

export interface CalendarPost {
  id: string;
  day: number;
  platform: string;
  hook: string;
  post: string;
  hashtags: string;
  posted: boolean;
  status: string;
  scheduled_at: string | null;
}

// Map a calendar_posts row to the client-facing post shape.
export function rowToPost(row: any): CalendarPost {
  return {
    id: String(row.id),
    day: Number(row.day) || 1,
    platform: row.platform,
    hook: row.hook ?? "",
    post: row.post ?? "",
    hashtags: row.hashtags ?? "",
    posted: row.status === "posted",
    status: row.status ?? "draft",
    scheduled_at: row.scheduled_at ?? null,
  };
}
