import { getContinentFromCountryCode, getContinentFromCountryName } from "./continents";
import type { GeoFeatureCollection, MapMode, SavedPlace } from "./types";

type AddressRecord = Record<string, string | number | boolean | null | undefined>;

export type NormalizedGeography = {
  normalized_city: string | null;
  normalized_state: string | null;
  normalized_country: string | null;
  normalized_continent: string | null;
};

export type GeographySelection = {
  city: string | null;
  state: string | null;
  country: string | null;
  continent: string | null;
};

export type MapEntity = {
  id: string;
  label: string;
  subtitle: string | null;
  lat: number;
  lng: number;
  count: number;
};

export type PlaceGroup = {
  id: string;
  label: string;
  context: string | null;
  count: number;
  places: SavedPlace[];
};

function getPrimaryGeographyValue(geography: GeographySelection, mode: MapMode) {
  if (mode === "city") return geography.city;
  if (mode === "state") return geography.state;
  if (mode === "country") return geography.country;
  return geography.continent;
}

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanCode(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

function fallbackTitleCase(value: string | null) {
  if (!value) return null;
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickCity(address: AddressRecord) {
  const candidate =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.city_district ??
    address.county;

  return typeof candidate === "string" ? candidate : null;
}

export function normalizeAddress(address: AddressRecord): NormalizedGeography {
  const normalized_city = cleanText(pickCity(address));
  const normalized_state =
    typeof address.state === "string"
      ? cleanText(address.state)
      : typeof address.region === "string"
        ? cleanText(address.region)
        : null;
  const normalized_country = typeof address.country === "string" ? cleanText(address.country) : null;
  const normalized_continent =
    getContinentFromCountryCode(
      typeof address.country_code === "string" ? address.country_code : null
    ) ?? getContinentFromCountryName(normalized_country);

  return {
    normalized_city,
    normalized_state,
    normalized_country,
    normalized_continent,
  };
}

export function getSavableLocality(address: AddressRecord) {
  const normalized = normalizeAddress(address);
  const normalized_city = normalized.normalized_city;
  const normalized_state = normalized.normalized_state;
  const normalized_country = normalized.normalized_country;

  const city =
    normalized_city ??
    (!normalized_city && !normalized_state && normalized_country ? normalized_country : null);

  return {
    city,
    state: normalized_state,
    country: normalized_country,
    continent: normalized.normalized_continent,
    normalized_city: city,
    normalized_state,
    normalized_country,
    normalized_continent: normalized.normalized_continent,
  };
}

function getCountryCode(address: AddressRecord) {
  return typeof address.country_code === "string" ? cleanCode(address.country_code) : null;
}

function getStateCode(address: AddressRecord) {
  const codeCandidate =
    address.state_code ??
    address["ISO3166-2-lvl4"] ??
    address["ISO3166-2-lvl3"] ??
    address["ISO3166-2-lvl5"] ??
    address["ISO3166-2-lvl6"] ??
    address["ISO3166-2-lvl8"];

  if (typeof codeCandidate !== "string") return null;

  const normalized = cleanCode(codeCandidate);
  if (!normalized) return null;

  const [, subdivision] = normalized.split("-");
  return subdivision ?? normalized;
}

export function getGeographySelection(input: Partial<GeographySelection>): GeographySelection {
  return {
    city: cleanText(input.city),
    state: cleanText(input.state),
    country: cleanText(input.country),
    continent: cleanText(input.continent),
  };
}

export function getAddressGeography(address: AddressRecord) {
  const normalized = normalizeAddress(address);

  return getGeographySelection({
    city: normalized.normalized_city,
    state: normalized.normalized_state,
    country: normalized.normalized_country,
    continent: normalized.normalized_continent,
  });
}

export function getAddressSearchDisplay(address: AddressRecord, fallback: string) {
  const geography = getAddressGeography(address);
  const stateToken = getStateCode(address) ?? geography.state;
  const countryToken = getCountryCode(address) ?? geography.country;

  if (geography.city) {
    return {
      title: [geography.city, stateToken, countryToken].filter(Boolean).join(", "),
      subtitle: geography.continent ?? fallbackTitleCase(geography.country) ?? fallback,
    };
  }

  if (geography.state) {
    return {
      title: [stateToken, countryToken].filter(Boolean).join(", "),
      subtitle: geography.continent ?? fallbackTitleCase(geography.country) ?? fallback,
    };
  }

  if (geography.country) {
    return {
      title: countryToken ?? geography.country,
      subtitle: geography.continent ?? fallback,
    };
  }

  return {
    title: fallback,
    subtitle: geography.continent ?? fallback,
  };
}

export function getNormalizedPlace(place: SavedPlace) {
  return getGeographySelection({
    city: cleanText(place.normalized_city) ?? cleanText(place.city),
    state: cleanText(place.normalized_state) ?? cleanText(place.state),
    country: cleanText(place.normalized_country) ?? cleanText(place.country),
    continent:
      cleanText(place.normalized_continent) ??
      cleanText(place.continent) ??
      getContinentFromCountryName(place.normalized_country ?? place.country),
  });
}

export function getGeographyKey(geography: GeographySelection, mode: MapMode) {
  if (mode === "city") {
    return [geography.city, geography.state, geography.country].filter(Boolean).join("|") || null;
  }

  if (mode === "state") {
    return [geography.state, geography.country].filter(Boolean).join("|") || null;
  }

  if (mode === "country") {
    return geography.country;
  }

  return geography.continent;
}

export function getGeographyLabel(geography: GeographySelection, mode: MapMode) {
  if (mode === "city") {
    return geography.city ?? geography.state ?? geography.country ?? "Mapped place";
  }

  if (mode === "state") {
    return geography.state ?? geography.country ?? geography.continent ?? "Mapped region";
  }

  if (mode === "country") {
    return geography.country ?? geography.continent ?? "Mapped country";
  }

  return geography.continent ?? "Mapped continent";
}

export function getGeographyContext(geography: GeographySelection, mode: MapMode) {
  if (mode === "city") {
    return [geography.state, geography.country, geography.continent].filter(Boolean).join(" • ") || null;
  }

  if (mode === "state") {
    return [geography.country, geography.continent].filter(Boolean).join(" • ") || null;
  }

  if (mode === "country") {
    return geography.continent ?? null;
  }

  return [geography.country, geography.state, geography.city].filter(Boolean).join(" • ") || null;
}

export function getBoundaryQuery(geography: GeographySelection, mode: MapMode) {
  if (!getPrimaryGeographyValue(geography, mode)) {
    return null;
  }

  if (mode === "city") {
    return [geography.city, geography.state, geography.country].filter(Boolean).join(", ") || null;
  }

  if (mode === "state") {
    return [geography.state, geography.country].filter(Boolean).join(", ") || null;
  }

  if (mode === "country") {
    return geography.country;
  }

  return geography.continent;
}

export function getModeGeographies(places: SavedPlace[], mode: MapMode) {
  const uniqueGeographies = new Map<string, GeographySelection>();

  places.forEach((place) => {
    const geography = getNormalizedPlace(place);
    if (!getPrimaryGeographyValue(geography, mode)) return;
    const key = getGeographyKey(geography, mode);

    if (!key || uniqueGeographies.has(key)) return;
    uniqueGeographies.set(key, geography);
  });

  return Array.from(uniqueGeographies.values());
}

export function getStoredBoundary(place: SavedPlace, mode: MapMode): GeoFeatureCollection | null {
  if (mode === "city") return place.city_boundary;
  if (mode === "state") return place.state_boundary;
  if (mode === "country") return place.country_boundary;
  return place.continent_boundary;
}

export function getExplorationLabel(place: SavedPlace, mode: MapMode) {
  const normalized = getNormalizedPlace(place);
  return getGeographyLabel(normalized, mode) ?? fallbackTitleCase(place.continent) ?? "Mapped continent";
}

export function getExplorationSubtitle(place: SavedPlace, mode: MapMode) {
  const normalized = getNormalizedPlace(place);
  return (
    getGeographyContext(normalized, mode) ??
    `${[normalized.country, normalized.state, normalized.city].filter(Boolean)[0] ?? "Explored"} footprint`
  );
}

export function getModeLabel(mode: MapMode) {
  if (mode === "city") return "City";
  if (mode === "state") return "State";
  if (mode === "country") return "Country";
  return "Continent";
}

export function getModeLabelPlural(mode: MapMode) {
  if (mode === "city") return "Cities";
  if (mode === "state") return "States";
  if (mode === "country") return "Countries";
  return "Continents";
}

function getModeKey(place: SavedPlace, mode: MapMode) {
  return getGeographyKey(getNormalizedPlace(place), mode) ?? place.place_id;
}

export function getMapEntities(places: SavedPlace[], mode: MapMode): MapEntity[] {
  const grouped = new Map<
    string,
    {
      label: string;
      subtitle: string | null;
      latTotal: number;
      lngTotal: number;
      count: number;
    }
  >();

  places.forEach((place) => {
    const key = getModeKey(place, mode);
    const current = grouped.get(key);

    if (current) {
      current.latTotal += place.lat;
      current.lngTotal += place.lng;
      current.count += 1;
      return;
    }

    grouped.set(key, {
      label: getExplorationLabel(place, mode),
      subtitle: getExplorationSubtitle(place, mode),
      latTotal: place.lat,
      lngTotal: place.lng,
      count: 1,
    });
  });

  return Array.from(grouped.entries()).map(([id, entry]) => ({
    id,
    label: entry.label,
    subtitle: entry.subtitle,
    lat: entry.latTotal / entry.count,
    lng: entry.lngTotal / entry.count,
    count: entry.count,
  }));
}

export function getPlaceMemoryTitle(place: SavedPlace) {
  const normalized = getNormalizedPlace(place);
  return normalized.city ?? normalized.state ?? normalized.country ?? place.formatted ?? place.name ?? "Saved place";
}

export function getPlaceMemoryMeta(place: SavedPlace) {
  const normalized = getNormalizedPlace(place);
  return [normalized.state, normalized.country, normalized.continent].filter(Boolean).join(" • ");
}

export function groupPlacesByMode(places: SavedPlace[], mode: MapMode): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();

  places.forEach((place) => {
    const geography = getNormalizedPlace(place);
    const key = getGeographyKey(geography, mode) ?? place.place_id;
    const current = groups.get(key);

    if (current) {
      current.count += 1;
      current.places.push(place);
      return;
    }

    groups.set(key, {
      id: key,
      label: getGeographyLabel(geography, mode),
      context: getGeographyContext(geography, mode),
      count: 1,
      places: [place],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      places: [...group.places].sort((left, right) =>
        getPlaceMemoryTitle(left).localeCompare(getPlaceMemoryTitle(right))
      ),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label);
    });
}
