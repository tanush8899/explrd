import { supabase } from "@/lib/supabaseClient";

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // If email confirmation is enabled, Supabase returns a user with no session
  if (data.session === null && data.user?.identities?.length === 0) {
    throw new Error("An account with this email already exists.");
  }
  if (data.session === null) {
    throw new Error("Check your email to confirm your account before signing in.");
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}