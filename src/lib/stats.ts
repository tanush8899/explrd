import { iso31661, iso31662 } from "iso-3166";
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
  percentWorldTraveled: number;
  worldExploredBreakdown: {
    countries: number;
    regions: number;
    cities: number;
  };
  score: number;
};

const COUNTRY_ALIAS_OVERRIDES: Record<string, string> = {
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  russia: "RU",
  "russian federation": "RU",
  bolivia: "BO",
  "bolivia (plurinational state of)": "BO",
  tanzania: "TZ",
  "united republic of tanzania": "TZ",
  iran: "IR",
  "iran (islamic republic of)": "IR",
  moldova: "MD",
  "republic of moldova": "MD",
  venezuela: "VE",
  "venezuela (bolivarian republic of)": "VE",
  vietnam: "VN",
  "viet nam": "VN",
  syria: "SY",
  "syrian arab republic": "SY",
  laos: "LA",
  "lao pdr": "LA",
  "lao people's democratic republic": "LA",
  brunei: "BN",
  "brunei darussalam": "BN",
  macedonia: "MK",
  "north macedonia": "MK",
  "czech republic": "CZ",
  czechia: "CZ",
};

const countryAliasToIso2 = iso31661.reduce((map, country) => {
  [country.alpha2, country.alpha3, country.name].forEach((value) => {
    map.set(value.trim().toLowerCase(), country.alpha2);
  });
  return map;
}, new Map<string, string>());

Object.entries(COUNTRY_ALIAS_OVERRIDES).forEach(([alias, iso2]) => {
  countryAliasToIso2.set(alias, iso2);
});

const firstLevelSubdivisionCounts = iso31662.reduce((counts, subdivision) => {
  if (!/^[A-Z]{2}$/.test(subdivision.parent)) {
    return counts;
  }

  counts.set(subdivision.parent, (counts.get(subdivision.parent) ?? 0) + 1);
  return counts;
}, new Map<string, number>());

const countryWeightByIso2 = iso31661.reduce((weights, country) => {
  const subdivisions = firstLevelSubdivisionCounts.get(country.alpha2) ?? 0;
  const rawWeight = 1 + Math.log1p(Math.max(subdivisions, 1));
  weights.set(country.alpha2, rawWeight);
  return weights;
}, new Map<string, number>());

const totalCountryWeight = Array.from(countryWeightByIso2.values()).reduce(
  (sum, weight) => sum + weight,
  0
);

const COUNTRY_COVERAGE_WEIGHT = 0.62;
const REGION_COVERAGE_WEIGHT = 0.26;
const CITY_COVERAGE_WEIGHT = 0.12;

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getCountryIso2(country: string | null | undefined) {
  if (!country) return null;

  const normalized = country.trim().toLowerCase();
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return countryAliasToIso2.get(normalized) ?? null;
}

function getCityDepthTarget(totalStates: number) {
  return Math.max(4, Math.min(40, totalStates > 0 ? totalStates * 2 : 8));
}

function getDiminishingProgress(count: number, target: number) {
  if (count <= 0 || target <= 0) return 0;
  return Math.min(1, Math.log1p(count) / Math.log1p(target));
}

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
  const worldCoverage = new Map<
    string,
    {
      states: Set<string>;
      cities: Set<string>;
    }
  >();

  enrichedPlaces.forEach((place) => {
    if (!place.resolvedCountry) return;

    const iso2 = getCountryIso2(place.resolvedCountry);
    if (!iso2) return;

    const current = worldCoverage.get(iso2) ?? {
      states: new Set<string>(),
      cities: new Set<string>(),
    };

    if (place.resolvedState) {
      current.states.add(place.resolvedState.trim().toLowerCase());
    }

    if (place.resolvedCity) {
      const cityKey = [
        place.resolvedState?.trim().toLowerCase() ?? "__no_state__",
        place.resolvedCity.trim().toLowerCase(),
      ].join("|");
      current.cities.add(cityKey);
    }

    worldCoverage.set(iso2, current);
  });

  let countryContribution = 0;
  let regionContribution = 0;
  let cityContribution = 0;

  worldCoverage.forEach((coverage, iso2) => {
    const countryWeight = (countryWeightByIso2.get(iso2) ?? 1) / totalCountryWeight * 100;
    const totalStates = firstLevelSubdivisionCounts.get(iso2) ?? 0;
    const exploredStates = coverage.states.size;
    const exploredCities = coverage.cities.size;

    const stateProgress =
      totalStates > 0 ? Math.min(1, exploredStates / totalStates) : exploredStates > 0 ? 1 : 0;
    const cityProgress = getDiminishingProgress(exploredCities, getCityDepthTarget(totalStates));

    countryContribution += countryWeight * COUNTRY_COVERAGE_WEIGHT;
    regionContribution += countryWeight * REGION_COVERAGE_WEIGHT * stateProgress;
    cityContribution += countryWeight * CITY_COVERAGE_WEIGHT * cityProgress;
  });

  const percentWorldTraveled = roundToSingleDecimal(
    countryContribution + regionContribution + cityContribution
  );
  const worldExploredBreakdown = {
    countries: roundToSingleDecimal(countryContribution),
    regions: roundToSingleDecimal(regionContribution),
    cities: roundToSingleDecimal(cityContribution),
  };

  const stats = {
    totalPlaces: enrichedPlaces.length,
    uniqueCities: uniqueCities.size,
    uniqueStates: uniqueStates.size,
    uniqueCountries: uniqueCountries.size,
    uniqueContinents: uniqueContinents.size,
    percentWorldTraveled,
    worldExploredBreakdown,
    score: 0,
  };

  return {
    ...stats,
    score: calculateExplrdScore(stats),
  };
}
