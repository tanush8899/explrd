import { iso31661, iso31662 } from "iso-3166";
import { getContinentFromCountryCode } from "./continents";
import { getNormalizedPlace, getPlaceMemoryTitle } from "./exploration";
import type { SavedPlace } from "./types";

export type CountryCoverage = {
  country: string;
  continent: string | null;
  exploredPlaces: number;
  exploredCities: number;
  exploredStates: number;
  totalStates: number | null;
  percentExplored: number | null;
  latestPlace: string | null;
  states: string[];
};

export type ContinentSummary = {
  continent: string;
  countries: number;
  cities: number;
  places: number;
  totalCountries: number;
  percentExplored: number;
};

export type CityNode = {
  city: string;
  places: SavedPlace[];
};

export type StateNode = {
  state: string | null;
  cities: CityNode[];
  placesCount: number;
};

export type CountryNode = CountryCoverage & {
  statesHierarchy: StateNode[];
};

export type ContinentNode = {
  continent: string;
  countries: CountryNode[];
  placesCount: number;
  exploredCountries: number;
  totalCountries: number;
  percentExplored: number;
};

const firstLevelSubdivisionCounts = iso31662.reduce((counts, subdivision) => {
  if (!/^[A-Z]{2}$/.test(subdivision.parent)) {
    return counts;
  }

  counts.set(subdivision.parent, (counts.get(subdivision.parent) ?? 0) + 1);
  return counts;
}, new Map<string, number>());

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
  const aliases = [country.alpha2, country.alpha3, country.name];

  aliases.forEach((value) => {
    map.set(value.trim().toLowerCase(), country.alpha2);
  });

  return map;
}, new Map<string, string>());

Object.entries(COUNTRY_ALIAS_OVERRIDES).forEach(([alias, iso2]) => {
  countryAliasToIso2.set(alias, iso2);
});

const continentCountryCounts = iso31661.reduce((counts, country) => {
  const continent = getContinentFromCountryCode(country.alpha2);

  if (!continent) {
    return counts;
  }

  counts.set(continent, (counts.get(continent) ?? 0) + 1);
  return counts;
}, new Map<string, number>());

function getCountryIso2(country: string | null | undefined) {
  if (!country) return null;

  const normalized = country.trim().toLowerCase();

  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return countryAliasToIso2.get(normalized) ?? null;
}

function getPercent(explored: number, total: number | null) {
  if (!total || explored <= 0) return 0;
  return Math.max(1, Math.round((explored / total) * 100));
}

function normalizeHierarchyState(state: string | null, country: string | null) {
  if (!state) return null;
  if (country && state.trim().toLowerCase() === country.trim().toLowerCase()) {
    return null;
  }
  return state;
}

function normalizeHierarchyCity(city: string | null, state: string | null, country: string | null) {
  if (!city) return null;
  const normalizedCity = city.trim().toLowerCase();

  if (state && normalizedCity === state.trim().toLowerCase()) {
    return null;
  }

  if (country && normalizedCity === country.trim().toLowerCase()) {
    return null;
  }

  return city;
}

export function getCountryCoverage(places: SavedPlace[]): CountryCoverage[] {
  const coverage = new Map<
    string,
    {
      country: string;
      continent: string | null;
      places: SavedPlace[];
      cities: Set<string>;
      states: Set<string>;
    }
  >();

  places.forEach((place) => {
    const normalized = getNormalizedPlace(place);
    const country = normalized.country;

    if (!country) return;

    const current = coverage.get(country);

    if (current) {
      current.places.push(place);
      if (normalized.city) current.cities.add(normalized.city);
      if (normalized.state) current.states.add(normalized.state);
      return;
    }

    coverage.set(country, {
      country,
      continent: normalized.continent,
      places: [place],
      cities: normalized.city ? new Set([normalized.city]) : new Set<string>(),
      states: normalized.state ? new Set([normalized.state]) : new Set<string>(),
    });
  });

  return Array.from(coverage.values())
    .map((entry) => {
      const iso2 = getCountryIso2(entry.country);
      const totalStates = iso2 ? firstLevelSubdivisionCounts.get(iso2) ?? null : null;
      const exploredStates = entry.states.size;
      const effectiveExploredStates =
        exploredStates > 0 ? exploredStates : entry.cities.size > 0 ? 1 : 0;

      return {
        country: entry.country,
        continent: entry.continent,
        exploredPlaces: entry.places.length,
        exploredCities: entry.cities.size,
        exploredStates,
        totalStates,
        percentExplored: totalStates ? getPercent(Math.min(effectiveExploredStates, totalStates), totalStates) : entry.cities.size > 0 ? 1 : null,
        latestPlace: entry.places[0] ? getPlaceMemoryTitle(entry.places[0]) : null,
        states: Array.from(entry.states).sort((left, right) => left.localeCompare(right)),
      } satisfies CountryCoverage;
    })
    .sort((left, right) => {
      if ((right.percentExplored ?? -1) !== (left.percentExplored ?? -1)) {
        return (right.percentExplored ?? -1) - (left.percentExplored ?? -1);
      }

      if (right.exploredPlaces !== left.exploredPlaces) {
        return right.exploredPlaces - left.exploredPlaces;
      }

      return left.country.localeCompare(right.country);
    });
}

