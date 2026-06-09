import type { SavedPlace, ExplrdStats } from "@explrd/shared";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// ─── Geocode ─────────────────────────────────────────────────────────────────

export type GeoResult = {
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

/** GET /api/geocode?q= — no auth required */
export async function geocode(
  q: string,
  signal?: AbortSignal
): Promise<GeoResult[]> {
  const res = await fetch(
    `${API_BASE}/api/geocode?q=${encodeURIComponent(q)}`,
    { signal }
  );
  if (!res.ok) throw new Error(`geocode: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []) as GeoResult[];
}

// ─── Places ──────────────────────────────────────────────────────────────────

/** GET /api/my-places */
export async function fetchMyPlaces(
  accessToken: string
): Promise<SavedPlace[]> {
  const res = await fetch(`${API_BASE}/api/my-places`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`fetchMyPlaces: ${res.status}`);
  const data = await res.json();
  return (data.places ?? []) as SavedPlace[];
}

export type PinBody = {
  place_id: string;
  display_name: string;
  lat: number;
  lng: number;
  address: Record<string, string | number | boolean | null | undefined>;
};

/** POST /api/pins */
export async function savePin(
  accessToken: string,
  body: PinBody
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pins`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error ?? `savePin: ${res.status}`);
  }
}

/** DELETE /api/pins/:placeId */
export async function deletePin(
  accessToken: string,
  placeId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/pins/${encodeURIComponent(placeId)}`,
    { method: "DELETE", headers: authHeaders(accessToken) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error ?? `deletePin: ${res.status}`);
  }
}

// ─── Nominatim landmark/city search ─────────────────────────────────────────

type NominatimItem = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  class: string;
  addresstype: string;
  address: Record<string, string | undefined>;
};

// Only genuine city-level admin units; everything finer resolves up to parent city
const STRICT_CITY_TYPES = new Set([
  "city", "town", "village", "hamlet", "municipality", "borough",
]);

function nominatimAddrCity(addr: Record<string, string | undefined>): string | undefined {
  return (
    addr.city ?? addr.town ?? addr.village ??
    addr.municipality ?? addr.borough ?? addr.hamlet
  );
}

/** Search Nominatim directly. Every result is resolved to a city. */
export async function nominatimGeocode(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=10&accept-language=en`;

  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "Explrd/1.0", "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`nominatim: ${res.status}`);

  const data: NominatimItem[] = await res.json();
  const seen = new Set<string>();
  const out: GeoResult[] = [];

  for (const r of data) {
    const addr = r.address;
    const state = addr.state;
    const country = addr.country;
    const countryCode = addr.country_code?.toUpperCase();
    const isStrictCity = STRICT_CITY_TYPES.has((r.addresstype ?? "").toLowerCase());

    // City → use its own name; anything finer → resolve to parent city
    const resolvedCity = isStrictCity
      ? r.display_name.split(",")[0].trim()
      : nominatimAddrCity(addr);
    if (!resolvedCity) continue;

    const key = `${resolvedCity.toLowerCase()}|${state?.toLowerCase() ?? ""}|${country?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rawName = r.display_name.split(",")[0].trim();
    out.push({
      place_id: isStrictCity
        ? `nom:${r.place_id}`
        : `nom:city:${key.replace(/\|/g, ":")}`,
      display_name: [resolvedCity, state, country].filter(Boolean).join(", "),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      address: { city: resolvedCity, state, country, country_code: countryCode },
      type: isStrictCity ? (r.type ?? null) : "city",
      class: isStrictCity ? (r.class ?? null) : "place",
      addresstype: isStrictCity ? (r.addresstype ?? null) : "city",
      landmark_name: !isStrictCity && rawName !== resolvedCity ? rawName : null,
    });
  }
  return out;
}

function cityDedupKey(r: GeoResult): string {
  const city =
    (r.address.city as string | undefined) ??
    r.display_name.split(",")[0].trim();
  const state = (r.address.state as string | undefined) ?? "";
  const country = (r.address.country as string | undefined) ?? "";
  return [city, state, country].map((s) => s.toLowerCase().trim()).join("|");
}

/** Normalize a Geoapify result to clean "City, State, Country" format. */
function normalizeGeoapifyResult(r: GeoResult): GeoResult | null {
  const city =
    (r.address.city as string | undefined) ??
    (r.address.town as string | undefined) ??
    (r.address.village as string | undefined) ??
    r.display_name.split(",")[0].trim();
  const state = r.address.state as string | undefined;
  const country = r.address.country as string | undefined;
  if (!city) return null;
  return {
    ...r,
    display_name: [city, state, country].filter(Boolean).join(", "),
  };
}

/**
 * Combined city search. Geoapify (via backend) and Nominatim run in parallel.
 * All results are normalized to "City, State, Country" and deduplicated.
 * Any POI/sub-city input (neighbourhood, university, park…) resolves up to
 * its parent city — the dropdown only ever shows cities.
 */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const [geoapifyRes, nominatimRes] = await Promise.allSettled([
    geocode(q, signal),
    nominatimGeocode(q, signal),
  ]);

  if (signal?.aborted) {
    const err = new Error("AbortError");
    err.name = "AbortError";
    throw err;
  }

  const rawPrimary = geoapifyRes.status === "fulfilled" ? geoapifyRes.value : [];
  const supplement = nominatimRes.status === "fulfilled" ? nominatimRes.value : [];

  // Normalize Geoapify results to "City, State, Country" and drop anything
  // that can't resolve to a city
  const primary = rawPrimary
    .map(normalizeGeoapifyResult)
    .filter((r): r is GeoResult => r !== null);

  const seen = new Set(primary.map(cityDedupKey));
  const merged = [
    ...primary,
    ...supplement.filter((r) => !seen.has(cityDedupKey(r))),
  ];
  return merged.slice(0, 12);
}

// ─── Share ───────────────────────────────────────────────────────────────────

/** POST /api/share-link */
export async function generateShareLink(
  accessToken: string
): Promise<{ token: string; expiresAt: string }> {
  const res = await fetch(`${API_BASE}/api/share-link`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`generateShareLink: ${res.status}`);
  return res.json();
}

export type PublicSharePayload = {
  displayName: string;
  places: SavedPlace[];
  stats: ExplrdStats;
  expiresAt: string;
};

/** GET /api/public-share?token= */
export async function fetchPublicShare(
  token: string
): Promise<PublicSharePayload> {
  const res = await fetch(
    `${API_BASE}/api/public-share?token=${encodeURIComponent(token)}`
  );
  if (!res.ok) throw new Error(`fetchPublicShare: ${res.status}`);
  return res.json();
}
