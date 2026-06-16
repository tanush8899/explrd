import { NextResponse } from "next/server";
import { validateUsername } from "@explrd/shared";
import { getAuthedUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";

/**
 * GET /api/username-available?u=<handle>
 * Returns { available, reason? }. The caller's own current username counts as
 * available so editing your profile without changing the handle isn't blocked.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;

    const raw = new URL(req.url).searchParams.get("u") ?? "";
    const check = validateUsername(raw);
    if (!check.ok) {
      return NextResponse.json({ available: false, reason: check.reason });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("username", check.value)
      .maybeSingle<{ user_id: string }>();

    if (error) {
      return NextResponse.json(
        { error: "username_check_failed", details: error.message },
        { status: 500 },
      );
    }

    const taken = Boolean(data) && data!.user_id !== user.id;
    return NextResponse.json(
      taken
        ? { available: false, reason: "That username is taken." }
        : { available: true },
    );
  } catch (e) {
    return serverError(e);
  }
}
