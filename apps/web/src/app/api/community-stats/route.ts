import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getExplrdStats } from "@/lib/stats";
import type { CommunityComparison, SavedPlace } from "@/lib/types";

export const runtime = "nodejs";

// Below this many explorers the averages/percentiles are too noisy to be
// meaningful, so the section stays hidden. Tune as the user base grows.
const MIN_EXPLORERS = 10;

type PlaceFields = Pick<
  SavedPlace,
  | "city"
  | "state"
  | "country"
  | "continent"
  | "normalized_city"
  | "normalized_state"
  | "normalized_country"
  | "normalized_continent"
>;

type JoinedRow = {
  user_id: string;
  place_id: string;
  places_cache: PlaceFields | PlaceFields[] | null;
};

function isMissingNormalizedColumn(message: string | undefined) {
  return (
    typeof message === "string" &&
    message.includes("normalized_") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function withMissingNormalizedFields(place: Partial<PlaceFields>): PlaceFields {
  return {
    city: place.city ?? null,
    state: place.state ?? null,
    country: place.country ?? null,
    continent: place.continent ?? null,
    normalized_city: place.normalized_city ?? null,
    normalized_state: place.normalized_state ?? null,
    normalized_country: place.normalized_country ?? null,
    normalized_continent: place.normalized_continent ?? null,
  };
}

// getExplrdStats only reads geography fields; pad the rest so the typed shape is
// satisfied without shipping the heavy boundary polygons we never need here.
function asSavedPlace(place_id: string, fields: PlaceFields): SavedPlace {
  return {
    place_id,
    name: null,
    lat: 0,
    lng: 0,
    formatted: null,
    city_boundary: null,
    state_boundary: null,
    country_boundary: null,
    continent_boundary: null,
    ...fields,
  };
}

function placeLabel(fields: PlaceFields): string {
  return (
    fields.city ??
    fields.normalized_city ??
    fields.state ??
    fields.country ??
    "Mapped place"
  );
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "missing_env", details: "Supabase env vars are missing." },
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
    const meId = userData?.user?.id ?? null;
    if (userErr || !meId) {
      return NextResponse.json(
        { error: "invalid_token", details: userErr?.message ?? "No user found" },
        { status: 401 }
      );
    }

    const baseSelect = (cols: string) => `
        user_id,
        place_id,
        places_cache!inner (${cols})`;

    const fullCols =
      "city, state, country, continent, normalized_city, normalized_state, normalized_country, normalized_continent";
    const legacyCols = "city, state, country, continent";

    let { data, error } = await supabase
      .from("user_places")
      .select(baseSelect(fullCols));

    if (error && isMissingNormalizedColumn(error.message)) {
      const fallback = await supabase
        .from("user_places")
        .select(baseSelect(legacyCols));
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json(
        { error: "query_failed", details: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as unknown as JoinedRow[];

    // Per-user place lists + how many distinct explorers share each place.
    const placesByUser = new Map<string, SavedPlace[]>();
    const explorersByPlace = new Map<string, Set<string>>();
    const placeInfo = new Map<string, PlaceFields>();

    for (const row of rows) {
      const raw = Array.isArray(row.places_cache)
        ? row.places_cache[0] ?? null
        : row.places_cache;
      if (!raw) continue;
      const fields = withMissingNormalizedFields(raw);

      const list = placesByUser.get(row.user_id) ?? [];
      list.push(asSavedPlace(row.place_id, fields));
      placesByUser.set(row.user_id, list);

      const explorers = explorersByPlace.get(row.place_id) ?? new Set<string>();
      explorers.add(row.user_id);
      explorersByPlace.set(row.place_id, explorers);

      if (!placeInfo.has(row.place_id)) placeInfo.set(row.place_id, fields);
    }

    const explorerCount = placesByUser.size;
    if (explorerCount < MIN_EXPLORERS) {
      const payload: CommunityComparison = {
        enoughData: false,
        explorerCount,
        minExplorers: MIN_EXPLORERS,
        averages: null,
        you: null,
        rarestStamp: null,
      };
      return NextResponse.json(payload);
    }

    // Stats for every explorer, so we can average and rank.
    const statsByUser = new Map<string, ReturnType<typeof getExplrdStats>>();
    for (const [userId, places] of placesByUser) {
      statsByUser.set(userId, getExplrdStats(places));
    }

    const allStats = [...statsByUser.values()];
    const sum = allStats.reduce(
      (acc, s) => {
        acc.uniqueCountries += s.uniqueCountries;
        acc.uniqueCities += s.uniqueCities;
        acc.uniqueContinents += s.uniqueContinents;
        acc.percentWorldTraveled += s.percentWorldTraveled;
        acc.score += s.score;
        return acc;
      },
      {
        uniqueCountries: 0,
        uniqueCities: 0,
        uniqueContinents: 0,
        percentWorldTraveled: 0,
        score: 0,
      }
    );
    const round1 = (n: number) => Math.round((n / explorerCount) * 10) / 10;
    const averages = {
      uniqueCountries: round1(sum.uniqueCountries),
      uniqueCities: round1(sum.uniqueCities),
      uniqueContinents: round1(sum.uniqueContinents),
      percentWorldTraveled: round1(sum.percentWorldTraveled),
      score: Math.round(sum.score / explorerCount),
    };

    const mine = statsByUser.get(meId) ?? null;
    let you: CommunityComparison["you"] = null;
    if (mine) {
      // Rank by explrd score (overall footprint), 1 = most explored.
      const rank =
        allStats.filter((s) => s.score > mine.score).length + 1;
      const topPercent = Math.max(1, Math.round((rank / explorerCount) * 100));
      you = {
        rank,
        topPercent,
        uniqueCountries: mine.uniqueCountries,
        uniqueCities: mine.uniqueCities,
        uniqueContinents: mine.uniqueContinents,
        percentWorldTraveled: mine.percentWorldTraveled,
        score: mine.score,
      };
    }

    // Rarest stamp: the requesting user's place that the fewest others share.
    let rarestStamp: CommunityComparison["rarestStamp"] = null;
    const myPlaces = placesByUser.get(meId) ?? [];
    for (const p of myPlaces) {
      const others = (explorersByPlace.get(p.place_id)?.size ?? 1) - 1;
      if (rarestStamp === null || others < rarestStamp.otherExplorers) {
        const info = placeInfo.get(p.place_id);
        rarestStamp = {
          label: info ? placeLabel(info) : p.place_id,
          country: info?.country ?? info?.normalized_country ?? null,
          otherExplorers: others,
        };
      }
    }

    const payload: CommunityComparison = {
      enoughData: true,
      explorerCount,
      minExplorers: MIN_EXPLORERS,
      averages,
      you,
      rarestStamp,
    };
    return NextResponse.json(payload);
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
