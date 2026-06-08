// Server-only Reddit Data API client (read-only, app-only OAuth).
// Free tier: OAuth required, ~100 queries/min, NON-COMMERCIAL use, app pre-approval
// required by Reddit. See README before enabling.
const ID = process.env.REDDIT_CLIENT_ID;
const SECRET = process.env.REDDIT_CLIENT_SECRET;
const UA = process.env.REDDIT_USER_AGENT || "aureus-cockpit/1.0 (monitoring)";

export function hasReddit(): boolean {
  return Boolean(ID && SECRET);
}

let token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!ID || !SECRET) return null;
  if (token && token.exp > Date.now()) return token.value;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${ID}:${SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "grant_type=client_credentials",
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j?.access_token) return null;
  token = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000 };
  return token.value;
}

export interface RedditHit {
  id: string;
  title: string;
  text: string;
  url: string;
  subreddit: string;
}

export async function searchReddit(keyword: string, limit = 5): Promise<RedditHit[]> {
  const t = await getToken();
  if (!t) return [];
  try {
    const res = await fetch(
      `https://oauth.reddit.com/search?q=${encodeURIComponent(keyword)}&sort=new&limit=${limit}&type=link`,
      { headers: { Authorization: `bearer ${t}`, "User-Agent": UA } },
    );
    const j: any = await res.json().catch(() => ({}));
    return (j?.data?.children ?? [])
      .map((c: any) => c?.data)
      .filter(Boolean)
      .map((d: any) => ({
        id: d.id,
        title: d.title ?? "",
        text: String(d.selftext ?? "").slice(0, 800),
        url: `https://www.reddit.com${d.permalink}`,
        subreddit: d.subreddit_name_prefixed || (d.subreddit ? `r/${d.subreddit}` : "Reddit"),
      }));
  } catch {
    return [];
  }
}
