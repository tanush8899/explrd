"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import L from "leaflet";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  getBoundaryQuery,
  getExplorationLabel,
  getExplorationSubtitle,
  getGeographySelection,
  getGeographyKey,
  getMapEntities,
  getModeGeographies,
  getNormalizedPlace,
  getStoredBoundary,
} from "@/lib/exploration";
import type { GeoFeatureCollection, Geometry, MapMode, SavedPlace } from "@/lib/types";

type PlacesMapProps = {
  places: SavedPlace[];
  mode?: MapMode;
  defaultLayerView?: Array<"country" | "state" | "city">;
  previewPlace?: {
    place_id: string;
    display_name: string;
    lat: number;
    lng: number;
    address: Record<string, string | number | boolean | null | undefined>;
  } | null;
  heightClassName?: string;
  containerClassName?: string;
  theme?: "light" | "dark";
  focusStrategy?: "data" | "world";
  viewportInsets?: {
    topLeft: [number, number];
    bottomRight: [number, number];
  };
};

type BoundsTuple = [[number, number], [number, number]];

const MapContainerCompat = MapContainer as unknown as ComponentType<{
  bounds: BoundsTuple;
  className?: string;
  children?: ReactNode;
  scrollWheelZoom?: boolean;
  zoomControl?: boolean;
  preferCanvas?: boolean;
}>;

const GeoJSONCompat = GeoJSON as unknown as ComponentType<{
  data: GeoFeatureCollection;
  style?: () => {
    color: string;
    fillColor: string;
    fillOpacity: number;
    weight: number;
  };
  interactive?: boolean;
  key?: string;
  smoothFactor?: number;
}>;

const TileLayerCompat = TileLayer as unknown as ComponentType<{
  url: string;
  attribution?: string;
  maxZoom?: number;
  minZoom?: number;
}>;

const MarkerCompat = Marker as unknown as ComponentType<{
  position: [number, number];
  icon?: L.DivIcon;
  interactive?: boolean;
  key?: string;
}>;

