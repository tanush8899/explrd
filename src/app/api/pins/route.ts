import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBoundaryQuery, normalizeAddress } from "@/lib/exploration";
import { resolveBoundaryFeatureCollection } from "@/lib/region-boundaries";
import {
  getStaticContinentFeatureCollection,
  getStaticCountryFeatureCollection,
} from "@/lib/static-boundaries";

type Body = {
  place_id: string;
  display_name: string;
  lat: number;
  lng: number;
  address: Record<string, string | number | boolean | null | undefined>;
};

export const runtime = "nodejs";

function getStableCityPlaceId(input: { city: string; state: string | null; country: string | null }) {
  return `city:${[input.city, input.state, input.country]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase())
    .join("|")}`;
}

function isMissingNormalizedColumn(message: string | undefined) {
  return (
    typeof message === "string" &&
    (message.includes("normalized_") || message.includes("_boundary")) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: "missing_env",
          details:
            "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Make sure it's in .env.local and restart the dev server.",
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

    const body = (await req.json()) as Body;

    if (!body?.place_id || !body?.display_name) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const normalized = normalizeAddress(body.address);
    const city = normalized.normalized_city;
    const state = normalized.normalized_state;
    const country = normalized.normalized_country;
    const continent = normalized.normalized_continent;
    const stablePlaceId = city ? getStableCityPlaceId({ city, state, country }) : body.place_id;
    const displayName = [city, state, country].filter(Boolean).join(", ") || body.display_name;

    if (!city) {
      return NextResponse.json(
        {
          error: "invalid_place_level",
          details: "Only cities, neighborhoods, districts, and similar city-level places can be saved.",
        },
        { status: 400 }
      );
    }
    const cityBoundary = city
      ? await resolveBoundaryFeatureCollection({
          mode: "city",
          placeId: stablePlaceId,
          lat: body.lat,
          lng: body.lng,
          city,
          state,
          country,
          continent,
          query: getBoundaryQuery({ city, state, country, continent }, "city"),
        })
      : null;
    const stateBoundary = state
      ? await resolveBoundaryFeatureCollection({
          mode: "state",
          placeId: stablePlaceId,
          lat: body.lat,
          lng: body.lng,
          city,
          state,
          country,
          continent,
          query: getBoundaryQuery({ city, state, country, continent }, "state"),
        })
      : null;
    const countryBoundary = getStaticCountryFeatureCollection(country);
    const continentBoundary = getStaticContinentFeatureCollection(continent);

    // 1) Upsert into places_cache
    let { error: cacheErr } = await supabase.from("places_cache").upsert(
      {
        place_id: stablePlaceId,
        name: city,
        city,
        state,
        country,
        continent,
        normalized_city: normalized.normalized_city,
        normalized_state: normalized.normalized_state,
        normalized_country: normalized.normalized_country,
        normalized_continent: normalized.normalized_continent,
        lat: body.lat,
        lng: body.lng,
        formatted: displayName,
        city_boundary: cityBoundary ? JSON.stringify(cityBoundary) : null,
        state_boundary: stateBoundary ? JSON.stringify(stateBoundary) : null,
        country_boundary: countryBoundary ? JSON.stringify(countryBoundary) : null,
        continent_boundary: continentBoundary ? JSON.stringify(continentBoundary) : null,
      },
      { onConflict: "place_id" }
    );

    if (cacheErr && isMissingNormalizedColumn(cacheErr.message)) {
      const fallback = await supabase.from("places_cache").upsert(
        {
          place_id: stablePlaceId,
          name: city,
          city,
          state,
          country,
          continent,
          lat: body.lat,
          lng: body.lng,
          formatted: displayName,
        },
        { onConflict: "place_id" }
      );

      cacheErr = fallback.error;
    }

    if (cacheErr) {
      return NextResponse.json(
        { error: "places_cache_upsert_failed", details: cacheErr.message },
        { status: 500 }
      );
    }

    // 2) Upsert user_places (no duplicates)
    const { error: pinErr } = await supabase.from("user_places").upsert(
      { user_id: userId, place_id: stablePlaceId },
      { onConflict: "user_id,place_id" }
    );

    if (pinErr) {
      return NextResponse.json(
        { error: "user_places_upsert_failed", details: pinErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
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
