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
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  });
  return msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
}

// Model call WITH the server-side web_search tool (Anthropic runs the searches).
// Handles the server-tool pause_turn loop. Returns the final text content.
export async function askWithWebSearch(
  system: string,
  user: string,
  maxTokens = 3500,
): Promise<string> {
  const client = getClient();
  const tools = [{ type: "web_search_20250305" as const, name: "web_search" as const }];
  const messages: { role: "user" | "assistant"; content: any }[] = [
    { role: "user", content: user },
  ];

  let resp = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: maxTokens,
    system,
    tools,
    messages,
  });

  // The server tool loop can pause; re-send to let it continue.
  let guard = 0;
  while (resp.stop_reason === "pause_turn" && guard < 5) {
    messages.push({ role: "assistant", content: resp.content });
    resp = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: maxTokens,
      system,
      tools,
      messages,
    });
    guard += 1;
  }

  return resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
}
