import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hydratePlaceBoundaries, parseBoundary } from "@/lib/place-boundaries";

type PlaceRow = {
  place_id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  continent: string | null;
  normalized_city: string | null;
  normalized_state: string | null;
  normalized_country: string | null;
  normalized_continent: string | null;
  lat: number;
  lng: number;
  formatted: string | null;
  city_boundary: string | null;
  state_boundary: string | null;
  country_boundary: string | null;
  continent_boundary: string | null;
};

type LegacyPlaceRow = Omit<
  PlaceRow,
  | "normalized_city"
  | "normalized_state"
  | "normalized_country"
  | "normalized_continent"
  | "city_boundary"
  | "state_boundary"
  | "country_boundary"
  | "continent_boundary"
>;

type JoinedPlaceRow = {
  places_cache: PlaceRow | LegacyPlaceRow | Array<PlaceRow | LegacyPlaceRow> | null;
};

export const runtime = "nodejs";

function isMissingNormalizedColumn(message: string | undefined) {
  return (
    typeof message === "string" &&
    (message.includes("normalized_") || message.includes("_boundary")) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function withMissingNormalizedFields(place: LegacyPlaceRow): PlaceRow {
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

function isPlaceRow(value: PlaceRow | LegacyPlaceRow | null): value is PlaceRow | LegacyPlaceRow {
  return Boolean(value);
}

export async function GET(req: Request) {
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
      .eq("user_id", userId);

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
        .eq("user_id", userId);

      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json(
        { error: "query_failed", details: error.message },
        { status: 500 }
      );
    }

    const places = await Promise.all(
      ((data ?? []) as JoinedPlaceRow[])
      .map((row) =>
        Array.isArray(row.places_cache) ? row.places_cache[0] ?? null : row.places_cache
      )
      .filter(isPlaceRow)
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
      // Only hydrate static country/continent lookups — skip external API calls
      // for missing city/state boundaries so the initial load is fast.
      .map((place) => hydratePlaceBoundaries(place, { skipExternalFetch: true }))
    );

    return NextResponse.json({ places });
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
