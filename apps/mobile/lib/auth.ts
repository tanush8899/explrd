import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { signUpWithEmail as _signUp, signInWithEmail as _signIn, signOut as _signOut } from "@explrd/shared";
import { supabase } from "./supabaseClient";

// Required: dismisses the in-app browser tab when auth completes
WebBrowser.maybeCompleteAuthSession();

// Bind email fns to this platform's supabase client
export const signUpWithEmail = (email: string, password: string) =>
  _signUp(supabase, email, password);

export const signInWithEmail = (email: string, password: string) =>
  _signIn(supabase, email, password);

export const signOut = () => _signOut(supabase);

/**
 * Google OAuth for native iOS via expo-web-browser.
 * Opens Safari in-app, user signs in, Supabase redirects to explrd://auth/callback,
 * we parse the tokens from the URL fragment and set the session.
 *
 * Prerequisites:
 *   1. Google Cloud Console: iOS OAuth client with bundle ID com.explrd.app
 *   2. Supabase Dashboard → Auth → Redirect URLs: add explrd://auth/callback
 */
export async function signInWithGoogleNative() {
  const redirectUri = makeRedirectUri({
    scheme: "explrd",
    path: "auth/callback",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error("No OAuth URL returned from Supabase.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type !== "success") return; // user cancelled or error

  // Parse tokens from the redirect URL hash (Supabase implicit flow)
  const hash = new URL(result.url).hash.slice(1);
  const params: Record<string, string> = {};
  for (const pair of hash.split("&")) {
    const [key, value] = pair.split("=");
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
  }

  if (params.access_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token ?? "",
    });
    if (sessionError) throw sessionError;
  }
}
