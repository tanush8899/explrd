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
    <div className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-[#587176]">Signing you in...</p>
    </div>
  );
}
