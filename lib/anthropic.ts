// Server-only Anthropic client. The API key lives ONLY here, never in the browser.
import Anthropic from "@anthropic-ai/sdk";

// Per the build kickoff: use Sonnet 4.6 for the high-volume agent calls.
export const AGENT_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart the dev server.",
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// One model call. Returns the concatenated text content.
export async function ask(system: string, user: string): Promise<string> {
  const msg = await getClient().messages.create({
    model: AGENT_MODEL,
    max_tokens: 1400,
    system,
    messages: [{ role: "user", content: user }],
  });
  return msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
}
