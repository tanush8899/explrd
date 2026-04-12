import { getNormalizedPlace } from "@/lib/exploration";
import type { SavedPlace } from "@/lib/types";

export type EnrichedPlace = SavedPlace & {
  resolvedContinent: string | null;
  resolvedCity: string | null;
  resolvedState: string | null;
  resolvedCountry: string | null;
};

export type ExplrdStats = {
  totalPlaces: number;
  uniqueCities: number;
  uniqueStates: number;
  uniqueCountries: number;
  uniqueContinents: number;
  score: number;
};

export function enrichPlaces(places: SavedPlace[]): EnrichedPlace[] {
  return places.map((place) => {
    const normalized = getNormalizedPlace(place);

    return {
      ...place,
      resolvedCity: normalized.city,
      resolvedState: normalized.state,
      resolvedCountry: normalized.country,
      resolvedContinent: normalized.continent,
    };
  });
}

export function calculateExplrdScore(input: {
  uniqueContinents: number;
  uniqueCountries: number;
  uniqueStates: number;
  totalPlaces: number;
}) {
  return (
    input.uniqueContinents * 25 +
    input.uniqueCountries * 10 +
    input.uniqueStates * 3 +
    input.totalPlaces
  );
}

export function getExplrdStats(places: SavedPlace[]): ExplrdStats {
  const enrichedPlaces = enrichPlaces(places);
  const uniqueCities = new Set(enrichedPlaces.map((place) => place.resolvedCity).filter(Boolean));
  const uniqueStates = new Set(enrichedPlaces.map((place) => place.resolvedState).filter(Boolean));
  const uniqueCountries = new Set(enrichedPlaces.map((place) => place.resolvedCountry).filter(Boolean));
  const uniqueContinents = new Set(
    enrichedPlaces.map((place) => place.resolvedContinent).filter(Boolean)
  );

  const stats = {
    totalPlaces: enrichedPlaces.length,
    uniqueCities: uniqueCities.size,
    uniqueStates: uniqueStates.size,
    uniqueCountries: uniqueCountries.size,
    uniqueContinents: uniqueContinents.size,
    score: 0,
  };

  return {
    ...stats,
    score: calculateExplrdScore(stats),
  };
}
