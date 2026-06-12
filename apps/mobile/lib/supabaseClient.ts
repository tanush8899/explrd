import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSupabaseClient } from "@explrd/shared";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[Explrd] Missing Supabase environment variables.\n" +
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set.\n" +
      "Add them via: eas env:create --scope project"
  );
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  storage: AsyncStorage,
  detectSessionInUrl: false, // no URL in native context
});
