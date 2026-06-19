import {
  AssetField,
  MediaType,
  Query,
  type Asset,
} from "expo-media-library";
import { reverseGeocodeCity, type GeoResult } from "./api";

/**
 * Photo-library location import.
 *
 * iPhone-only. Reads the GPS coordinate baked into each photo, clusters those
 * coordinates onto a coarse grid (so a whole metro area becomes one lookup),
 * reverse-geocodes each cluster to a city, and returns a deduped list of cities
 * the user has clearly visited — ready to confirm and save as places.
 *
 * Nothing leaves the device except anonymous lat/lng lookups during geocoding;
 * the photos themselves are never uploaded.
 */

export type DetectedCity = {
  place_id: string;
  display_name: string;
  lat: number;
  lng: number;
  address: GeoResult["address"];
  /** How many of the user's photos were taken in this city. */
  photoCount: number;
};

export type ScanProgress =
  | { phase: "reading"; scanned: number }
  | { phase: "resolving"; resolved: number; total: number };

// ── Tuning ───────────────────────────────────────────────────────────────────
// ~0.15° ≈ 16 km — collapses a city/metro area into a single reverse-geocode.
const GRID = 0.15;
// Page size for walking the library.
const PAGE = 500;
// Cap on photos walked. Ordered newest-first, so heavy libraries still capture
// recent travel; keeps a worst-case run bounded to a sensible duration.
const MAX_ASSETS = 10000;
// Native getLocation() calls in flight at once while reading.
const READ_CONCURRENCY = 12;
// Reverse-geocode lookups in flight at once.
const REVERSE_CONCURRENCY = 6;
// Safety cap on distinct clusters we'll reverse-geocode (busiest first).
const MAX_CLUSTERS = 400;

type Cluster = { lat: number; lng: number; count: number };

class ScanAbortError extends Error {
  constructor() {
    super("ScanAborted");
    this.name = "AbortError";
  }
}

export type ScanSignal = { aborted: boolean };

/** Run `task` over `items` with at most `limit` promises in flight. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await task(items[i]);
    }
  });
  await Promise.all(workers);
}

function addToCluster(map: Map<string, Cluster>, lat: number, lng: number) {
  const key = `${Math.round(lat / GRID)}:${Math.round(lng / GRID)}`;
  const existing = map.get(key);
  if (existing) existing.count += 1;
  else map.set(key, { lat, lng, count: 1 });
}

/**
 * Scan the photo library and resolve the cities the user has photographed.
 * Read access must already be granted. Pass `signal.aborted = true` to cancel.
 */
export async function scanPhotosForCities(opts: {
  onProgress?: (p: ScanProgress) => void;
  signal?: ScanSignal;
} = {}): Promise<DetectedCity[]> {
  const { onProgress, signal } = opts;
  const clusters = new Map<string, Cluster>();
  let scanned = 0;
  let offset = 0;

  // 1) Walk the library newest-first, clustering each photo's GPS coordinate.
  for (;;) {
    if (signal?.aborted) throw new ScanAbortError();

    const assets: Asset[] = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .limit(PAGE)
      .offset(offset)
      .exe();

    if (assets.length === 0) break;

    await mapWithConcurrency(assets, READ_CONCURRENCY, async (asset) => {
      if (signal?.aborted) return;
      try {
        const loc = await asset.getLocation();
        if (loc) addToCluster(clusters, loc.latitude, loc.longitude);
      } catch {
        // Asset removed mid-scan or has no readable location — skip it.
      }
    });

    scanned += assets.length;
    onProgress?.({ phase: "reading", scanned });
    offset += assets.length;

    if (assets.length < PAGE || scanned >= MAX_ASSETS) break;
  }

  if (signal?.aborted) throw new ScanAbortError();

  // 2) Reverse-geocode the busiest clusters and merge by resolved city.
  const reps = [...clusters.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_CLUSTERS);

  const cities = new Map<string, DetectedCity>();
  let resolved = 0;

  await mapWithConcurrency(reps, REVERSE_CONCURRENCY, async (cluster) => {
    if (signal?.aborted) return;
    const result = await reverseGeocodeCity(cluster.lat, cluster.lng).catch(() => null);
    resolved += 1;
    onProgress?.({ phase: "resolving", resolved, total: reps.length });
    if (!result) return;

    const existing = cities.get(result.place_id);
    if (existing) {
      existing.photoCount += cluster.count;
    } else {
      cities.set(result.place_id, {
        place_id: result.place_id,
        display_name: result.display_name,
        lat: result.lat,
        lng: result.lng,
        address: result.address,
        photoCount: cluster.count,
      });
    }
  });

  if (signal?.aborted) throw new ScanAbortError();

  return [...cities.values()].sort((a, b) => b.photoCount - a.photoCount);
}
