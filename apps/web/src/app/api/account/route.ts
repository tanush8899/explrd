import { NextResponse } from "next/server";
import { getAuthedUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";

/**
 * DELETE /api/account
 * Permanently deletes the signed-in user: their saved places, friend graph,
 * profile, and finally the auth account itself. Shared rows in places_cache are
 * left intact (they're not user-owned). Share links are stateless HMAC tokens,
 * so there's nothing to revoke server-side.
 */
export async function DELETE(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;
    const me = user.id;

    // Remove user-owned rows first in case any FK isn't ON DELETE CASCADE.
    await supabase.from("user_places").delete().eq("user_id", me);
    await supabase
      .from("friend_requests")
      .delete()
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
    await supabase.from("profiles").delete().eq("user_id", me);

    const { error: authErr } = await supabase.auth.admin.deleteUser(me);
    if (authErr) {
      return NextResponse.json(
        { error: "account_delete_failed", details: authErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
