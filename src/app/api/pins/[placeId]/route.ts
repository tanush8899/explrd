import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    placeId: string;
  }>;
};

export const runtime = "nodejs";

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: "missing_env",
          details:
            "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id ?? null;

    if (userErr || !userId) {
      return NextResponse.json(
        { error: "invalid_token", details: userErr?.message ?? "No user found" },
        { status: 401 }
      );
    }

    const { placeId: rawPlaceId } = await context.params;
    const placeId = decodeURIComponent(rawPlaceId ?? "").trim();

    if (!placeId) {
      return NextResponse.json(
        { error: "bad_request", details: "A placeId is required." },
        { status: 400 }
      );
    }

    const { data: deletedRows, error: deleteErr } = await supabase
      .from("user_places")
      .delete()
      .eq("user_id", userId)
      .eq("place_id", placeId)
      .select("place_id");

    if (deleteErr) {
      return NextResponse.json(
        { error: "delete_failed", details: deleteErr.message },
        { status: 500 }
      );
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: "not_found", details: "Saved place not found for this user." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, place_id: placeId });
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
