// Shared monitoring run: search Reddit + YouTube for active keywords, draft
// education-first replies into the Cockpit (moves) for human approval.
// READ-ONLY. Drafts only — nothing is ever posted automatically.
import { isDbConfigured, getDb } from "./supabase";
import { ask, hasAnthropicKey } from "./anthropic";
import { monitorReplySys } from "./agents";
import { loadProfile } from "./data";
import { hasReddit, searchReddit } from "./reddit";
import { hasYouTube, searchYouTube } from "./youtube";

const MAX_DRAFTS_PER_RUN = 12;

export interface MonitorResult {
  ok: boolean;
  drafted: number;
  scanned: number;
  note?: string;
}

export async function runMonitor(): Promise<MonitorResult> {
  if (!isDbConfigured()) return { ok: true, drafted: 0, scanned: 0, note: "DB not configured." };
  if (!hasAnthropicKey()) return { ok: true, drafted: 0, scanned: 0, note: "ANTHROPIC_API_KEY not set." };
  if (!hasReddit() && !hasYouTube()) {
    return { ok: true, drafted: 0, scanned: 0, note: "No Reddit or YouTube keys set." };
  }

  const db = getDb();
  const { data: kws } = await db
    .from("monitor_keywords")
    .select("keyword")
    .eq("active", true)
    .limit(20);
  const keywords = (kws ?? []).map((k: any) => String(k.keyword)).filter(Boolean);
  if (!keywords.length) return { ok: true, drafted: 0, scanned: 0, note: "No active keywords." };

  const profile = await loadProfile();
  let drafted = 0;
  let scanned = 0;

  for (const kw of keywords) {
    if (drafted >= MAX_DRAFTS_PER_RUN) break;

    const hits: { platform: string; title: string; context: string; url: string }[] = [];
    if (hasReddit()) {
      for (const r of await searchReddit(kw, 5)) {
        hits.push({ platform: r.subreddit, title: r.title, context: r.text, url: r.url });
      }
    }
    if (hasYouTube()) {
      for (const y of await searchYouTube(kw, 3)) {
        hits.push({ platform: "YouTube", title: y.title, context: y.description, url: y.url });
      }
    }

    for (const h of hits) {
      if (drafted >= MAX_DRAFTS_PER_RUN) break;
      scanned += 1;
      if (!h.url) continue;

      // Dedupe: skip threads/videos we've already drafted a reply for.
      const { data: exists } = await db
        .from("moves")
        .select("id")
        .eq("source_url", h.url)
        .maybeSingle();
      if (exists) continue;

      let text: string;
      try {
        text = await ask(
          monitorReplySys(profile),
          `Platform: ${h.platform}\nKeyword: ${kw}\nThread/Video title: ${h.title}\nContext:\n${h.context}\nLink: ${h.url}\n\nWrite a helpful, education-first reply to post here (or "SKIP" if it isn't a good fit).`,
        );
      } catch {
        continue;
      }
      if (!text || text.trim().toUpperCase() === "SKIP") continue;

      await db.from("moves").insert({
        directive: `Monitor: ${kw}`,
        community: h.platform,
        angle: `Reply to: ${h.title.slice(0, 80)}`,
        text,
        status: "draft",
        source: "monitor",
        source_url: h.url,
      });
      drafted += 1;
    }
  }

  return { ok: true, drafted, scanned };
}
