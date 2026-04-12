"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    supabase.auth.getSession().finally(() => {
      window.location.replace("/");
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] px-6">
      <p className="text-sm font-medium text-[#868c94]">Signing you in...</p>
    </div>
  );
}
