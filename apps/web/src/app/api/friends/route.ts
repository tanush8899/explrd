import { NextResponse } from "next/server";
import { getAuthedUser, isMissingColumn, serverError } from "@/lib/api-auth";
import type { FriendSummary, FriendRequestSummary } from "@/lib/types";

export const runtime = "nodejs";

type RequestRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string | null;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/**
 * GET /api/friends → { friends, incoming, outgoing }
 * One pass over every request row involving the caller, with a single profiles
 * lookup for the "other" party in each.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;
    const me = user.id;

    const { data: rows, error } = await supabase
      .from("friend_requests")
      .select("id, requester_id, addressee_id, status, created_at")
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
      .returns<RequestRow[]>();

    if (error) {
      return NextResponse.json(
        { error: "friends_query_failed", details: error.message },
        { status: 500 },
      );
    }

    const list = rows ?? [];
    const otherOf = (r: RequestRow) => (r.requester_id === me ? r.addressee_id : r.requester_id);
    const otherIds = [...new Set(list.map(otherOf))];

    const profiles = new Map<string, ProfileRow>();
    if (otherIds.length > 0) {
      let { data: profRows, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, first_name, last_name, avatar_url")
        .in("user_id", otherIds)
        .returns<ProfileRow[]>();
      // avatar_url column not added yet → retry without it.
      if (profErr && isMissingColumn(profErr.message, "avatar_url")) {
        ({ data: profRows, error: profErr } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, first_name, last_name")
          .in("user_id", otherIds)
          .returns<ProfileRow[]>());
      }
      if (profErr) {
        return NextResponse.json(
          { error: "profiles_query_failed", details: profErr.message },
          { status: 500 },
        );
      }
      for (const p of profRows ?? []) profiles.set(p.user_id, p);
    }

    const summary = (id: string): FriendSummary => {
      const p = profiles.get(id);
      return {
        user_id: id,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    };
    const reqSummary = (r: RequestRow): FriendRequestSummary => ({
      ...summary(otherOf(r)),
      request_id: r.id,
      created_at: r.created_at,
    });

    const friends: FriendSummary[] = list
      .filter((r) => r.status === "accepted")
      .map((r) => summary(otherOf(r)));
    const incoming: FriendRequestSummary[] = list
      .filter((r) => r.status === "pending" && r.addressee_id === me)
      .map(reqSummary);
    const outgoing: FriendRequestSummary[] = list
      .filter((r) => r.status === "pending" && r.requester_id === me)
      .map(reqSummary);

    return NextResponse.json({ friends, incoming, outgoing });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * DELETE /api/friends  body: { userId }
 * Removes any relationship row between the caller and userId — used for
 * un-friending and for withdrawing an outgoing request.
 */
export async function DELETE(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;
    const me = user.id;

    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) {
      return NextResponse.json(
        { error: "bad_request", details: "userId is required." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .or(
        `and(requester_id.eq.${me},addressee_id.eq.${userId}),` +
          `and(requester_id.eq.${userId},addressee_id.eq.${me})`,
      );

    if (error) {
      return NextResponse.json(
        { error: "friend_delete_failed", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
