import { NextResponse } from "next/server";
import { normalizeAddress } from "@/lib/exploration";

export const runtime = "nodejs";

type GeoapifyResult = {
  place_id?: string;
  formatted?: string;
  lat?: number;
  lon?: number;
  city?: string;
  county?: string;
  state?: string;
  state_code?: string;
  country?: string;
  country_code?: string;
  suburb?: string;
  district?: string;
  result_type?: string;
  category?: string;
};

const ALLOWED_CITY_LEVEL_TYPES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "borough",
  "suburb",
  "quarter",
  "neighbourhood",
  "neighborhood",
  "district",
  "residential",
  "city_district",
  "county",
  "locality",
  "administrative",
  "island",
  "place",
]);

const geocodeCache = new Map<string, { expiresAt: number; results: unknown[] }>();
const GEOCODE_CACHE_TTL_MS = 1000 * 60 * 10;

function getCachedResults(query: string) {
  const cached = geocodeCache.get(query);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    geocodeCache.delete(query);
    return null;
  }
  return cached.results;
}

function setCachedResults(query: string, results: unknown[]) {
  geocodeCache.set(query, {
    expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
    results,
  });
}

function getSearchDedupKey(result: {
  display_name: string;
  lat: number;
  lng: number;
  address: Record<string, string | number | boolean | null | undefined>;
}) {
  const normalized = normalizeAddress(result.address);
  const title =
    normalized.normalized_city ??
    normalized.normalized_state ??
    normalized.normalized_country ??
    result.display_name.split(",")[0]?.trim() ??
    result.display_name;

  return [
    title.trim().toLowerCase(),
    normalized.normalized_state?.trim().toLowerCase() ?? "",
    normalized.normalized_country?.trim().toLowerCase() ?? "",
  ].join("|");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();

  if (!q) return NextResponse.json({ results: [] });
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "missing_geoapify_key",
        details: "GEOAPIFY_API_KEY is missing.",
      },
      { status: 500 }
    );
  }

  const cachedResults = getCachedResults(q.toLowerCase());
  if (cachedResults) {
    return NextResponse.json({ results: cachedResults, cached: true });
  }

  const geoapifyUrl = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  geoapifyUrl.searchParams.set("text", q);
  geoapifyUrl.searchParams.set("format", "json");
  geoapifyUrl.searchParams.set("lang", "en");
  geoapifyUrl.searchParams.set("limit", "8");
  geoapifyUrl.searchParams.set("apiKey", apiKey);

  const res = await fetch(geoapifyUrl.toString(), {
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      {
        error: "nominatim_error",
        status: res.status,
        details:
          res.status === 429
            ? "Search is being rate-limited right now. Pause for a moment and try again."
            : "Search provider error.",
        body: text.slice(0, 300),
      },
      { status: 502 }
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "bad_json_from_nominatim", body: text.slice(0, 300) },
      { status: 502 }
    );
  }

  const results = (Array.isArray((data as { results?: unknown[] })?.results)
    ? (data as { results: unknown[] }).results
    : []
  )
    .map((r) => {
      const result = r as GeoapifyResult;
      const address = {
        city: result.city,
        county: result.county,
        state: result.state,
        state_code: result.state_code,
        suburb: result.suburb,
        district: result.district,
        country: result.country,
        country_code: result.country_code,
      };

      return {
        place_id:
          result.place_id ??
          `${result.formatted ?? "geoapify"}:${result.lat ?? 0}:${result.lon ?? 0}`,
        display_name: String(result.formatted ?? ""),
        lat: Number(result.lat),
        lng: Number(result.lon),
        address,
        type: result.result_type ?? null,
        class: result.category ?? null,
        addresstype: result.result_type ?? null,
      };
    })
    .filter((result) => {
      const normalized = normalizeAddress(result.address);
      const kind = (result.addresstype ?? result.type ?? "").toLowerCase();

      if (normalized.normalized_city) {
        return true;
      }

      return ALLOWED_CITY_LEVEL_TYPES.has(kind);
    });

  const dedupedResults = Array.from(
    results.reduce((unique, result) => {
      const dedupKey = getSearchDedupKey(result);
      if (!unique.has(dedupKey)) {
        unique.set(dedupKey, result);
      }
      return unique;
    }, new Map<string, (typeof results)[number]>()).values()
  );

  setCachedResults(q.toLowerCase(), dedupedResults);

  return NextResponse.json({ results: dedupedResults });
}
