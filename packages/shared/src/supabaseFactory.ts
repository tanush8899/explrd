import { createClient } from "@supabase/supabase-js";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with platform-agnostic configuration.
 * Web passes no storage (defaults to localStorage via Supabase).
 * Mobile passes AsyncStorage.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: {
    storage?: SupportedStorage;
    detectSessionInUrl?: boolean;
  }
) {
  return createClient(url, anonKey, {
    auth: {
      storage: options?.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? false,
    },
  });
}
