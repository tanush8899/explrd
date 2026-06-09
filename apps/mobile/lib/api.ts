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

const CITY_ADDR_TYPES = new Set([
  "city", "town", "village", "hamlet", "municipality",
  "borough", "suburb", "quarter", "neighbourhood", "neighborhood",
  "district", "city_district", "county", "locality", "island",
]);

function nominatimCity(addr: Record<string, string | undefined>): string | undefined {
  return (
    addr.city ?? addr.town ?? addr.village ??
    addr.municipality ?? addr.borough ?? addr.hamlet
  );
}

/** Search Nominatim directly; POIs are resolved to their parent city. */
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
    const city = nominatimCity(addr);
    const state = addr.state;
    const country = addr.country;
    const countryCode = addr.country_code?.toUpperCase();
    const isCity = CITY_ADDR_TYPES.has((r.addresstype ?? "").toLowerCase());

    if (isCity) {
      const resolvedCity = r.display_name.split(",")[0].trim();
      const key = `${resolvedCity.toLowerCase()}|${state?.toLowerCase() ?? ""}|${country?.toLowerCase() ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        place_id: `nom:${r.place_id}`,
        display_name: [resolvedCity, state, country].filter(Boolean).join(", "),
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        address: { city: resolvedCity, state, country, country_code: countryCode },
        type: r.type ?? null,
        class: r.class ?? null,
        addresstype: r.addresstype ?? null,
        landmark_name: null,
      });
    } else if (city) {
      // POI/landmark — surface its parent city instead
      const key = `${city.toLowerCase()}|${state?.toLowerCase() ?? ""}|${country?.toLowerCase() ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Keep the landmark name (e.g. "Penn State University") as context
      const landmarkName = r.display_name.split(",")[0].trim();
      out.push({
        place_id: `nom:city:${key.replace(/\|/g, ":")}`,
        display_name: [city, state, country].filter(Boolean).join(", "),
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        address: { city, state, country, country_code: countryCode },
        type: "city",
        class: "place",
        addresstype: "city",
        landmark_name: landmarkName !== city ? landmarkName : null,
      });
    }
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

/**
 * Combined city/landmark search.
 * Primary results come from the Geoapify backend; Nominatim supplements with
 * any landmark → city resolutions that Geoapify missed (e.g. "Penn State",
 * "Big Bend", "Cape May").
 */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const [geoapifyRes, nominatimRes] = await Promise.allSettled([
    geocode(q, signal),
    nominatimGeocode(q, signal),
  ]);

  // Propagate abort so the caller's catch block can suppress UI updates
  if (signal?.aborted) {
    const err = new Error("AbortError");
    err.name = "AbortError";
    throw err;
  }

  const primary = geoapifyRes.status === "fulfilled" ? geoapifyRes.value : [];
  const supplement = nominatimRes.status === "fulfilled" ? nominatimRes.value : [];

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