export function getContinentSummary(places: SavedPlace[]): ContinentSummary[] {
  const grouped = new Map<
    string,
    {
      countries: Set<string>;
      cities: Set<string>;
      places: number;
    }
  >();

  places.forEach((place) => {
    const normalized = getNormalizedPlace(place);
    const continent = normalized.continent;

    if (!continent) return;

    const current = grouped.get(continent) ?? {
      countries: new Set<string>(),
      cities: new Set<string>(),
      places: 0,
    };

    if (normalized.country) current.countries.add(normalized.country);
    if (normalized.city) current.cities.add(normalized.city);

    current.places += 1;
    grouped.set(continent, current);
  });

  return Array.from(grouped.entries())
    .map(([continent, entry]) => {
      const totalCountries = continentCountryCounts.get(continent) ?? entry.countries.size;

      return {
        continent,
        countries: entry.countries.size,
        cities: entry.cities.size,
        places: entry.places,
        totalCountries,
        percentExplored: getPercent(entry.countries.size, totalCountries),
      } satisfies ContinentSummary;
    })
    .sort((left, right) => right.places - left.places || left.continent.localeCompare(right.continent));
}

export function getPlaceHierarchy(places: SavedPlace[]): ContinentNode[] {
  const countryCoverage = new Map(
    getCountryCoverage(places).map((entry) => [entry.country, entry] as const)
  );

  const continents = new Map<
    string,
    {
      countries: Map<
        string,
        {
          places: SavedPlace[];
          states: Map<string, Map<string, SavedPlace[]>>;
        }
      >;
      placesCount: number;
    }
  >();

  places.forEach((place) => {
    const normalized = getNormalizedPlace(place);
    const continent = normalized.continent ?? "Other";
    const country = normalized.country ?? "Other";
    const state = normalizeHierarchyState(normalized.state, country);
    const city = normalizeHierarchyCity(normalized.city, state, country) ?? getPlaceMemoryTitle(place);

    const continentEntry = continents.get(continent) ?? {
      countries: new Map(),
      placesCount: 0,
    };

    const countryEntry = continentEntry.countries.get(country) ?? {
      places: [],
      states: new Map(),
    };

    const stateKey = state ?? "__no_state__";
    const stateEntry = countryEntry.states.get(stateKey) ?? new Map<string, SavedPlace[]>();
    const cityEntry = stateEntry.get(city) ?? [];

    cityEntry.push(place);
    stateEntry.set(city, cityEntry);
    countryEntry.states.set(stateKey, stateEntry);
    countryEntry.places.push(place);
    continentEntry.countries.set(country, countryEntry);
    continentEntry.placesCount += 1;
    continents.set(continent, continentEntry);
  });

  return Array.from(continents.entries())
    .map(([continent, continentEntry]) => {
      const countries = Array.from(continentEntry.countries.entries())
        .map(([country, countryEntry]) => {
          const statesHierarchy = Array.from(countryEntry.states.entries())
            .map(([stateKey, citiesMap]) => ({
              state: stateKey === "__no_state__" ? null : stateKey,
              placesCount: Array.from(citiesMap.values()).reduce((sum, cityPlaces) => sum + cityPlaces.length, 0),
              cities: Array.from(citiesMap.entries())
                .map(([city, cityPlaces]) => ({
                  city,
                  places: [...cityPlaces].sort((left, right) =>
                    getPlaceMemoryTitle(left).localeCompare(getPlaceMemoryTitle(right))
                  ),
                }))
                .sort((left, right) => left.city.localeCompare(right.city)),
            }))
            .sort((left, right) => {
              if (left.state === null) return 1;
              if (right.state === null) return -1;
              return left.state.localeCompare(right.state);
            });

          const coverage = countryCoverage.get(country);

          return {
            country,
            continent: coverage?.continent ?? continent,
            exploredPlaces: coverage?.exploredPlaces ?? countryEntry.places.length,
            exploredCities: coverage?.exploredCities ?? 0,
            exploredStates: coverage?.exploredStates ?? statesHierarchy.length,
            totalStates: coverage?.totalStates ?? null,
            percentExplored: coverage?.percentExplored ?? null,
            latestPlace: coverage?.latestPlace ?? null,
            states: coverage?.states ?? statesHierarchy.map((entry) => entry.state).filter(Boolean) as string[],
            statesHierarchy,
          } satisfies CountryNode;
        })
        .sort((left, right) => left.country.localeCompare(right.country));

      const totalCountries = continentCountryCounts.get(continent) ?? countries.length;

      return {
        continent,
        countries,
        placesCount: continentEntry.placesCount,
        exploredCountries: countries.length,
        totalCountries,
        percentExplored: getPercent(countries.length, totalCountries),
      } satisfies ContinentNode;
    })
    .sort((left, right) => {
      const leftHasCoverage = left.percentExplored > 0 ? 1 : 0;
      const rightHasCoverage = right.percentExplored > 0 ? 1 : 0;

      if (rightHasCoverage !== leftHasCoverage) {
        return rightHasCoverage - leftHasCoverage;
      }

      if (right.placesCount !== left.placesCount) {
        return right.placesCount - left.placesCount;
      }

      return left.continent.localeCompare(right.continent);
    });
}

export function getRecentPlaces(places: SavedPlace[], limit = 5) {
  return places.slice(0, limit);
}
