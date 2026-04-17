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
