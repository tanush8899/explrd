import { getBoundaryQuery, getNormalizedPlace } from "@/lib/exploration";
import { resolveBoundaryFeatureCollection } from "@/lib/region-boundaries";
import {
  getStaticContinentFeatureCollection,
  getStaticCountryFeatureCollection,
} from "@/lib/static-boundaries";
import type { GeoFeatureCollection, SavedPlace } from "@/lib/types";

export function parseBoundary(value: unknown): GeoFeatureCollection | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as GeoFeatureCollection;
    } catch {
      return null;
    }
  }

  return value as GeoFeatureCollection;
}

export async function hydratePlaceBoundaries(
  place: SavedPlace,
  options?: { skipExternalFetch?: boolean }
): Promise<SavedPlace> {
  const geography = getNormalizedPlace(place);
  const canonicalCountryBoundary = getStaticCountryFeatureCollection(geography.country);
  const canonicalContinentBoundary = getStaticContinentFeatureCollection(geography.continent);

  if (options?.skipExternalFetch) {
    return {
      ...place,
      country_boundary: canonicalCountryBoundary,
      continent_boundary: canonicalContinentBoundary,
    };
  }

  const [cityBoundary, stateBoundary] = await Promise.all([
    place.city_boundary ||
    !geography.city
      ? Promise.resolve(place.city_boundary)
      : resolveBoundaryFeatureCollection({
          mode: "city",
          placeId: place.place_id,
          lat: place.lat,
          lng: place.lng,
          city: geography.city,
          state: geography.state,
          country: geography.country,
          continent: geography.continent,
          query: getBoundaryQuery(geography, "city"),
        }),
    place.state_boundary ||
    !geography.state
      ? Promise.resolve(place.state_boundary)
      : resolveBoundaryFeatureCollection({
          mode: "state",
          placeId: place.place_id,
          lat: place.lat,
          lng: place.lng,
          city: geography.city,
          state: geography.state,
          country: geography.country,
          continent: geography.continent,
          query: getBoundaryQuery(geography, "state"),
        }),
  ]);

  return {
    ...place,
    city_boundary: cityBoundary,
    state_boundary: stateBoundary,
    country_boundary: canonicalCountryBoundary,
    continent_boundary: canonicalContinentBoundary,
  };
}
