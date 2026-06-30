import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import {
  signUpWithEmail as _signUp,
  signInWithEmail as _signIn,
  signOut as _signOut,
  resetPasswordForEmail as _resetPassword,
  updatePassword as _updatePassword,
} from "@explrd/shared";
import { supabase } from "./supabaseClient";

// Required: dismisses the in-app browser tab when auth completes
WebBrowser.maybeCompleteAuthSession();

function appScheme(): string {
  const s = Constants.expoConfig?.scheme;
  return (Array.isArray(s) ? s[0] : s) ?? "explrd";
}

function authRedirectUri() {
  return makeRedirectUri({ scheme: appScheme(), path: "auth/callback" });
}

// Bind email fns to this platform's supabase client
export const signUpWithEmail = (email: string, password: string) =>
  _signUp(supabase, email, password);

export const signInWithEmail = (email: string, password: string) =>
  _signIn(supabase, email, password);

export const signOut = () => _signOut(supabase);

export function sendPasswordReset(email: string) {
  return _resetPassword(supabase, email, authRedirectUri());
}

export const updatePassword = (password: string) =>
  _updatePassword(supabase, password);

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
  const redirectUri = authRedirectUri();

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

export async function signInWithAppleNative() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign In did not return an identity token.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });

  if (error) throw error;

  // Apple only returns the user's name on the *first* authorization for this
  // Apple ID. Capture it now and persist it to the user's metadata so the rest
  // of the app (and onboarding) can use it — we must never ask the user to type
  // a name Apple has already given us (App Store Guideline 4 / Sign in with
  // Apple requirements).
  const given = credential.fullName?.givenName?.trim() || "";
  const family = credential.fullName?.familyName?.trim() || "";
  if (given || family) {
    const full = [given, family].filter(Boolean).join(" ");
    try {
      await supabase.auth.updateUser({
        data: {
          ...(given ? { first_name: given } : {}),
          ...(family ? { last_name: family } : {}),
          ...(full ? { full_name: full } : {}),
        },
      });
    } catch {
      // Non-fatal: the name is a convenience, not required to sign in.
    }
  }
}
