import type {
  SavedPlace,
  ExplrdStats,
  UserProfile,
  FriendsPayload,
} from "@explrd/shared";

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

// ─── Apple Maps Server API ───────────────────────────────────────────────────

type AppleMapsResult = {
  name: string;
  formattedAddressLines: string[];
  // country and countryCode are top-level on the result, not inside structuredAddress
  country?: string;
  countryCode?: string;
  structuredAddress?: {
    locality?: string;
    administrativeArea?: string;
  };
  coordinate: { latitude: number; longitude: number };
};

// Apple access tokens last 30 minutes — cache them to avoid an extra round-trip per search
let _appleMapsAccessToken: string | null = null;
let _appleMapsTokenExpiry = 0;

async function getAppleMapsAccessToken(): Promise<string | null> {
  const jwt = process.env.EXPO_PUBLIC_APPLE_MAPS_TOKEN;
  if (!jwt) return null;

  // Return cached token if still valid (with a 60s buffer)
  if (_appleMapsAccessToken && Date.now() / 1000 < _appleMapsTokenExpiry - 60) {
    return _appleMapsAccessToken;
  }

  try {
    const res = await fetch("https://maps-api.apple.com/v1/token", {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; expiresInSeconds: number };
    _appleMapsAccessToken = data.accessToken;
    _appleMapsTokenExpiry = Math.floor(Date.now() / 1000) + data.expiresInSeconds;
    return _appleMapsAccessToken;
  } catch {
    return null;
  }
}

/**
 * City search via Apple Maps Server API.
 * Returns Apple-quality ranked results (same ranking as the native Maps app).
 * Degrades gracefully to empty if the JWT is missing/expired.
 */
export async function appleMapsGeocode(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const accessToken = await getAppleMapsAccessToken();
  if (!accessToken) return [];

  let res: Response;
  try {
    res = await fetch(
      `https://maps-api.apple.com/v1/search?q=${encodeURIComponent(q)}&lang=en-US`,
      { signal, headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: AppleMapsResult[] };
  const seen = new Set<string>();
  const out: GeoResult[] = [];

  for (const place of data.results ?? []) {
    const addr = place.structuredAddress;
    const city = addr?.locality || place.name;
    const state = addr?.administrativeArea;
    const country = place.country;       // top-level field
    const countryCode = place.countryCode; // top-level field

    if (!city || !country) continue;

    const key = `${city.toLowerCase()}|${country.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      place_id: `apple:${city.toLowerCase().replace(/\s+/g, "-")}:${countryCode?.toLowerCase() ?? ""}`,
      display_name: [city, state, country].filter(Boolean).join(", "),
      lat: place.coordinate.latitude,
      lng: place.coordinate.longitude,
      address: { city, state, country, country_code: countryCode },
      type: "city",
      class: "place",
      addresstype: "city",
    });
  }
  return out;
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

    // City → use its own name; anything finer → use parent city from address
    const resolvedCity = isStrictCity
      ? r.display_name.split(",")[0].trim()
      : nominatimAddrCity(addr);
    if (!resolvedCity) continue;

    // Nominatim uses slash-separated bilingual names (e.g. "Valais/Wallis") —
    // keep only the first segment for display and dedup consistency
    const cleanState = state?.split("/")[0].trim();
    const key = `${resolvedCity.toLowerCase()}|${cleanState?.toLowerCase() ?? ""}|${country?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

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
 * Combined city search.
 *
 * Priority:
 *   1. Apple Maps Server API  — best ranking (same as native Maps app), free 25k/day
 *   2. Geoapify (via backend) — fills gaps when Apple returns nothing
 *   3. Nominatim              — last-resort for obscure places / landmark → city
 *
 * All three run in parallel. Results are normalized to "City, State, Country",
 * deduplicated across providers (handles bilingual state-name mismatches like
 * "Valais" vs "Valais/Wallis"), and ranked so exact/prefix matches float up.
 */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const [appleRes, geoapifyRes, nominatimRes] = await Promise.allSettled([
    appleMapsGeocode(q, signal),
    geocode(q, signal),
    nominatimGeocode(q, signal),
  ]);

  if (signal?.aborted) {
    const err = new Error("AbortError");
    err.name = "AbortError";
    throw err;
  }

  const apple    = appleRes.status    === "fulfilled" ? appleRes.value    : [];
  const geoapify = (geoapifyRes.status === "fulfilled" ? geoapifyRes.value : [])
    .map(normalizeGeoapifyResult)
    .filter((r): r is GeoResult => r !== null);
  const nominatim = nominatimRes.status === "fulfilled" ? nominatimRes.value : [];

  // Apple is primary when it returns results; Geoapify is primary otherwise
  const primary   = apple.length > 0 ? apple : geoapify;
  const fallbacks = apple.length > 0 ? [...geoapify, ...nominatim] : nominatim;

  const seenFull  = new Set(primary.map(cityDedupKey));
  const seenShort = new Set(primary.map(cityShortKey));
  const merged = [
    ...primary,
    ...fallbacks.filter(
      (r) => !seenFull.has(cityDedupKey(r)) && !seenShort.has(cityShortKey(r))
    ),
  ];

  return rankByRelevance(merged, q).slice(0, 10);
}

// ─── Boundary ────────────────────────────────────────────────────────────────

export type BoundaryGeometry =
  | { type: "Polygon";      coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

/** Fetch the GeoJSON boundary polygon for a lat/lng using Nominatim reverse geocode.
 *  addresstype drives the zoom level so we get the right admin boundary (city vs country etc). */
export async function fetchPlaceBoundary(
  lat: number,
  lng: number,
  addresstype?: string | null,
): Promise<BoundaryGeometry | null> {
  // Nominatim reverse zoom: 3=country 5=state 8=county 10=city 12=suburb
  const at = addresstype?.toLowerCase() ?? "";
  let zoom = 10;
  if (at === "country") zoom = 3;
  else if (at === "state" || at === "province" || at === "region") zoom = 5;
  else if (at === "county" || at === "district") zoom = 8;
  else if (at === "suburb" || at === "quarter" || at === "neighbourhood") zoom = 12;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&polygon_geojson=1&zoom=${zoom}`,
      { headers: { "Accept-Language": "en" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Reverse endpoint puts the polygon in `geojson` (not `geometry`)
    const g = data.geojson;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return null;
    return g as BoundaryGeometry;
  } catch {
    return null;
  }
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export type ProfileBody = {
  first_name?: string;
  last_name?: string;
  username?: string;
};

/** GET /api/profile */
export async function fetchProfile(accessToken: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`fetchProfile: ${res.status}`);
  const data = await res.json() as { profile: UserProfile };
  return data.profile;
}

/** PUT /api/profile */
export async function updateProfile(
  accessToken: string,
  body: ProfileBody,
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.details ?? err.error ?? `updateProfile: ${res.status}`);
  }
  const data = await res.json() as { profile: UserProfile };
  return data.profile;
}

/** GET /api/username-available?u= — { available, reason? } */
export async function checkUsernameAvailable(
  accessToken: string,
  username: string,
  signal?: AbortSignal,
): Promise<{ available: boolean; reason?: string }> {
  const res = await fetch(
    `${API_BASE}/api/username-available?u=${encodeURIComponent(username)}`,
    { headers: authHeaders(accessToken), signal },
  );
  if (!res.ok) throw new Error(`checkUsernameAvailable: ${res.status}`);
  return res.json();
}

// ─── Friends ─────────────────────────────────────────────────────────────────

export type FriendProfilePayload = {
  profile: UserProfile;
  places: SavedPlace[];
  stats: ExplrdStats;
};

/** GET /api/public-profile/:slug — no auth required, profile must be public */
export async function fetchPublicProfile(
  slug: string,
  signal?: AbortSignal
): Promise<FriendProfilePayload> {
  const res = await fetch(
    `${API_BASE}/api/public-profile/${encodeURIComponent(slug)}`,
    { signal }
  );
  if (res.status === 404) {
    throw new Error("No public explrd profile found for that link.");
  }
  if (!res.ok) throw new Error(`fetchPublicProfile: ${res.status}`);
  return res.json();
}

/** GET /api/friends — friends + incoming/outgoing requests for the caller. */
export async function fetchFriends(accessToken: string): Promise<FriendsPayload> {
  const res = await fetch(`${API_BASE}/api/friends`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`fetchFriends: ${res.status}`);
  return res.json();
}

/** POST /api/friends/request — send (or auto-accept reverse) by @username. */
export async function sendFriendRequest(
  accessToken: string,
  username: string,
): Promise<{ status: "pending" | "accepted" }> {
  const res = await fetch(`${API_BASE}/api/friends/request`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.details ?? err.error ?? `sendFriendRequest: ${res.status}`);
  }
  return res.json();
}

/** POST /api/friends/respond — accept or reject an incoming request. */
export async function respondToFriendRequest(
  accessToken: string,
  requestId: string,
  action: "accept" | "reject",
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/friends/respond`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ requestId, action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.details ?? err.error ?? `respondToFriendRequest: ${res.status}`);
  }
}

/** DELETE /api/friends — un-friend or withdraw an outgoing request. */
export async function removeFriend(
  accessToken: string,
  userId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/friends`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.details ?? err.error ?? `removeFriend: ${res.status}`);
  }
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
