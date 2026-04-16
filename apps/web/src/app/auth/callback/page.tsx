"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");

    if (errorParam) {
      setError(errorDescription ?? errorParam);
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError(error.message);
        } else {
          window.location.replace("/");
        }
      });
    } else {
      // Fallback for implicit flow — token may already be in hash
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          window.location.replace("/");
        } else {
          setError("Authentication failed. Please try again.");
        }
      });
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fafbfc] px-6">
        <p className="text-sm font-medium text-[#b91c1c]">Sign in failed: {error}</p>
        <a href="/login" className="text-sm font-medium text-[#111214] underline underline-offset-2">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] px-6">
      <p className="text-sm font-medium text-[#868c94]">Signing you in…</p>
    </div>
  );
}
