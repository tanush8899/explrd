"use client";

import { useEffect, useState } from "react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { useSession } from "@/lib/use-session";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  const { loading, user } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      window.location.replace("/");
    }
  }, [loading, user]);

  async function handleEmailSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      window.location.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setError(null);

    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not continue with Google.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfc]">
        <div className="text-center">
          <div className="text-sm font-medium text-[#868c94]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafbfc] px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111214] text-sm font-bold tracking-wide text-white">
            Ex
          </div>
          <h1 className="mt-5 text-[1.7rem] font-semibold tracking-[-0.04em] text-[#111214]">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#868c94]">
            {mode === "login"
              ? "Sign in to continue to your travel map."
              : "Start tracking the places you've explored."}
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#e1e4e8] bg-white px-4 py-3 text-sm font-medium text-[#111214] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:bg-[#f8f9fa] disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="relative py-2">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#e8eaed]" />
            <div className="relative flex justify-center">
              <span className="bg-[#fafbfc] px-3 text-xs text-[#a0a5ab]">or</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#3d4249]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#e1e4e8] bg-white px-3.5 py-2.5 text-sm text-[#111214] shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-[#b0b5bb] focus:border-[#111214] focus:ring-1 focus:ring-[#111214]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#3d4249]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#e1e4e8] bg-white px-3.5 py-2.5 text-sm text-[#111214] shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-[#b0b5bb] focus:border-[#111214] focus:ring-1 focus:ring-[#111214]"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-[#f5c6c6] bg-[#fef2f2] px-3.5 py-3 text-sm text-[#b91c1c]">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleEmailSubmit}
            disabled={submitting || !email.trim() || !password.trim()}
            className="w-full rounded-xl bg-[#111214] px-4 py-2.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:bg-[#2a2d31] disabled:opacity-40"
          >
            {submitting ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-[#868c94]">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => setMode("signup")} className="font-medium text-[#111214] hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")} className="font-medium text-[#111214] hover:underline">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
