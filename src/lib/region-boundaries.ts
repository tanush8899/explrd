import { getCountryCodeFromCountryName } from "@/lib/continents";
import {
  getStaticContinentFeatureCollection,
  getStaticCountryFeatureCollection,
} from "@/lib/static-boundaries";
import type { GeoFeatureCollection, Geometry, MapMode } from "@/lib/types";

export type BoundaryLookupInput = {
  mode: MapMode;
  query?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  continent?: string | null;
};

type NominatimBoundaryResult = {
  geojson?: unknown;
  addresstype?: string | null;
  type?: string | null;
  place_rank?: number | null;
};

type GeoapifyBoundaryFeature = {
  type?: string;
  properties?: Record<string, unknown>;
  geometry?: unknown;
};

type GeoapifyBoundaryResponse = {
  type?: string;
  features?: GeoapifyBoundaryFeature[];
};

const MODE_FEATURETYPE: Partial<Record<MapMode, "city" | "state" | "country">> = {
  city: "city",
  state: "state",
  country: "country",
};

const BOUNDARY_CACHE_TTL_MS = 1000 * 60 * 60;
const boundaryCache = new Map<
  string,
  {
    expiresAt: number;
    value: GeoFeatureCollection | null;
  }
>();
const inFlightBoundaryRequests = new Map<string, Promise<GeoFeatureCollection | null>>();

function toSupportedGeometry(input: unknown): Geometry | null {
  if (!input || typeof input !== "object" || !("type" in input) || !("coordinates" in input)) {
    return null;
  }

  const geometry = input as { type?: string; coordinates?: unknown };
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates as Geometry["coordinates"] & number[][][],
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates as Geometry["coordinates"] & number[][][][],
    };
  }

  return null;
}

function toFeatureCollection(result: NominatimBoundaryResult): GeoFeatureCollection | null {
  const geometry = toSupportedGeometry(result.geojson);
  if (!geometry) return null;

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          addresstype: result.addresstype ?? null,
          type: result.type ?? null,
        },
        geometry,
      },
    ],
  };
}

function getPropertyText(properties: Record<string, unknown> | undefined, key: string) {
  const value = properties?.[key];
  return typeof value === "string" ? value.trim() : null;
}

function getPropertyArray(properties: Record<string, unknown> | undefined, key: string) {
  const value = properties?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function toGeoapifyFeatureCollection(feature: GeoapifyBoundaryFeature): GeoFeatureCollection | null {
  const geometry = toSupportedGeometry(feature.geometry);
  if (!geometry) return null;

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: (feature.properties as Record<string, string | number | boolean | null>) ?? {},
        geometry,
      },
    ],
  };
}

function scoreGeoapifyFeature(
  feature: GeoapifyBoundaryFeature,
  input: BoundaryLookupInput
) {
  const properties = feature.properties;
  const name = normalizeToken(getPropertyText(properties, "name"));
  const city = normalizeToken(getPropertyText(properties, "city"));
  const state = normalizeToken(getPropertyText(properties, "state"));
  const country = normalizeToken(getPropertyText(properties, "country"));
  const county = normalizeToken(getPropertyText(properties, "county"));
  const postcode = normalizeToken(getPropertyText(properties, "postcode"));
  const countryCodeFromProperties = normalizeToken(getPropertyText(properties, "country_code"));
  const categories = getPropertyArray(properties, "categories");
  const isCountryLevel = categories.includes("administrative.country_level");
  const isCountryPartLevel = categories.includes("administrative.country_part_level");
  const isRegionLevel = categories.includes("administrative.region_level");
  const isDistrictLevel = categories.includes("administrative.district_level");
  const isCountyLevel = categories.includes("administrative.county_level");

  const targetCity = normalizeToken(input.city);
  const targetState = normalizeToken(input.state);
  const targetCountry = normalizeToken(input.country);
  const countryCode = getCountryCodeFromCountryName(country) ?? countryCodeFromProperties?.toUpperCase() ?? null;
  const targetCountryCode = getCountryCodeFromCountryName(input.country);
  const hasNestedBoundary = Boolean(city || state || county || postcode);

  let score = 0;

  if (input.mode === "city") {
    if (name && targetCity && name === targetCity) score += 120;
    if (city && targetCity && city === targetCity) score += 100;
    if (state && targetState && state === targetState) score += 30;
    if (country && targetCountry && country === targetCountry) score += 20;
    if (countryCode && targetCountryCode && countryCode === targetCountryCode) score += 40;
  }

  if (input.mode === "state") {
    if (name && targetState && name === targetState) score += 120;
    if (state && targetState && state === targetState) score += 100;
    if (country && targetCountry && country === targetCountry) score += 20;
    if (countryCode && targetCountryCode && countryCode === targetCountryCode) score += 40;
    if (isCountryPartLevel) score += 180;
    if (isRegionLevel) score += 180;
    if (isDistrictLevel) score -= 220;
    if (isCountyLevel) score -= 180;
    if (city) score -= 120;
    if (county) score -= 120;
    if (postcode) score -= 80;
  }

  if (input.mode === "country") {
    if (name && targetCountry && name === targetCountry) score += 280;
    if (country && targetCountry && country === targetCountry) score += 120;
    if (countryCode && targetCountryCode && countryCode === targetCountryCode) score += 220;
    if (name && targetCountry && (name.includes(targetCountry) || targetCountry.includes(name))) {
      score += 140;
    }
    if (isCountryLevel) score += 400;
    if (isCountryPartLevel) score -= 260;
    if (!hasNestedBoundary) score += 180;
    if (state) score -= 140;
    if (city) score -= 120;
    if (county) score -= 80;
    if (postcode) score -= 80;
  }

  return score;
}

