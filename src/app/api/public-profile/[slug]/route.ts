import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hydratePlaceBoundaries, parseBoundary } from "@/lib/place-boundaries";
import { getExplrdStats } from "@/lib/stats";
import type { SavedPlace, UserProfile } from "@/lib/types";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

type LegacySavedPlace = Omit<
  SavedPlace,
  | "normalized_city"
  | "normalized_state"
  | "normalized_country"
  | "normalized_continent"
  | "city_boundary"
  | "state_boundary"
  | "country_boundary"
  | "continent_boundary"
>;

type JoinedSavedPlaceRow = {
  places_cache: SavedPlace | LegacySavedPlace | Array<SavedPlace | LegacySavedPlace> | null;
};

export const runtime = "nodejs";

function isMissingNormalizedColumn(message: string | undefined) {
  return (
    typeof message === "string" &&
    (message.includes("normalized_") || message.includes("_boundary")) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function withMissingNormalizedFields(place: LegacySavedPlace): SavedPlace {
  return {
    ...place,
    normalized_city: null,
    normalized_state: null,
    normalized_country: null,
    normalized_continent: null,
    city_boundary: null,
    state_boundary: null,
    country_boundary: null,
    continent_boundary: null,
  };
}

function isSavedPlaceLike(value: SavedPlace | LegacySavedPlace | null): value is SavedPlace | LegacySavedPlace {
  return Boolean(value);
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: "missing_env",
          details: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 500 }
      );
    }

    const { slug: rawSlug } = await context.params;
    const slug = decodeURIComponent(rawSlug ?? "").trim().toLowerCase();

    if (!slug) {
      return NextResponse.json(
        { error: "bad_request", details: "A public profile slug is required." },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, display_name, public_slug, bio, is_public, created_at, updated_at")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .maybeSingle<UserProfile>();

    if (profileErr) {
      return NextResponse.json(
        { error: "profile_query_failed", details: profileErr.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "not_found", details: "This public profile is unavailable." },
        { status: 404 }
      );
    }

    let { data, error } = await supabase
      .from("user_places")
      .select(
        `
        place_id,
        places_cache!inner (
          place_id,
          name,
          city,
          state,
          country,
          continent,
          normalized_city,
          normalized_state,
          normalized_country,
          normalized_continent,
          lat,
          lng,
          formatted,
          city_boundary,
          state_boundary,
          country_boundary,
          continent_boundary
        )
      `
      )
      .eq("user_id", profile.user_id);

    if (error && isMissingNormalizedColumn(error.message)) {
      const fallback = await supabase
        .from("user_places")
        .select(
          `
          place_id,
          places_cache!inner (
            place_id,
            name,
            city,
            state,
            country,
          continent,
          lat,
          lng,
          formatted
          )
        `
        )
        .eq("user_id", profile.user_id);

      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json(
        { error: "places_query_failed", details: error.message },
        { status: 500 }
      );
    }

    const places = await Promise.all(
      ((data ?? []) as JoinedSavedPlaceRow[])
      .map((row) =>
        Array.isArray(row.places_cache) ? row.places_cache[0] ?? null : row.places_cache
      )
      .filter(isSavedPlaceLike)
      .map((place) =>
        "normalized_city" in place ? place : withMissingNormalizedFields(place)
      )
      .map((place) => ({
        ...place,
        city_boundary: parseBoundary(place.city_boundary),
        state_boundary: parseBoundary(place.state_boundary),
        country_boundary: parseBoundary(place.country_boundary),
        continent_boundary: parseBoundary(place.continent_boundary),
      }))
      .map((place) => hydratePlaceBoundaries(place))
    );

    return NextResponse.json({
      profile,
      places,
      stats: getExplrdStats(places),
    });
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
