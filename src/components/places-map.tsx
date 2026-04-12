"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import {
  getBoundaryQuery,
  getExplorationLabel,
  getExplorationSubtitle,
  getGeographyKey,
  getModeGeographies,
  getNormalizedPlace,
  getStoredBoundary,
} from "@/lib/exploration";
import type { GeoFeatureCollection, Geometry, MapMode, SavedPlace } from "@/lib/types";

type PlacesMapProps = {
  places: SavedPlace[];
  mode?: MapMode;
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
}>;

const TileLayerCompat = TileLayer as unknown as ComponentType<{
  url: string;
  attribution?: string;
  maxZoom?: number;
  minZoom?: number;
}>;

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const DEFAULT_BOUNDS: BoundsTuple = [
  [-55, -140],
  [70, 140],
];

type BoundaryOverlay = {
  id: string;
  label: string;
  subtitle: string | null;
  count: number;
  featureCollection: GeoFeatureCollection;
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

export default function PlacesMap({
  places,
  mode = "city",
  heightClassName = "h-[360px]",
  containerClassName = "",
  theme = "light",
  focusStrategy = "data",
  viewportInsets,
}: PlacesMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const fallbackBounds = getFallbackBounds(places, mode);
  const renderMode: MapMode = mode;
  const modeGeographies = useMemo(() => getModeGeographies(places, renderMode), [places, renderMode]);
  const geographyEntries = useMemo(() => {
    const entries = new Map<
      string,
      {
        label: string;
        subtitle: string | null;
        count: number;
        featureCollection: GeoFeatureCollection | null;
        placeId: string;
        lat: number;
        lng: number;
      }
    >();

    places.forEach((place) => {
      const normalizedPlace = getNormalizedPlace(place);
      const key = getGeographyKey(normalizedPlace, renderMode);

      if (!key) return;

      const current = entries.get(key);
      const storedBoundary = getStoredBoundary(place, renderMode);

      if (current) {
        current.count += 1;
        if (!current.featureCollection && storedBoundary) {
          current.featureCollection = storedBoundary;
        }
        return;
      }

      entries.set(key, {
        label: getExplorationLabel(place, renderMode),
        subtitle: getExplorationSubtitle(place, renderMode),
        count: 1,
        featureCollection: storedBoundary,
        placeId: place.place_id,
        lat: place.lat,
        lng: place.lng,
      });
    });

    return entries;
  }, [places, renderMode]);

  const missingGeographies = useMemo(() => {
    return modeGeographies.filter((geography) => {
      const key = getGeographyKey(geography, renderMode);
      if (!key) return false;
      return !geographyEntries.get(key)?.featureCollection;
    });
  }, [geographyEntries, modeGeographies, renderMode]);

  const [boundaryState, setBoundaryState] = useState<{
    requestKey: string;
    collections: Record<string, GeoFeatureCollection | null>;
  } | null>(null);

  const boundaryRequestKey = useMemo(() => {
    if (missingGeographies.length === 0) return null;

    return JSON.stringify(
      missingGeographies.map((geography) => ({
        mode: renderMode,
        query: getBoundaryQuery(geography, renderMode),
        placeId: geographyEntries.get(getGeographyKey(geography, renderMode) ?? "")?.placeId ?? null,
        lat: geographyEntries.get(getGeographyKey(geography, renderMode) ?? "")?.lat ?? null,
        lng: geographyEntries.get(getGeographyKey(geography, renderMode) ?? "")?.lng ?? null,
        city: geography.city,
        state: geography.state,
        country: geography.country,
        continent: geography.continent,
      }))
    );
  }, [geographyEntries, missingGeographies, renderMode]);

  useEffect(() => {
    if (!boundaryRequestKey || missingGeographies.length === 0) return;

    const requestKey = boundaryRequestKey;
    const controller = new AbortController();

    async function loadBoundary() {
      try {
        const requests = missingGeographies.map(async (geography) => {
          const geographyKey = getGeographyKey(geography, renderMode);
          if (!geographyKey) return null;
          const entry = geographyEntries.get(geographyKey);

          const params = new URLSearchParams({ mode: renderMode });
          const query = getBoundaryQuery(geography, renderMode);

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
  }, [boundaryRequestKey, geographyEntries, missingGeographies, renderMode]);

  const fetchedBoundary =
    boundaryRequestKey && boundaryState?.requestKey === boundaryRequestKey
      ? boundaryState.collections
      : null;

  const overlays = useMemo(() => {
    const next: BoundaryOverlay[] = [];

    modeGeographies.forEach((geography) => {
      const key = getGeographyKey(geography, renderMode);
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
  }, [fetchedBoundary, geographyEntries, modeGeographies, renderMode]);

  const boundary = useMemo(() => {
    const features = overlays.flatMap((overlay) => overlay.featureCollection.features);
    return features.length > 0
      ? ({ type: "FeatureCollection", features } satisfies GeoFeatureCollection)
      : null;
  }, [overlays]);

  const dataBounds = getFeatureCollectionBounds(boundary) ?? fallbackBounds;
  const bounds = focusStrategy === "world" ? DEFAULT_BOUNDS : dataBounds;

  void mapReady;

  return (
    <div className={`relative ${heightClassName}`}>
      <MapContainerCompat
        bounds={bounds}
        className={`${heightClassName} relative z-[1] w-full ${containerClassName}`}
        scrollWheelZoom
        zoomControl={false}
      >
        <MapViewportController bounds={bounds} viewportInsets={viewportInsets} />
        <MapReadyReporter onReady={() => setMapReady(true)} />

        <TileLayerCompat
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          maxZoom={18}
          minZoom={2}
        />

        {overlays.map((overlay) => (
          <GeoJSONCompat
            key={overlay.id}
            data={overlay.featureCollection}
            interactive={false}
            style={() => ({
              color: theme === "dark" ? "#60a5fa" : "#2563eb",
              fillColor: theme === "dark" ? "#3b82f6" : "#3b82f6",
              fillOpacity:
                mode === "continent" ? 0.18 : mode === "country" ? 0.22 : 0.28,
              weight: 2,
            })}
          />
        ))}
      </MapContainerCompat>
    </div>
  );
}
