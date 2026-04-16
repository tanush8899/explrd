import { createSupabaseClient } from "@explrd/shared";

export const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { detectSessionInUrl: true } // web needs this for OAuth redirect parsing
);
