import { NextResponse } from "next/server";
import { validateUsername } from "@explrd/shared";
import { getAuthedUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";

type ExistingRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
};

/**
 * POST /api/friends/request  body: { username }
 * Sends a friend request to the user with that handle. If the target has already
 * sent ME a pending request, this accepts it instead (so two people requesting
 * each other become friends).
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;
    const me = user.id;

    const body = (await req.json()) as { username?: string };
    const check = validateUsername(body.username ?? "");
    if (!check.ok) {
      return NextResponse.json(
        { error: "bad_username", details: check.reason },
        { status: 400 },
      );
    }

    // Resolve the target by handle.
    const { data: target, error: targetErr } = await supabase
      .from("profiles")
      .select("user_id, username")
      .ilike("username", check.value)
      .maybeSingle<{ user_id: string; username: string | null }>();

    if (targetErr) {
      return NextResponse.json(
        { error: "lookup_failed", details: targetErr.message },
        { status: 500 },
      );
    }
    if (!target) {
      return NextResponse.json(
        { error: "not_found", details: `No one goes by @${check.value}.` },
        { status: 404 },
      );
    }
    if (target.user_id === me) {
      return NextResponse.json(
        { error: "self", details: "You can't add yourself." },
        { status: 400 },
      );
    }

    const other = target.user_id;

    // Any existing relationship between us, in either direction?
    const { data: existing, error: existErr } = await supabase
      .from("friend_requests")
      .select("id, requester_id, addressee_id, status")
      .or(
        `and(requester_id.eq.${me},addressee_id.eq.${other}),` +
          `and(requester_id.eq.${other},addressee_id.eq.${me})`,
      )
      .maybeSingle<ExistingRow>();

    if (existErr) {
      return NextResponse.json(
        { error: "lookup_failed", details: existErr.message },
        { status: 500 },
      );
    }

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json(
          { error: "already_friends", details: "You're already friends." },
          { status: 409 },
        );
      }
      if (existing.status === "pending") {
        if (existing.requester_id === me) {
          return NextResponse.json({ status: "pending" }); // idempotent
        }
        // Reverse pending → accept it, we're now friends.
        const { error: upErr } = await supabase
          .from("friend_requests")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (upErr) {
          return NextResponse.json(
            { error: "accept_failed", details: upErr.message },
            { status: 500 },
          );
        }
        return NextResponse.json({ status: "accepted" });
      }
      // A previously rejected row exists — clear it so we can request fresh.
      await supabase.from("friend_requests").delete().eq("id", existing.id);
    }

    const { error: insErr } = await supabase.from("friend_requests").insert({
      requester_id: me,
      addressee_id: other,
      status: "pending",
    });
    if (insErr) {
      return NextResponse.json(
        { error: "request_failed", details: insErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: "pending" });
  } catch (e) {
    return serverError(e);
  }
}
