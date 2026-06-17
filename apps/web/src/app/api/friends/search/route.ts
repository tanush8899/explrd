import { NextResponse } from "next/server";
import { getAuthedUser, isMissingColumn, serverError } from "@/lib/api-auth";
import type { FriendSummary } from "@/lib/types";

export const runtime = "nodejs";

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/** Escape PostgREST `or`/`ilike` wildcards so a search term can't break the filter. */
function escapeLike(term: string): string {
  return term.replace(/[%,()]/g, " ").trim();
}

/**
 * GET /api/friends/search?q= → { results: FriendSummary[] }
 * Find people by name or @username so they can be added as friends. Only profiles
 * that have claimed a username are returned (those are the ones we can request).
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;

    const url = new URL(req.url);
    const q = escapeLike(url.searchParams.get("q") ?? "");
    if (q.length < 2) return NextResponse.json({ results: [] });

    const pattern = `%${q}%`;
    const runSearch = (columns: string) =>
      supabase
        .from("profiles")
        .select(columns)
        .or(
          [
            `username.ilike.${pattern}`,
            `display_name.ilike.${pattern}`,
            `first_name.ilike.${pattern}`,
            `last_name.ilike.${pattern}`,
          ].join(","),
        )
        .not("username", "is", null)
        .neq("user_id", user.id)
        .limit(10)
        .returns<ProfileRow[]>();

    let { data, error } = await runSearch(
      "user_id, username, display_name, first_name, last_name, avatar_url",
    );
    // avatar_url column not added yet → retry without it.
    if (error && isMissingColumn(error.message, "avatar_url")) {
      ({ data, error } = await runSearch(
        "user_id, username, display_name, first_name, last_name",
      ));
    }

    if (error) {
      return NextResponse.json(
        { error: "search_failed", details: error.message },
        { status: 500 },
      );
    }

    const results: FriendSummary[] = (data ?? []).map((p) => ({
      user_id: p.user_id,
      username: p.username,
      display_name: p.display_name,
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url ?? null,
    }));

    return NextResponse.json({ results });
  } catch (e) {
    return serverError(e);
  }
}
