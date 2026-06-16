import { NextResponse } from "next/server";
import { validateUsername } from "@explrd/shared";
import { getAuthedUser, serverError } from "@/lib/api-auth";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";

const PROFILE_COLUMNS =
  "user_id, username, first_name, last_name, display_name, public_slug, bio, is_public, created_at, updated_at";

type ProfileBody = {
  first_name?: string;
  last_name?: string;
  username?: string;
};

function defaultDisplayName(email: string | null | undefined) {
  if (!email) return "Explr Traveler";
  return email.split("@")[0] || "Explr Traveler";
}

function fullName(first: string, last: string, fallback: string) {
  const name = [first, last].map((s) => s.trim()).filter(Boolean).join(" ");
  return name || fallback;
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle<UserProfile>();

    if (error) {
      return NextResponse.json(
        { error: "profile_query_failed", details: error.message },
        { status: 500 },
      );
    }

    const profile: UserProfile = data ?? {
      user_id: user.id,
      username: null,
      first_name: null,
      last_name: null,
      display_name: defaultDisplayName(user.email),
      public_slug: null,
      bio: null,
      is_public: true,
      created_at: null,
      updated_at: null,
    };

    return NextResponse.json({ profile });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;

    const body = (await req.json()) as ProfileBody;
    const firstName = (body.first_name ?? "").trim();
    const lastName = (body.last_name ?? "").trim();

    if (!firstName) {
      return NextResponse.json(
        { error: "bad_request", details: "First name is required." },
        { status: 400 },
      );
    }

    const check = validateUsername(body.username ?? "");
    if (!check.ok) {
      return NextResponse.json(
        { error: "bad_username", details: check.reason },
        { status: 400 },
      );
    }
    const username = check.value;

    // Uniqueness — case-insensitive, excluding the caller's own row.
    const { data: existing, error: dupErr } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("username", username)
      .maybeSingle<{ user_id: string }>();

    if (dupErr) {
      return NextResponse.json(
        { error: "username_check_failed", details: dupErr.message },
        { status: 500 },
      );
    }
    if (existing && existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "username_taken", details: "That username is already taken." },
        { status: 409 },
      );
    }

    const displayName = fullName(firstName, lastName, defaultDisplayName(user.email));

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          username,
          first_name: firstName,
          last_name: lastName || null,
          display_name: displayName,
          // Mirror so existing /u/<slug> public pages keep resolving by handle.
          public_slug: username,
          is_public: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select(PROFILE_COLUMNS)
      .single<UserProfile>();

    if (error) {
      // Unique-violation race (two requests claimed the same handle at once).
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "username_taken", details: "That username is already taken." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "profile_upsert_failed", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile: data });
  } catch (e) {
    return serverError(e);
  }
}
