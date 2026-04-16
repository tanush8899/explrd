import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Platform-agnostic auth helpers.
 * Each function accepts the supabase client so neither web nor mobile
 * needs to share a singleton — they configure their own client.
 *
 * Google OAuth is platform-specific and lives in each app:
 *   apps/web/src/lib/auth.ts     → signInWithGoogle (browser redirect)
 *   apps/mobile/lib/auth.ts      → signInWithGoogleNative (expo-web-browser)
 */

export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.session === null && data.user?.identities?.length === 0) {
    throw new Error("An account with this email already exists.");
  }
  if (data.session === null) {
    throw new Error("Check your email to confirm your account before signing in.");
  }
}

export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
