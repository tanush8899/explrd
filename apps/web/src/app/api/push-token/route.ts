import { NextResponse } from "next/server";
import { getAuthedUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";

/**
 * POST /api/push-token  body: { token, platform? }
 * Registers (or re-points) an Expo push token to the signed-in user. Upserts on
 * the token so a device re-registering — or being handed to a different account —
 * always ends up owned by the current user.
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;

    const { token, platform } = (await req.json()) as {
      token?: string;
      platform?: string;
    };

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "bad_request", details: "A push token is required." },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("push_tokens").upsert(
      {
        token,
        user_id: user.id,
        platform: platform ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );

    if (error) {
      return NextResponse.json(
        { error: "register_failed", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * DELETE /api/push-token  body: { token }
 * Unregisters a token (e.g. on sign-out) so the device stops receiving this
 * user's notifications.
 */
export async function DELETE(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const { supabase, user } = auth;

    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    if (!token) {
      return NextResponse.json(
        { error: "bad_request", details: "A push token is required." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("token", token)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "unregister_failed", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
