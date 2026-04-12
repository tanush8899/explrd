import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/types";

type ProfileBody = {
  display_name?: string;
  public_slug?: string;
  bio?: string;
  is_public?: boolean;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function defaultDisplayName(email: string | null | undefined) {
  if (!email) return "Explrd Traveler";
  return email.split("@")[0] || "Explrd Traveler";
}

async function getAuthedUser(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return {
      response: NextResponse.json(
        {
          error: "missing_env",
          details: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 500 }
      ),
    };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return {
      response: NextResponse.json({ error: "missing_token" }, { status: 401 }),
    };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData.user ?? null;

  if (userErr || !user) {
    return {
      response: NextResponse.json(
        { error: "invalid_token", details: userErr?.message ?? "No user found" },
        { status: 401 }
      ),
    };
  }

  return { supabase, user };
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;

    const { supabase, user } = auth;

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, public_slug, bio, is_public, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle<UserProfile>();

    if (error) {
      return NextResponse.json(
        { error: "profile_query_failed", details: error.message },
        { status: 500 }
      );
    }

    const profile: UserProfile = data ?? {
      user_id: user.id,
      display_name: defaultDisplayName(user.email),
      public_slug: null,
      bio: null,
      is_public: false,
      created_at: null,
      updated_at: null,
    };

    return NextResponse.json({ profile });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "server_exception",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;

    const { supabase, user } = auth;
    const body = (await req.json()) as ProfileBody;

    const displayName = body.display_name?.trim() ?? "";
    const bio = body.bio?.trim() ?? "";
    const isPublic = Boolean(body.is_public);
    const publicSlug = normalizeSlug(body.public_slug ?? "");

    if (!displayName) {
      return NextResponse.json(
        { error: "bad_request", details: "Display name is required." },
        { status: 400 }
      );
    }

    if (isPublic && !publicSlug) {
      return NextResponse.json(
        { error: "bad_request", details: "A public username is required to make a profile public." },
        { status: 400 }
      );
    }

    if (publicSlug) {
      const { data: existingProfile, error: slugErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("public_slug", publicSlug)
        .maybeSingle<{ user_id: string }>();

      if (slugErr) {
        return NextResponse.json(
          { error: "slug_check_failed", details: slugErr.message },
          { status: 500 }
        );
      }

      if (existingProfile && existingProfile.user_id !== user.id) {
        return NextResponse.json(
          { error: "slug_taken", details: "That public username is already in use." },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          display_name: displayName,
          public_slug: publicSlug || null,
          bio: bio || null,
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("user_id, display_name, public_slug, bio, is_public, created_at, updated_at")
      .single<UserProfile>();

    if (error) {
      return NextResponse.json(
        { error: "profile_upsert_failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "server_exception",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
