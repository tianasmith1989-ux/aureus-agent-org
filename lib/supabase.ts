// Server-only Supabase client using the service-role key.
// Never import this into client components.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isDbConfigured(): boolean {
  return Boolean(url && key);
}

let db: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  if (!db) db = createClient(url, key, { auth: { persistSession: false } });
  return db;
}
