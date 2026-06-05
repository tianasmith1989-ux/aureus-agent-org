// Server-only Ayrshare client (one API for LinkedIn / X / Instagram).
const KEY = process.env.AYRSHARE_API_KEY;

export function hasAyrshare(): boolean {
  return Boolean(KEY);
}

// Map our platform labels to Ayrshare's identifiers.
const PLATFORM_MAP: Record<string, string> = {
  LinkedIn: "linkedin",
  X: "twitter",
  Instagram: "instagram",
};

export function toAyrsharePlatform(platform: string): string | null {
  return PLATFORM_MAP[platform] ?? null;
}

export async function publishToAyrshare(
  text: string,
  platforms: string[],
): Promise<{ ok: boolean; id?: string | null; error?: string }> {
  if (!KEY) return { ok: false, error: "AYRSHARE_API_KEY is not set." };
  try {
    const res = await fetch("https://api.ayrshare.com/api/post", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ post: text, platforms }),
    });
    const out: any = await res.json().catch(() => ({}));
    if (!res.ok || out?.status === "error") {
      return { ok: false, error: out?.message || out?.errors?.[0]?.message || `Ayrshare ${res.status}` };
    }
    const id = out.id ?? out.postIds?.[0]?.id ?? null;
    return { ok: true, id };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Ayrshare request failed." };
  }
}