function isGeoapifyStateFeature(feature: GeoapifyBoundaryFeature) {
  const properties = feature.properties;
  const categories = getPropertyArray(properties, "categories");

  if (categories.includes("administrative.country_part_level")) return true;
  if (categories.includes("administrative.region_level")) return true;

  return false;
}

function scoreCandidate(result: NominatimBoundaryResult, mode: MapMode) {
  const addresstype = result.addresstype ?? "";
  const type = result.type ?? "";
  const placeRank = result.place_rank ?? 0;

  if (mode === "city") {
    const preferred = ["city", "town", "municipality", "borough", "suburb", "quarter", "neighbourhood"];
    const matches = preferred.includes(addresstype) || preferred.includes(type);
    return (matches ? 100 : 0) + placeRank;
  }

  if (mode === "state") {
    const matches =
      ["state", "province", "region"].includes(addresstype) ||
      ["administrative", "state", "province", "region"].includes(type);
    return (matches ? 100 : 0) + placeRank;
  }

  if (mode === "country") {
    const matches = addresstype === "country" || type === "administrative" || type === "country";
    return (matches ? 100 : 0) + placeRank;
  }

  return placeRank;
}

async function fetchBoundaryCandidates(url: URL) {
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "User-Agent": "Explrd/0.1 (tanushsanjay@gmail.com)",
      "Accept-Language": "en",
    },
  });

  const text = await res.text();

  if (!res.ok) {
    return {
      ok: false as const,
      text,
      candidates: [] as NominatimBoundaryResult[],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false as const,
      text,
      candidates: [] as NominatimBoundaryResult[],
    };
  }

  return {
    ok: true as const,
    text,
    candidates: Array.isArray(data) ? (data as NominatimBoundaryResult[]) : [],
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchUrl(input: BoundaryLookupInput) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("polygon_threshold", "0.005");
  url.searchParams.set("limit", "5");
  url.searchParams.set("email", "tanushsanjay@gmail.com");

  const featureType = MODE_FEATURETYPE[input.mode];
  if (featureType) {
    url.searchParams.set("featuretype", featureType);
  }

  if (input.mode === "city") {
    if (input.city) url.searchParams.set("city", input.city);
    if (input.state) url.searchParams.set("state", input.state);
    if (input.country) url.searchParams.set("country", input.country);
  } else if (input.mode === "state") {
    if (input.state) url.searchParams.set("state", input.state);
    if (input.country) url.searchParams.set("country", input.country);
  } else if (input.mode === "country") {
    if (input.country) {
      url.searchParams.set("country", input.country);
    }
  }

  if (![...url.searchParams.keys()].some((key) => ["city", "state", "country", "q"].includes(key))) {
    if (input.query) {
      url.searchParams.set("q", input.query);
    }
  }

  return url;
}

function buildGeoapifyPartOfUrl(input: BoundaryLookupInput, apiKey: string) {
  const url = new URL("https://api.geoapify.com/v1/boundaries/part-of");
  url.searchParams.set("geometry", input.mode === "country" ? "geometry_10000" : "geometry_5000");
  url.searchParams.set("boundaries", "administrative");
  url.searchParams.set("apiKey", apiKey);

  if (typeof input.lat === "number" && typeof input.lng === "number") {
    url.searchParams.set("lat", String(input.lat));
    url.searchParams.set("lon", String(input.lng));
    return url;
  }

  if (input.placeId) {
    url.searchParams.set("id", input.placeId);
    return url;
  }

  return null;
}

