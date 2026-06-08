import { NextResponse } from "next/server";
import { normalizeAddress } from "@/lib/exploration";

export const runtime = "nodejs";

type GeoapifyResult = {
  place_id?: string;
  formatted?: string;
  name?: string;
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

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
    "ISO3166-2-lvl4"?: string;
  };
};

type MappedResult = {
  place_id: string;
  display_name: string;
  lat: number;
  lng: number;
  address: Record<string, string | number | boolean | null | undefined>;
  type: string | null;
  class: string | null;
  addresstype: string | null;
  landmark_name: string | null;
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

const geocodeCache = new Map<string, { expiresAt: number; results: MappedResult[] }>();
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

function setCachedResults(query: string, results: MappedResult[]) {
  geocodeCache.set(query, {
    expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
    results,
  });
}

function getSearchDedupKey(result: MappedResult) {
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

function buildCityDisplayName(
  city: string | null | undefined,
  stateCode: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined,
): string {
  return [city, stateCode ?? state, country].filter(Boolean).join(", ");
}

function mapGeoapifyResult(r: GeoapifyResult): MappedResult | null {
  const address = {
    city: r.city,
    county: r.county,
    state: r.state,
    state_code: r.state_code,
    suburb: r.suburb,
    district: r.district,
    country: r.country,
    country_code: r.country_code,
  };

  const normalized = normalizeAddress(address);
  const kind = (r.result_type ?? "").toLowerCase();
  const isCityLevel = ALLOWED_CITY_LEVEL_TYPES.has(kind);
  const hasCity = !!normalized.normalized_city;

  if (!isCityLevel && !hasCity) return null;

  // For POI results, extract landmark name and use the parent city as the display
  let landmarkName: string | null = null;
  let displayName = String(r.formatted ?? "");

  if (!isCityLevel && hasCity) {
    const extractedName = r.name ?? r.formatted?.split(",")[0]?.trim() ?? null;
    // Only set landmark if it differs from the city name (avoids redundancy)
    if (extractedName && extractedName !== normalized.normalized_city) {
      landmarkName = extractedName;
      displayName =
        buildCityDisplayName(normalized.normalized_city, r.state_code, r.state, r.country) ||
        String(r.formatted ?? "");
    }
  }

  return {
    place_id: r.place_id ?? `geo:${r.lat ?? 0}:${r.lon ?? 0}`,
    display_name: displayName,
    lat: Number(r.lat),
    lng: Number(r.lon),
    address,
    type: r.result_type ?? null,
    class: r.category ?? null,
    addresstype: r.result_type ?? null,
    landmark_name: landmarkName,
  };
}

async function fetchNominatim(q: string): Promise<MappedResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Explrd/1.0 (contact: support@explrd.app)" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];

    return data
      .map((r): MappedResult | null => {
        const addr = r.address;
        const address = {
          city: addr.city ?? addr.town ?? addr.village ?? addr.hamlet,
          county: addr.county,
          state: addr.state,
          state_code: addr["ISO3166-2-lvl4"],
          country: addr.country,
          country_code: addr.country_code,
        };

        const normalized = normalizeAddress(address);
        const kind = r.type.toLowerCase();
        const isCityLevel = ALLOWED_CITY_LEVEL_TYPES.has(kind) || r.class === "place" || r.class === "boundary";
        const hasCity = !!normalized.normalized_city;

        if (!isCityLevel && !hasCity) return null;

        return {
          place_id: `nominatim:${r.place_id}`,
          display_name: r.display_name,
          lat: Number(r.lat),
          lng: Number(r.lon),
          address,
          type: r.type,
          class: r.class,
          addresstype: r.type,
          landmark_name: null,
        };
      })
      .filter((r): r is MappedResult => r !== null);
  } catch {
    return [];
  }
}

function dedup(results: MappedResult[]): MappedResult[] {
  // City-level results before POI-derived so city wins the dedup slot
  const sorted = [...results].sort(
    (a, b) => (a.landmark_name !== null ? 1 : 0) - (b.landmark_name !== null ? 1 : 0)
  );

  return Array.from(
    sorted
      .reduce((map, result) => {
        const key = getSearchDedupKey(result);
        if (!map.has(key)) map.set(key, result);
        return map;
      }, new Map<string, MappedResult>())
      .values()
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();

  if (!q) return NextResponse.json({ results: [] });
  if (!apiKey) {
    return NextResponse.json(
      { error: "missing_geoapify_key", details: "GEOAPIFY_API_KEY is missing." },
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
  geoapifyUrl.searchParams.set("limit", "10");
  geoapifyUrl.searchParams.set("apiKey", apiKey);

  const res = await fetch(geoapifyUrl.toString(), { cache: "no-store" });
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

  const raw = Array.isArray((data as { results?: unknown[] })?.results)
    ? (data as { results: unknown[] }).results
    : [];

  let results = raw
    .map((r) => mapGeoapifyResult(r as GeoapifyResult))
    .filter((r): r is MappedResult => r !== null);

  // Fallback to Nominatim when Geoapify returns nothing — better coverage of small towns
  if (results.length === 0) {
    results = await fetchNominatim(q);
  }

  const dedupedResults = dedup(results);

  setCachedResults(q.toLowerCase(), dedupedResults);
  return NextResponse.json({ results: dedupedResults });
}
