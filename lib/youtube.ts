// Server-only YouTube Data API v3 client (read-only).
// Free within quota: 10,000 units/day per project; search.list costs 100 units.
const KEY = process.env.YOUTUBE_API_KEY;

export function hasYouTube(): boolean {
  return Boolean(KEY);
}

export interface YouTubeHit {
  videoId: string;
  title: string;
  description: string;
  url: string;
}

export async function searchYouTube(keyword: string, max = 3): Promise<YouTubeHit[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        keyword,
      )}&type=video&order=date&maxResults=${max}&relevanceLanguage=en&key=${KEY}`,
    );
    const j: any = await res.json().catch(() => ({}));
    return (j?.items ?? [])
      .map((it: any) => ({
        videoId: it?.id?.videoId,
        title: it?.snippet?.title ?? "",
        description: String(it?.snippet?.description ?? "").slice(0, 500),
        url: `https://www.youtube.com/watch?v=${it?.id?.videoId}`,
      }))
      .filter((v: YouTubeHit) => v.videoId);
  } catch {
    return [];
  }
}
