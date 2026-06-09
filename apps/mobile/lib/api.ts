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

    // Strip bilingual slash-names (e.g. "Valais/Wallis" → "Valais")
    const cleanState = state?.split("/")[0].trim();
    const key = `${resolvedCity.toLowerCase()}|${cleanState?.toLowerCase() ?? ""}|${country?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rawName = r.display_name.split(",")[0].trim();
    out.push({
      place_id: isStrictCity
        ? `nom:${r.place_id}`
        : `nom:city:${key.replace(/\|/g, ":")}`,
      display_name: [resolvedCity, cleanState, country].filter(Boolean).join(", "),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      address: { city: resolvedCity, state: cleanState, country, country_code: countryCode },
      type: isStrictCity ? (r.type ?? null) : "city",
      class: isStrictCity ? (r.class ?? null) : "place",
      addresstype: isStrictCity ? (r.addresstype ?? null) : "city",
      landmark_name: !isStrictCity && rawName !== resolvedCity ? rawName : null,
    });
  }
  return out;
}

// Dedup key using full city+state+country
function cityDedupKey(r: GeoResult): string {
  const city =
    (r.address.city as string | undefined) ??
    r.display_name.split(",")[0].trim();
  const state = (r.address.state as string | undefined) ?? "";
  const country = (r.address.country as string | undefined) ?? "";
  return [city, state, country].map((s) => s.toLowerCase().trim()).join("|");
}

// Coarser key using only city+country — catches duplicates where state names
// differ between providers (e.g. "Valais" vs "Valais/Wallis")
function cityShortKey(r: GeoResult): string {
  const city =
    (r.address.city as string | undefined) ??
    r.display_name.split(",")[0].trim();
  const country = (r.address.country as string | undefined) ?? "";
  return [city, country].map((s) => s.toLowerCase().trim()).join("|");
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

/** Sort results so exact and prefix city-name matches float to the top. */
function rankByRelevance(results: GeoResult[], query: string): GeoResult[] {
  const q = query.toLowerCase().trim();
  return [...results].sort((a, b) => {
    const aCity = ((a.address.city as string | undefined) ?? a.display_name.split(",")[0])
      .toLowerCase().trim();
    const bCity = ((b.address.city as string | undefined) ?? b.display_name.split(",")[0])
      .toLowerCase().trim();
    const score = (city: string) =>
      city === q ? 0 : city.startsWith(q) ? 1 : city.includes(q) ? 2 : 3;
    return score(aCity) - score(bCity);
  });
}

/**
 * Combined city search. Geoapify (via backend) and Nominatim run in parallel.
 * Results are normalized to "City, State, Country", deduplicated across both
 * providers (handles bilingual/abbreviated state name mismatches), and ranked
 * so direct city-name matches surface first.
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

  const primary = rawPrimary
    .map(normalizeGeoapifyResult)
    .filter((r): r is GeoResult => r !== null);

  // Two-level dedup: full key catches same-state dupes, short key catches
  // cross-provider state-name mismatches (e.g. "Verbier, Valais" vs "Verbier, Valais/Wallis")
  const seenFull = new Set(primary.map(cityDedupKey));
  const seenShort = new Set(primary.map(cityShortKey));
  const merged = [
    ...primary,
    ...supplement.filter(
      (r) => !seenFull.has(cityDedupKey(r)) && !seenShort.has(cityShortKey(r))
    ),
  ];

  return rankByRelevance(merged, q).slice(0, 10);
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