async function fetchGeoapifyBoundary(input: BoundaryLookupInput): Promise<GeoFeatureCollection | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) return null;

  const url = buildGeoapifyPartOfUrl(input, apiKey);
  if (!url) return null;

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json().catch(() => null)) as GeoapifyBoundaryResponse | null;
  const features = Array.isArray(payload?.features) ? payload.features : [];

  const scored = features
    .map((feature) => ({
      feature,
      score: scoreGeoapifyFeature(feature, input),
    }))
    .sort((a, b) => b.score - a.score);

  const filtered =
    input.mode === "country"
      ? scored.filter((entry) =>
          getPropertyArray(entry.feature.properties, "categories").includes("administrative.country_level")
        )
      : input.mode === "state"
        ? scored.filter((entry) => isGeoapifyStateFeature(entry.feature))
      : scored;

  const best =
    input.mode === "country"
      ? filtered.find((entry) => entry.score > 0)
      : input.mode === "state"
        ? filtered.find((entry) => entry.score > 0)
      : scored.find((entry) => entry.score > 0);

  if (!best) return null;

  if (
    process.env.NODE_ENV !== "production" &&
    input.mode === "country" &&
    (input.country === "United States" || input.country === "Russia")
  ) {
    console.log("[region-boundaries] country selection", {
      target: input.country,
      score: best.score,
      properties: best.feature.properties ?? null,
    });
  }

  return toGeoapifyFeatureCollection(best.feature);
}

function getBoundaryCacheKey(input: BoundaryLookupInput) {
  return JSON.stringify({
    mode: input.mode,
    query: input.query ?? null,
    placeId: input.placeId ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? null,
    continent: input.continent ?? null,
  });
}

export async function resolveBoundaryFeatureCollection(
  input: BoundaryLookupInput
): Promise<GeoFeatureCollection | null> {
  const cacheKey = getBoundaryCacheKey(input);
  const cached = boundaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = inFlightBoundaryRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    if (input.mode === "country") {
      const countryBoundary = getStaticCountryFeatureCollection(input.country);
      boundaryCache.set(cacheKey, {
        expiresAt: Date.now() + BOUNDARY_CACHE_TTL_MS,
        value: countryBoundary,
      });
      return countryBoundary;
    }

    if (input.mode === "continent") {
      const continentBoundary = getStaticContinentFeatureCollection(input.continent);
      boundaryCache.set(cacheKey, {
        expiresAt: Date.now() + BOUNDARY_CACHE_TTL_MS,
        value: continentBoundary,
      });
      return continentBoundary;
    }

    const geoapifyBoundary = await fetchGeoapifyBoundary(input);
    if (geoapifyBoundary) {
      boundaryCache.set(cacheKey, {
        expiresAt: Date.now() + BOUNDARY_CACHE_TTL_MS,
        value: geoapifyBoundary,
      });
      return geoapifyBoundary;
    }

    const primaryUrl = buildSearchUrl(input);
    let primary = await fetchBoundaryCandidates(primaryUrl);
    if (!primary.ok && primary.text.includes("Too many requests")) {
      await sleep(1200);
      primary = await fetchBoundaryCandidates(primaryUrl);
    }

    const fallbackUrl = new URL(primaryUrl.toString());
    fallbackUrl.searchParams.delete("featuretype");
    if (!fallbackUrl.searchParams.get("q") && input.query) {
      fallbackUrl.searchParams.set("q", input.query);
    }
    let fallback =
      primary.candidates.length === 0 ? await fetchBoundaryCandidates(fallbackUrl) : null;
    if (fallback && !fallback.ok && fallback.text.includes("Too many requests")) {
      await sleep(1200);
      fallback = await fetchBoundaryCandidates(fallbackUrl);
    }

    const candidates = [...primary.candidates, ...(fallback?.candidates ?? [])].sort(
      (a, b) => scoreCandidate(b, input.mode) - scoreCandidate(a, input.mode)
    );

    const value = candidates.map(toFeatureCollection).find(Boolean) ?? null;

    boundaryCache.set(cacheKey, {
      expiresAt: Date.now() + BOUNDARY_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inFlightBoundaryRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inFlightBoundaryRequests.delete(cacheKey);
  }
}
