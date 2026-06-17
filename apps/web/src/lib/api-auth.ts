import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Resolve the bearer-token user behind an API request using the service-role
 * client (which then bypasses RLS for the actual queries). Mirrors the inline
 * helper used across the other /api routes, extracted so the friend routes can
 * share it.
 *
 * Returns either `{ response }` (a ready-to-return error) or `{ supabase, user }`.
 */
export async function getAuthedUser(
  req: Request,
): Promise<{ response: NextResponse } | { supabase: SupabaseClient; user: User }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return {
      response: NextResponse.json(
        {
          error: "missing_env",
          details: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 500 },
      ),
    };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { response: NextResponse.json({ error: "missing_token" }, { status: 401 }) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  const user = data.user ?? null;

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: "invalid_token", details: error?.message ?? "No user found" },
        { status: 401 },
      ),
    };
  }

  return { supabase, user };
}

/**
 * True when a Postgres/PostgREST error is "this column doesn't exist (yet)".
 * Lets routes that read/write a freshly-added column (e.g. profiles.avatar_url)
 * fall back to a query without it, so a not-yet-run migration or a stale
 * PostgREST schema cache can never break existing users.
 */
export function isMissingColumn(message: string | undefined, column: string): boolean {
  if (!message) return false;
  return (
    message.includes(column) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

/** Wrap an unknown thrown value into a 500 JSON response. */
export function serverError(e: unknown) {
  return NextResponse.json(
    { error: "server_exception", details: e instanceof Error ? e.message : String(e) },
    { status: 500 },
  );
}
