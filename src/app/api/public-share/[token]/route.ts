import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyShareToken } from "@/app/api/share-link/route";
import { hydratePlaceBoundaries, parseBoundary } from "@/lib/place-boundaries";
import { getExplrdStats } from "@/lib/stats";
import type { SavedPlace, UserProfile } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

type LegacySavedPlace = Omit<SavedPlace, "normalized_city" | "normalized_state" | "normalized_country" | "normalized_continent" | "city_boundary" | "state_boundary" | "country_boundary" | "continent_boundary">;
type JoinedRow = { places_cache: SavedPlace | LegacySavedPlace | Array<SavedPlace | LegacySavedPlace> | null };

function withMissingNormalized(place: LegacySavedPlace): SavedPlace {
  return { ...place, normalized_city: null, normalized_state: null, normalized_country: null, normalized_continent: null, city_boundary: null, state_boundary: null, country_boundary: null, continent_boundary: null };
}

function isMissingNormalizedColumn(msg: string | undefined) {
  return typeof msg === "string" && (msg.includes("normalized_") || msg.includes("_boundary")) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "missing_env" }, { status: 500 });
    }

    const { token: rawToken } = await context.params;
    const token = decodeURIComponent(rawToken ?? "").trim();

    const payload = verifyShareToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "invalid_token", details: "This share link is invalid or has expired." },
        { status: 404 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch display name from profiles table, fall back to auth metadata
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("display_name, public_slug, bio")
      .eq("user_id", payload.uid)
      .maybeSingle<Pick<UserProfile, "display_name" | "public_slug" | "bio">>();

    // Get auth user for name fallback
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(payload.uid);
    const metaName =
      typeof authUser?.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name :
      typeof authUser?.user_metadata?.name === "string" ? authUser.user_metadata.name : null;

    const displayName =
      profileRow?.display_name?.trim() ||
      metaName?.trim() ||
      authUser?.email?.split("@")[0] ||
      "Explr Traveler";

    // Fetch places
    let { data, error } = await supabase
      .from("user_places")
      .select(`place_id, places_cache!inner (place_id, name, city, state, country, continent, normalized_city, normalized_state, normalized_country, normalized_continent, lat, lng, formatted, city_boundary, state_boundary, country_boundary, continent_boundary)`)
      .eq("user_id", payload.uid);

    if (error && isMissingNormalizedColumn(error.message)) {
      const fallback = await supabase
        .from("user_places")
        .select(`place_id, places_cache!inner (place_id, name, city, state, country, continent, lat, lng, formatted)`)
        .eq("user_id", payload.uid);
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: "places_query_failed", details: error.message }, { status: 500 });
    }

    const places = await Promise.all(
      ((data ?? []) as JoinedRow[])
        .map((row) => (Array.isArray(row.places_cache) ? row.places_cache[0] ?? null : row.places_cache))
        .filter(Boolean)
        .map((place) => ("normalized_city" in (place as object) ? place as SavedPlace : withMissingNormalized(place as LegacySavedPlace)))
        .map((place) => ({
          ...place,
          city_boundary: parseBoundary(place.city_boundary),
          state_boundary: parseBoundary(place.state_boundary),
          country_boundary: parseBoundary(place.country_boundary),
          continent_boundary: parseBoundary(place.continent_boundary),
        }))
        .map((place) => hydratePlaceBoundaries(place))
    );

    const expiresAt = new Date(payload.exp * 1000).toISOString();

    return NextResponse.json({
      displayName,
      places,
      stats: getExplrdStats(places),
      expiresAt,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "server_exception", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
