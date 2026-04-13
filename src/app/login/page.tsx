"use client";

import { useEffect, useState } from "react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { useSession } from "@/lib/use-session";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginPage() {
  const { loading, user } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && email.trim() && password.trim() && !submitting) {
      handleEmailSubmit();
    }
  }

  if (loading) {
    return (
      <div className="h-screen overflow-hidden flex items-center justify-center bg-[#fafbfc]" style={{ height: "100dvh" }}>
        <span className="text-[13px] font-semibold tracking-[0.22em] uppercase text-[#111214]">Explrd</span>
      </div>
    );
  }

  return (
    <div
      className="h-screen overflow-hidden flex flex-col items-center justify-center bg-[#fafbfc] px-5"
      style={{ height: "100dvh" }}
    >
      {/* Wordmark */}
      <div className="mb-8 text-center">
        <span className="text-[13px] font-semibold tracking-[0.22em] uppercase text-[#111214]">
          Explrd
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[360px] rounded-[24px] bg-white px-8 py-8 shadow-[0_0_0_1px_rgba(0,0,0,0.055),0_4px_24px_rgba(0,0,0,0.07)]">
        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-[1.35rem] font-semibold tracking-[-0.035em] text-[#111214]">
            {mode === "login" ? "Welcome" : "Create account"}
          </h1>
          <p className="mt-1 text-[13.5px] leading-5 text-[#868c94]">
            {mode === "login"
              ? "Sign in to continue to your travel map."
              : "Start tracking the places you've explored."}
          </p>
        </div>

        <div className="space-y-3">
          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-[#e1e4e8] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#111214] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#f8f9fa] active:bg-[#f2f3f4] disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#ebebeb]" />
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-[#b0b5bb]">or</span>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#3d4249]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-[12px] border border-[#e1e4e8] bg-[#fafbfc] px-3.5 py-2.5 text-[13.5px] text-[#111214] outline-none transition placeholder:text-[#b0b5bb] focus:border-[#111214] focus:bg-white focus:ring-2 focus:ring-[#111214]/8"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#3d4249]">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full rounded-[12px] border border-[#e1e4e8] bg-[#fafbfc] px-3.5 py-2.5 pr-10 text-[13.5px] text-[#111214] outline-none transition placeholder:text-[#b0b5bb] focus:border-[#111214] focus:bg-white focus:ring-2 focus:ring-[#111214]/8"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a5ab] transition hover:text-[#3d4249]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon show={showPassword} />
              </button>
            </div>
          </div>

          {/* Error */}
          {error ? (
            <div className="rounded-[10px] border border-[#fca5a5]/60 bg-[#fef2f2] px-3.5 py-2.5 text-[13px] text-[#b91c1c]">
              {error}
            </div>
          ) : null}

          {/* Submit */}
          <button
            type="button"
            onClick={handleEmailSubmit}
            disabled={submitting || !email.trim() || !password.trim()}
            className="w-full rounded-[14px] bg-[#111214] px-4 py-2.5 text-[13.5px] font-medium text-white shadow-[0_1px_3px_rgba(0,0,0,0.16)] transition hover:bg-[#2a2d31] active:bg-[#1a1c1e] disabled:opacity-40"
          >
            {submitting
              ? mode === "signup" ? "Creating account..." : "Signing in..."
              : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <p className="mt-5 text-[13px] text-[#868c94]">
        {mode === "login" ? (
          <>
            New to Explrd?{" "}
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); }}
              className="font-medium text-[#111214] transition hover:underline"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className="font-medium text-[#111214] transition hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