function createBeaconIcon(): L.DivIcon {
  return L.divIcon({
    className: "city-beacon-wrapper",
    html: `<div class="city-beacon"><div class="city-beacon-core" style="background:#007AFF"></div></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012';

const DEFAULT_BOUNDS: BoundsTuple = [
  [-55, -140],
  [70, 140],
];
const CITY_BOUNDARY_REVEAL_ZOOM = 10;
const LAYER_VIEW_OPTIONS = [
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
] as const;

type BoundaryOverlay = {
  id: string;
  label: string;
  subtitle: string | null;
  count: number;
  featureCollection: GeoFeatureCollection;
};

type GeographyEntry = {
  label: string;
  subtitle: string | null;
  count: number;
  featureCollection: GeoFeatureCollection | null;
  placeId: string;
  lat: number;
  lng: number;
};

function getFallbackBounds(places: SavedPlace[], mode: MapMode): BoundsTuple {
  if (places.length === 0) return DEFAULT_BOUNDS;

  const lats = places.map((place) => place.lat);
  const lngs = places.map((place) => place.lng);
  const latPad = mode === "city" ? 1.8 : mode === "state" ? 5 : 14;
  const lngPad = mode === "city" ? 1.8 : mode === "state" ? 5 : 18;

  return [
    [Math.min(...lats) - latPad, Math.min(...lngs) - lngPad],
    [Math.max(...lats) + latPad, Math.max(...lngs) + lngPad],
  ];
}

function collectCoordinates(
  coordinates: Geometry["coordinates"],
  accumulator: Array<[number, number]>
) {
  if (!Array.isArray(coordinates)) return;

  if (
    coordinates.length === 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    accumulator.push([coordinates[1], coordinates[0]]);
    return;
  }

  coordinates.forEach((child) => collectCoordinates(child as Geometry["coordinates"], accumulator));
}

function getFeatureCollectionBounds(featureCollection: GeoFeatureCollection | null): BoundsTuple | null {
  if (!featureCollection || featureCollection.features.length === 0) {
    return null;
  }

  const coordinates: Array<[number, number]> = [];
  featureCollection.features.forEach((feature) => {
    collectCoordinates(feature.geometry.coordinates, coordinates);
  });

  if (coordinates.length === 0) return null;

  const lats = coordinates.map(([lat]) => lat);
  const lngs = coordinates.map(([, lng]) => lng);

  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

function MapViewportController({
  bounds,
  viewportInsets,
}: {
  bounds: BoundsTuple;
  viewportInsets?: PlacesMapProps["viewportInsets"];
}) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, {
      paddingTopLeft: viewportInsets?.topLeft ?? [28, 28],
      paddingBottomRight: viewportInsets?.bottomRight ?? [28, 28],
    });

    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [bounds, map, viewportInsets]);

  return null;
}

function MapReadyReporter({ onReady }: { onReady: () => void }) {
  const map = useMap();

  useEffect(() => {
    onReady();

    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [map, onReady]);

  return null;
}

function MapZoomReporter({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="m3.5 8.5 2.5 2.5 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6.5 w-6.5">
      <circle cx="10" cy="10" r="7" />
      <path d="M3.5 10h13" strokeLinecap="round" />
      <path d="M10 3c1.8 1.8 2.8 4.3 2.8 7S11.8 15.2 10 17" strokeLinecap="round" />
      <path d="M10 3c-1.8 1.8-2.8 4.3-2.8 7S8.2 15.2 10 17" strokeLinecap="round" />
    </svg>
  );
}

function normalizeLayerSelection(layers: Array<"country" | "state" | "city">) {
  return Array.from(new Set(layers));
}

function useBoundaryOverlays(places: SavedPlace[], mode: MapMode) {
  const modeGeographies = useMemo(() => getModeGeographies(places, mode), [places, mode]);
  const geographyEntries = useMemo(() => {
    const entries = new Map<string, GeographyEntry>();

    places.forEach((place) => {
      const normalizedPlace = getNormalizedPlace(place);
      const key = getGeographyKey(normalizedPlace, mode);

      if (!key) return;

      const current = entries.get(key);
      const storedBoundary = getStoredBoundary(place, mode);

      if (current) {
        current.count += 1;
        if (!current.featureCollection && storedBoundary) {
          current.featureCollection = storedBoundary;
        }
        return;
      }

      entries.set(key, {
        label: getExplorationLabel(place, mode),
        subtitle: getExplorationSubtitle(place, mode),
        count: 1,
        featureCollection: storedBoundary,
        placeId: place.place_id,
        lat: place.lat,
        lng: place.lng,
      });
    });

    return entries;
  }, [places, mode]);

  const missingGeographies = useMemo(() => {
    return modeGeographies.filter((geography) => {
      const key = getGeographyKey(geography, mode);
      if (!key) return false;
      return !geographyEntries.get(key)?.featureCollection;
    });
  }, [geographyEntries, mode, modeGeographies]);

  const [boundaryState, setBoundaryState] = useState<{
    requestKey: string;
    collections: Record<string, GeoFeatureCollection | null>;
  } | null>(null);

  const boundaryRequestKey = useMemo(() => {
    if (missingGeographies.length === 0) return null;

    return JSON.stringify(
      missingGeographies.map((geography) => ({
        mode,
        query: getBoundaryQuery(geography, mode),
        placeId: geographyEntries.get(getGeographyKey(geography, mode) ?? "")?.placeId ?? null,
        lat: geographyEntries.get(getGeographyKey(geography, mode) ?? "")?.lat ?? null,
        lng: geographyEntries.get(getGeographyKey(geography, mode) ?? "")?.lng ?? null,
        city: geography.city,
        state: geography.state,
        country: geography.country,
        continent: geography.continent,
      }))
    );
  }, [geographyEntries, missingGeographies, mode]);

  useEffect(() => {
    if (!boundaryRequestKey || missingGeographies.length === 0) return;

    const requestKey = boundaryRequestKey;
    const controller = new AbortController();

    async function loadBoundary() {
      try {
        const requests = missingGeographies.map(async (geography) => {
          const geographyKey = getGeographyKey(geography, mode);
          if (!geographyKey) return null;
          const entry = geographyEntries.get(geographyKey);

          const params = new URLSearchParams({ mode });
          const query = getBoundaryQuery(geography, mode);

          if (query) params.set("query", query);
          if (entry?.placeId) params.set("placeId", entry.placeId);
          if (typeof entry?.lat === "number") params.set("lat", String(entry.lat));
          if (typeof entry?.lng === "number") params.set("lng", String(entry.lng));
          if (geography.city) params.set("city", geography.city);
          if (geography.state) params.set("state", geography.state);
          if (geography.country) params.set("country", geography.country);
          if (geography.continent) params.set("continent", geography.continent);

          const res = await fetch(`/api/region-boundary?${params.toString()}`, {
            signal: controller.signal,
          });

          if (!res.ok) {
            return { geographyKey, featureCollection: null };
          }

          const out = (await res.json()) as { featureCollection?: GeoFeatureCollection };
          const featureCollection = out.featureCollection ?? null;

          setBoundaryState((current) => {
            const collections =
              current?.requestKey === requestKey ? { ...current.collections } : {};
            collections[geographyKey] = featureCollection;
            return { requestKey, collections };
          });

          return { geographyKey, featureCollection };
        });

        const settled = await Promise.all(requests);
        const collections: Record<string, GeoFeatureCollection | null> = {};

        settled.forEach((entry) => {
          if (!entry) return;
          collections[entry.geographyKey] = entry.featureCollection;
        });

        if (!controller.signal.aborted) {
          setBoundaryState({ requestKey, collections });
        }
      } catch {
        if (!controller.signal.aborted) {
          setBoundaryState(null);
        }
      }
    }

    loadBoundary();
    return () => controller.abort();
  }, [boundaryRequestKey, geographyEntries, missingGeographies, mode]);

  const fetchedBoundary =
    boundaryRequestKey && boundaryState?.requestKey === boundaryRequestKey
      ? boundaryState.collections
      : null;

  const overlays = useMemo(() => {
    const next: BoundaryOverlay[] = [];

    modeGeographies.forEach((geography) => {
      const key = getGeographyKey(geography, mode);
      if (!key) return;

      const entry = geographyEntries.get(key);
      const featureCollection = entry?.featureCollection ?? fetchedBoundary?.[key] ?? null;

      if (!entry || !featureCollection || featureCollection.features.length === 0) return;

      next.push({
        id: key,
        label: entry.label,
        subtitle: entry.subtitle,
        count: entry.count,
        featureCollection,
      });
    });

    return next;
  }, [fetchedBoundary, geographyEntries, mode, modeGeographies]);

  return overlays;
}

export default function PlacesMap({
  places,
  mode = "city",
  defaultLayerView = ["city"],
  previewPlace = null,
  heightClassName = "h-[360px]",
  containerClassName = "",
  theme = "light",
  focusStrategy = "data",
  viewportInsets,
}: PlacesMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState(2);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Array<"country" | "state" | "city">>(defaultLayerView);
  const previewSavedPlace = useMemo<SavedPlace | null>(() => {
    if (!previewPlace) return null;

    const geography = getGeographySelection({
      city: typeof previewPlace.address.city === "string" ? previewPlace.address.city : null,
      state:
        typeof previewPlace.address.state === "string"
          ? previewPlace.address.state
          : typeof previewPlace.address.region === "string"
            ? previewPlace.address.region
            : null,
      country: typeof previewPlace.address.country === "string" ? previewPlace.address.country : null,
      continent: null,
    });

    return {
      place_id: previewPlace.place_id,
      name: previewPlace.display_name,
      city: geography.city,
      state: geography.state,
      country: geography.country,
      continent: geography.continent,
      normalized_city: geography.city,
      normalized_state: geography.state,
      normalized_country: geography.country,
      normalized_continent: geography.continent,
      lat: previewPlace.lat,
      lng: previewPlace.lng,
      formatted: previewPlace.display_name,
      city_boundary: null,
      state_boundary: null,
      country_boundary: null,
      continent_boundary: null,
    };
  }, [previewPlace]);
  const previewPlaces = useMemo(() => (previewSavedPlace ? [previewSavedPlace] : []), [previewSavedPlace]);
  const fallbackBounds = useMemo(
    () => getFallbackBounds(previewSavedPlace ? previewPlaces : places, previewSavedPlace ? "city" : mode),
    [mode, places, previewPlaces, previewSavedPlace]
  );
  const countryOverlays = useBoundaryOverlays(places, "country");
  const stateOverlays = useBoundaryOverlays(places, "state");
  const cityOverlays = useBoundaryOverlays(places, "city");
  const previewCityOverlays = useBoundaryOverlays(previewPlaces, "city");
  const cityEntities = useMemo(() => getMapEntities(places, "city"), [places]);
  const cityBoundaryIds = useMemo(() => new Set(cityOverlays.map((overlay) => overlay.id)), [cityOverlays]);
  const showCountryLayer = activeLayers.includes("country");
  const showStateLayer = activeLayers.includes("state");
  const showCityLayer = activeLayers.includes("city");
  const visibleCityMarkers = useMemo(() => {
    if (!showCityLayer) return [];

    return cityEntities.filter(
      (entity) => !(zoom >= CITY_BOUNDARY_REVEAL_ZOOM && cityBoundaryIds.has(entity.id))
    );
  }, [cityBoundaryIds, cityEntities, showCityLayer, zoom]);

  const boundary = useMemo(() => {
    if (previewPlace) {
      const previewFeatures = previewCityOverlays.flatMap((overlay) => overlay.featureCollection.features);
      if (previewFeatures.length > 0) {
        return { type: "FeatureCollection", features: previewFeatures } satisfies GeoFeatureCollection;
      }
      return null;
    }

    const activeOverlays = [
      ...(showCountryLayer ? countryOverlays : []),
      ...(showStateLayer ? stateOverlays : []),
      ...(showCityLayer ? cityOverlays : []),
    ];
    const primaryOverlays =
      activeOverlays.length > 0
        ? activeOverlays
        : countryOverlays.length > 0
          ? countryOverlays
          : stateOverlays.length > 0
            ? stateOverlays
            : cityOverlays;
    const features = primaryOverlays.flatMap((overlay) => overlay.featureCollection.features);
    return features.length > 0
      ? ({ type: "FeatureCollection", features } satisfies GeoFeatureCollection)
      : null;
  }, [
    cityOverlays,
    countryOverlays,
    previewCityOverlays,
    previewPlace,
    showCityLayer,
    showCountryLayer,
    showStateLayer,
    stateOverlays,
  ]);

  const dataBounds = useMemo(
    () => getFeatureCollectionBounds(boundary) ?? fallbackBounds,
    [boundary, fallbackBounds]
  );
  const bounds = useMemo(
    () => (previewPlace ? dataBounds : focusStrategy === "world" ? DEFAULT_BOUNDS : dataBounds),
    [dataBounds, focusStrategy, previewPlace]
  );

  void mapReady;

  return (
    <div className={`relative ${heightClassName}`}>
      <div className="pointer-events-none absolute right-3 top-3 z-[500]">
        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => setLayerMenuOpen((current) => !current)}
            aria-label="Open map layer controls"
            className="inline-flex items-center justify-center rounded-full border border-white/75 bg-white/92 p-3 text-[#111214] shadow-[0_10px_24px_rgba(17,18,20,0.12)] backdrop-blur-xl"
          >
            <GlobeIcon />
          </button>

          {layerMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[150px] overflow-hidden rounded-[18px] border border-white/80 bg-white/96 p-1.5 shadow-[0_18px_40px_rgba(17,18,20,0.16)] backdrop-blur-xl">
              {LAYER_VIEW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setActiveLayers((current) => {
                      const next = current.includes(option.key)
                        ? current.filter((layer) => layer !== option.key)
                        : [...current, option.key];
                      return normalizeLayerSelection(next);
                    });
                  }}
                  className="flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-sm text-[#4d5560] transition hover:bg-[#f5f7f8] hover:text-[#111214]"
                >
                  <span>{option.label}</span>
                  <span className={activeLayers.includes(option.key) ? "text-[#111214] opacity-100" : "opacity-0"}>
                    <CheckIcon />
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <MapContainerCompat
        bounds={bounds}
        className={`${heightClassName} relative z-[1] w-full ${containerClassName}`}
        scrollWheelZoom
        zoomControl={false}
      >
        <MapViewportController bounds={bounds} viewportInsets={viewportInsets} />
        <MapReadyReporter onReady={() => setMapReady(true)} />
        <MapZoomReporter onZoomChange={setZoom} />

        <TileLayerCompat
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          maxZoom={18}
          minZoom={2}
        />

        {!previewPlace && showCountryLayer
          ? countryOverlays.map((overlay) => (
              <GeoJSONCompat
                key={`country-${overlay.id}`}
                data={overlay.featureCollection}
                interactive={false}
                smoothFactor={0}
                style={() => ({
                  color: theme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.4)",
                  fillColor: theme === "dark" ? "#2563eb" : "#3b82f6",
                  fillOpacity: showStateLayer || showCityLayer ? 0.3 : 0.42,
                  weight: 0.8,
                })}
              />
            ))
          : null}

        {!previewPlace && showStateLayer
          ? stateOverlays.map((overlay) => (
              <GeoJSONCompat
                key={`state-${overlay.id}`}
                data={overlay.featureCollection}
                interactive={false}
                smoothFactor={0}
                style={() => ({
                  color: theme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.4)",
                  fillColor: theme === "dark" ? "#06b6d4" : "#14b8a6",
                  fillOpacity: showCountryLayer || showCityLayer ? 0.35 : 0.48,
                  weight: 0.8,
                })}
              />
            ))
          : null}

        {!previewPlace ? visibleCityMarkers.map((city) => (
          <MarkerCompat
            key={`city-marker-${city.id}`}
            position={[city.lat, city.lng]}
            icon={createBeaconIcon()}
            interactive={false}
          />
        )) : null}

        {!previewPlace && showCityLayer && zoom >= CITY_BOUNDARY_REVEAL_ZOOM
          ? cityOverlays.map((overlay) => (
              <GeoJSONCompat
                key={`city-${overlay.id}`}
                data={overlay.featureCollection}
                interactive={false}
                smoothFactor={0}
                style={() => ({
                  color: theme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.4)",
                  fillColor: theme === "dark" ? "#10b981" : "#14b8a6",
                  fillOpacity: 0.5,
                  weight: 0.8,
                })}
              />
            ))
          : null}

        {previewPlace && previewCityOverlays.length > 0
          ? previewCityOverlays.map((overlay) => (
              <GeoJSONCompat
                key={`preview-city-${overlay.id}`}
                data={overlay.featureCollection}
                interactive={false}
                smoothFactor={0}
                style={() => ({
                  color: "rgba(0,0,0,0.4)",
                  fillColor: "#f59e0b",
                  fillOpacity: 0.5,
                  weight: 0.8,
                })}
              />
            ))
          : null}

      </MapContainerCompat>
    </div>
  );
}
