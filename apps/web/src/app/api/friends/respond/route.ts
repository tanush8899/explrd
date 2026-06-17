import { NextResponse } from "next/server";
import { getAuthedUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";

/**
 * POST /api/friends/respond  body: { requestId, action: "accept" | "reject" }
 * Only the addressee of a pending request may respond. Accept flips the row to
 * 'accepted' (a friendship); reject deletes it so the other person can try again
 * later.
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;
    const me = user.id;

    const { requestId, action } = (await req.json()) as {
      requestId?: string;
      action?: "accept" | "reject";
    };

    if (!requestId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json(
        { error: "bad_request", details: "requestId and a valid action are required." },
        { status: 400 },
      );
    }

    const { data: row, error: rowErr } = await supabase
      .from("friend_requests")
      .select("id, addressee_id, status")
      .eq("id", requestId)
      .maybeSingle<{ id: string; addressee_id: string; status: string }>();

    if (rowErr) {
      return NextResponse.json(
        { error: "lookup_failed", details: rowErr.message },
        { status: 500 },
      );
    }
    if (!row || row.addressee_id !== me || row.status !== "pending") {
      return NextResponse.json(
        { error: "not_found", details: "No pending request to respond to." },
        { status: 404 },
      );
    }

    if (action === "accept") {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) {
        return NextResponse.json(
          { error: "accept_failed", details: error.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ status: "accepted" });
    }

    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
    if (error) {
      return NextResponse.json(
        { error: "reject_failed", details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ status: "rejected" });
  } catch (e) {
    return serverError(e);
  }
}
