// Server-only Resend client.
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
let client: Resend | null = null;

export function hasResend(): boolean {
  return Boolean(apiKey);
}

export function getResend(): Resend {
  if (!apiKey) throw new Error("RESEND_API_KEY is not set. Add it to .env.local.");
  if (!client) client = new Resend(apiKey);
  return client;
}

// Verified sending identity (set after you verify your domain in Resend).
export const FROM = process.env.RESEND_FROM || "Aureus Plutus <noreply@aureusplutus.app>";
