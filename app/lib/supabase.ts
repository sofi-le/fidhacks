// Browser Supabase client — the app talks to Supabase directly (cards, storage,
// auth). Row-Level Security on the backend scopes everything to the signed-in
// user, so the public anon key is safe to ship to the browser.
//
// Fill these in app/.env.local (see .env.local.example):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!url || !anon) {
  // Surfaced in the browser console — the login screen will also explain it.
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
      "Copy .env.local.example to .env.local and paste your project keys."
  );
}

// Fall back to harmless placeholders when unconfigured so createClient() doesn't
// throw at import time (e.g. during `next build`). The login screen reads
// hasSupabaseConfig and tells the user to add their keys; no calls are made.
export const supabase = createClient(url || "https://placeholder.supabase.co", anon || "placeholder", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const SUPABASE_URL = url;
export const hasSupabaseConfig = Boolean(url && anon);

// Public URL of an object in the card-art bucket (used for the seed images).
export function cardArtPublicUrl(path: string): string {
  return `${url}/storage/v1/object/public/card-art/${path}`;
}
