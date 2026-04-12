"use client";

import { useEffect, useState } from "react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { useSession } from "@/lib/use-session";

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
      setError(err instanceof Error ? err.message : "Could not continue with email.");
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
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-[#587176]">Loading Explrd...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-[calc(env(safe-area-inset-top)+20px)] text-[#13252a] sm:px-6">
      <main className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-5xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(241,249,248,0.92))] p-6 shadow-[0_34px_80px_rgba(7,44,52,0.12)] backdrop-blur sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c5dddb] bg-white/82 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d6a6f]">
            Explrd
          </div>
          <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-[#13252a]">
            Your travel map should open on the world, not on clutter.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#607a7f]">
            Sign in and go straight to a map-first, mobile-first tracker for the places you have explored. Add places, see your coverage, share the result.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[26px] border border-[#d0e2df] bg-white/82 px-4 py-4">
              <div className="text-sm font-semibold text-[#13252a]">Map first</div>
              <p className="mt-2 text-sm leading-6 text-[#607a7f]">Open directly to an interactive world map with your explored countries highlighted.</p>
            </div>
            <div className="rounded-[26px] border border-[#d0e2df] bg-white/82 px-4 py-4">
              <div className="text-sm font-semibold text-[#13252a]">Useful stats</div>
              <p className="mt-2 text-sm leading-6 text-[#607a7f]">See how many cities, states, countries, and continents you have covered.</p>
            </div>
            <div className="rounded-[26px] border border-[#d0e2df] bg-white/82 px-4 py-4">
              <div className="text-sm font-semibold text-[#13252a]">Share simply</div>
              <p className="mt-2 text-sm leading-6 text-[#607a7f]">Publish a clean profile link for friends when you are ready.</p>
            </div>
          </div>
        </section>

        <section className="flex rounded-[34px] border border-white/75 bg-white/88 p-5 shadow-[0_34px_80px_rgba(7,44,52,0.1)] backdrop-blur sm:p-6">
          <div className="my-auto w-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d6a6f]">Access</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#13252a]">
                  {mode === "login" ? "Welcome back" : "Create your map"}
                </h2>
              </div>
              <div className="rounded-full border border-[#d3e4e2] bg-[#f7fbfb] p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    mode === "login" ? "bg-[#13252a] text-white" : "text-[#607a7f]"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    mode === "signup" ? "bg-[#13252a] text-white" : "text-[#607a7f]"
                  }`}
                >
                  Sign up
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full rounded-full bg-[#13252a] px-4 py-3.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                Continue with Google
              </button>

              <div className="relative text-center">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#d9e7e5]" />
                <span className="relative bg-white px-3 text-xs uppercase tracking-[0.2em] text-[#688388]">or use email</span>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-[#38555b]">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-[24px] border border-[#d0e2df] bg-[#f7fbfb] px-4 py-3.5 text-sm text-[#13252a] outline-none transition focus:border-[#8fb2b0] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#38555b]">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="mt-2 w-full rounded-[24px] border border-[#d0e2df] bg-[#f7fbfb] px-4 py-3.5 text-sm text-[#13252a] outline-none transition focus:border-[#8fb2b0] focus:bg-white"
                />
              </label>

              {error ? (
                <div className="rounded-[24px] border border-[#efc6b8] bg-[#fff0ea] px-4 py-4 text-sm text-[#8a4a32]">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleEmailSubmit}
                disabled={submitting || !email.trim() || !password.trim()}
                className="w-full rounded-full border border-[#d0e2df] bg-white px-4 py-3.5 text-sm font-medium text-[#38555b] transition hover:bg-[#f7fbfb] disabled:opacity-60"
              >
                {submitting ? "Working..." : mode === "signup" ? "Create account" : "Sign in with email"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
