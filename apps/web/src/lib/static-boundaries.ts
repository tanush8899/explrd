import fs from "node:fs";
import path from "node:path";
import union from "@turf/union";
import { getContinentFromCountryCode } from "@/lib/continents";
import type { GeoFeatureCollection, GeoFeature, Geometry } from "@/lib/types";

type RawFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
};

type RawFeatureCollection = {
  type: "FeatureCollection";
  features: RawFeature[];
};

const countriesDatasetPath = path.join(
  process.cwd(),
  "src",
  "data",
  "natural-earth-countries.geojson"
);
const rawCountries = JSON.parse(
  fs.readFileSync(countriesDatasetPath, "utf8")
) as RawFeatureCollection;

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

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function toSupportedGeometry(geometry: RawFeature["geometry"]): Geometry | null {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates as Geometry["coordinates"] & number[][][],
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates as Geometry["coordinates"] & number[][][][],
    };
  }

  return null;
}

function toGeoFeature(feature: RawFeature): GeoFeature | null {
  const geometry = toSupportedGeometry(feature.geometry);
  if (!geometry) return null;

  return {
    type: "Feature",
    properties: feature.properties as Record<string, string | number | boolean | null>,
    geometry,
  };
}

const countryFeatures = rawCountries.features
  .map((feature) => {
    const geoFeature = toGeoFeature(feature);
    if (!geoFeature) return null;

    return {
      feature: geoFeature,
      properties: feature.properties,
      iso2:
        typeof feature.properties.ISO_A2 === "string" && feature.properties.ISO_A2 !== "-99"
          ? feature.properties.ISO_A2
          : typeof feature.properties.WB_A2 === "string" && feature.properties.WB_A2 !== "-99"
            ? feature.properties.WB_A2
            : null,
      continent:
        typeof feature.properties.CONTINENT === "string" ? feature.properties.CONTINENT : null,
      aliases: new Set<string>(),
    };
  })
  .filter(Boolean) as Array<{
  feature: GeoFeature;
  properties: Record<string, unknown>;
  iso2: string | null;
  continent: string | null;
  aliases: Set<string>;
}>;

countryFeatures.forEach((entry) => {
  const aliasCandidates = [
    entry.iso2,
    typeof entry.properties.ISO_A3 === "string" ? entry.properties.ISO_A3 : null,
    typeof entry.properties.ADM0_A3 === "string" ? entry.properties.ADM0_A3 : null,
    typeof entry.properties.WB_A3 === "string" ? entry.properties.WB_A3 : null,
    typeof entry.properties.NAME === "string" ? entry.properties.NAME : null,
    typeof entry.properties.NAME_LONG === "string" ? entry.properties.NAME_LONG : null,
    typeof entry.properties.ADMIN === "string" ? entry.properties.ADMIN : null,
    typeof entry.properties.FORMAL_EN === "string" ? entry.properties.FORMAL_EN : null,
    typeof entry.properties.NAME_CIAWF === "string" ? entry.properties.NAME_CIAWF : null,
    typeof entry.properties.BRK_NAME === "string" ? entry.properties.BRK_NAME : null,
    typeof entry.properties.GEOUNIT === "string" ? entry.properties.GEOUNIT : null,
    typeof entry.properties.SOVEREIGNT === "string" ? entry.properties.SOVEREIGNT : null,
    typeof entry.properties.ABBREV === "string" ? entry.properties.ABBREV : null,
    typeof entry.properties.POSTAL === "string" ? entry.properties.POSTAL : null,
  ];

  aliasCandidates.forEach((candidate) => {
    const normalized = normalizeText(candidate);
    if (normalized) entry.aliases.add(normalized);
  });
});

const countryByIso2 = new Map<string, (typeof countryFeatures)[number]>();
const countryAliasToIso2 = new Map<string, string>();
const continentBoundaryByName = new Map<string, GeoFeatureCollection>();

countryFeatures.forEach((entry) => {
  if (!entry.iso2) return;
  countryByIso2.set(entry.iso2, entry);
  entry.aliases.forEach((alias) => {
    countryAliasToIso2.set(alias, entry.iso2 as string);
  });
});

Object.entries(COUNTRY_ALIAS_OVERRIDES).forEach(([alias, iso2]) => {
  countryAliasToIso2.set(alias, iso2);
});

const continentNames = [
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
];

continentNames.forEach((continent) => {
  const features = countryFeatures
    .filter((entry) => getContinentFromCountryCode(entry.iso2) === continent)
    .map((entry) => entry.feature);

  if (features.length === 0) return;

  const merged =
    features.length === 1
      ? features[0]
      : union({
          type: "FeatureCollection",
          features,
        });

  if (!merged) return;

  continentBoundaryByName.set(continent, {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: continent,
        },
        geometry: merged.geometry as Geometry,
      },
    ],
  });
});

export function getCountryIso2(country: string | null | undefined) {
  const normalized = normalizeText(country);
  if (!normalized) return null;

  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return countryAliasToIso2.get(normalized) ?? null;
}

export function getStaticCountryFeatureCollection(
  country: string | null | undefined
): GeoFeatureCollection | null {
  const iso2 = getCountryIso2(country);
  if (!iso2) return null;

  const match = countryByIso2.get(iso2);
  if (!match) return null;

  return {
    type: "FeatureCollection",
    features: [match.feature],
  };
}

export function getStaticContinentFeatureCollection(
  continent: string | null | undefined
): GeoFeatureCollection | null {
  if (!continent) return null;
  return continentBoundaryByName.get(continent) ?? null;
}
