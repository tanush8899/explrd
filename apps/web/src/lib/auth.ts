import {
  signUpWithEmail as _signUpWithEmail,
  signInWithEmail as _signInWithEmail,
  signOut as _signOut,
} from "@explrd/shared";
import { supabase } from "@/lib/supabaseClient";

// Bind the shared functions to the web supabase client
// so existing imports across the web app are unchanged.
export const signUpWithEmail = (email: string, password: string) =>
  _signUpWithEmail(supabase, email, password);

export const signInWithEmail = (email: string, password: string) =>
  _signInWithEmail(supabase, email, password);

export const signOut = () => _signOut(supabase);

// Web-specific Google OAuth (uses browser redirect)
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}
