import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, type Camera, type LatLng, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCircleButton, Icon } from "@/components/Glass";
import { hapticLight } from "@/lib/haptics";
import type { GeoFeatureCollection, SavedPlace } from "@explrd/shared";

export type PreviewCoord = { lat: number; lng: number; place_id: string; addresstype?: string | null };

export type FriendOverlay = {
  places: SavedPlace[];
  /** "both" = your + friend's places, "friend" = only the friend's globe */
  filter: "both" | "friend";
  name: string;
};

type Props = {
  places: SavedPlace[];
  previewCoord?: PreviewCoord | null;
  friendOverlay?: FriendOverlay | null;
  /** Tapping one of the user's own city pins opens its notes / delete sheet. */
  onSelectCity?: (place: SavedPlace) => void;
  /** Pixels the bottom sheet currently occupies — keeps the Apple logo / legal
   *  attribution clear of the sheet by pushing the map's layout margins up. */
  bottomInset?: number;
};

// Keep the bottom-left Apple logo near the screen's left edge.
const LOGO_LEFT_INSET = 14;

// Same city+country in both lists counts as a shared place
function overlayKey(p: SavedPlace): string {
  const city = (p.normalized_city ?? p.city ?? p.name ?? "").toLowerCase().trim();
  const country = (p.normalized_country ?? p.country ?? "").toLowerCase().trim();
  return `${city}|${country}`;
}

function countryKey(p: SavedPlace): string {
  return (p.normalized_country ?? p.country ?? "").toLowerCase().trim();
}

type MapMode = "globe" | "standard";
// "city" = individual pins, "country" = highlighted country outlines.
type HighlightMode = "city" | "country";
type CountryOwner = "mine" | "friend" | "both";

// Highlight colours mirror the city pin dots for consistency: you blue,
// friend-only orange, overlaps purple. A tapped country "glows" stronger.
const COUNTRY_FILL: Record<CountryOwner, string> = {
  mine:   "rgba(0,122,255,0.30)",
  friend: "rgba(255,149,0,0.32)",
  both:   "rgba(139,92,246,0.36)",
};
const COUNTRY_GLOW: Record<CountryOwner, string> = {
  mine:   "rgba(0,122,255,0.52)",
  friend: "rgba(255,149,0,0.54)",
  both:   "rgba(139,92,246,0.58)",
};
const COUNTRY_STROKE: Record<CountryOwner, string> = {
  mine:   "#007aff",
  friend: "#ff9500",
  both:   "#8b5cf6",
};

const GLOBE_CAMERA: Camera = {
  center: { latitude: 25, longitude: 10 },
  altitude: 25_000_000,
  pitch: 0,
  heading: 0,
};

const WORLD_REGION: Region = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 90,
  longitudeDelta: 90,
};

const FIT_PADDING = { top: 80, right: 48, bottom: 360, left: 48 };

// Zoom thresholds (latitude degrees of the visible span). Below CITY_FOCUS_DELTA
// we're "inside" a country → swap its highlight for its city pins. A tap that
// centres a country is clamped to stay above this, so tapping reveals the name
// without flipping to the city view — you pinch in further for that.
const CITY_FOCUS_DELTA = 4.5;
const CITY_LABEL_DELTA = 3.2;
const TAP_MIN_DELTA = 6;

// ── GeoJSON → react-native-maps polygons ───────────────────────────────────────
// Rendering explicit <Polygon>s (instead of <Geojson>) reliably draws complex
// MultiPolygon countries — France's overseas territories, China's islands, etc.

type Ring = LatLng[];
type Poly = { coordinates: Ring; holes: Ring[] };

function ringToCoords(ring: number[][]): Ring {
  return ring.map((c) => ({ latitude: c[1], longitude: c[0] }));
}

function boundaryToPolygons(fc: GeoFeatureCollection): Poly[] {
  const out: Poly[] = [];
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      const [outer, ...holes] = g.coordinates as number[][][];
      if (outer) out.push({ coordinates: ringToCoords(outer), holes: holes.map(ringToCoords) });
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as number[][][][]) {
        const [outer, ...holes] = poly;
        if (outer) out.push({ coordinates: ringToCoords(outer), holes: holes.map(ringToCoords) });
      }
    }
  }
  return out;
}

function bboxCenterOf(coords: Ring): { center: { lat: number; lng: number }; latSpan: number; lngSpan: number } {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
  }
  return {
    center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
    latSpan: maxLat - minLat,
    lngSpan: maxLng - minLng,
  };
}

/** True when a coordinate falls within the currently visible region. */
function inView(lat: number, lng: number, region: Region): boolean {
  return (
    Math.abs(lat - region.latitude) <= region.latitudeDelta / 2 &&
    Math.abs(lng - region.longitude) <= region.longitudeDelta / 2
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlacesMap({ places, previewCoord, friendOverlay, onSelectCity, bottomInset = 0 }: Props) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<MapMode>("globe");
  const [view, setView] = useState<HighlightMode>("city");
  const [region, setRegion] = useState<Region | null>(null);
  // The country whose name + stronger glow are shown (set by tapping it).
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const isGlobe = mode === "globe";
  const isCountry = view === "country";

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const previewActiveRef = useRef(false);

  // Split places into mine / friend-only / shared when a friend's globe is active
  const overlay = friendOverlay ?? null;
  const sharedKeys = new Set(
    overlay ? places.filter((p) => overlay.places.some((f) => overlayKey(f) === overlayKey(p))).map(overlayKey) : [],
  );
  const myMarkers = overlay?.filter === "friend"
    ? []
    : overlay
      ? places.filter((p) => !sharedKeys.has(overlayKey(p)))
      : places;
  const friendMarkers = overlay ? overlay.places : [];

  // Everything currently visible — drives the fit-to-coordinates behaviour
  const visiblePlaces = [...myMarkers, ...friendMarkers];

  // Country highlighting — group saved places by country (tagging mine / friend /
  // both), precomputing the renderable polygons + the main-landmass centre used
  // for the name label and tap-to-centre. The same grouping covers a friend's
  // globe, so the friend view gets identical highlight behaviour in its colours.
  const countryGroups = useMemo(() => {
    if (!isCountry) return [];
    type Acc = {
      key: string;
      name: string;
      boundary: GeoFeatureCollection | null;
      coords: { lat: number; lng: number }[];
      mine: boolean;
      friend: boolean;
    };
    const groups = new Map<string, Acc>();
    const collect = (list: SavedPlace[], who: "mine" | "friend") => {
      for (const p of list) {
        const k = countryKey(p);
        if (!k) continue;
        let g = groups.get(k);
        if (!g) {
          g = { key: k, name: p.country ?? p.normalized_country ?? k, boundary: null, coords: [], mine: false, friend: false };
          groups.set(k, g);
        }
        g[who] = true;
        g.coords.push({ lat: p.lat, lng: p.lng });
        if (!g.boundary && p.country_boundary) g.boundary = p.country_boundary;
      }
    };
    if (overlay?.filter !== "friend") collect(places, "mine");
    if (overlay) collect(overlay.places, "friend");

    const out = [];
    for (const g of groups.values()) {
      if (!g.boundary) continue; // can't outline without a polygon
      const polygons = boundaryToPolygons(g.boundary);
      if (polygons.length === 0) continue;
      // Centre the label / tap on the largest landmass (most vertices), so
      // overseas territories don't drag the centre into the ocean.
      const main = polygons.reduce((a, b) => (b.coordinates.length > a.coordinates.length ? b : a));
      const { center, latSpan, lngSpan } = bboxCenterOf(main.coordinates);
      const owner: CountryOwner = g.mine && g.friend ? "both" : g.friend ? "friend" : "mine";
      out.push({ key: g.key, name: g.name, owner, polygons, coords: g.coords, center, latSpan, lngSpan });
    }
    return out;
  }, [isCountry, places, overlay]);

  // While in country view, detect which country we've zoomed into (most of its
  // cities in the viewport) — its highlight is swapped for its city pins.
  const focusedKey = useMemo(() => {
    if (!isCountry || !region || region.latitudeDelta > CITY_FOCUS_DELTA) return null;
    let best: string | null = null;
    let bestCount = 0;
    for (const g of countryGroups) {
      const count = g.coords.filter((c) => inView(c.lat, c.lng, region)).length;
      if (count > bestCount) {
        bestCount = count;
        best = g.key;
      }
    }
    return bestCount > 0 ? best : null;
  }, [isCountry, region, countryGroups]);

  // Pins are close enough to wear their city name once the viewport is tight.
  const showCityLabels = !!region && region.latitudeDelta <= CITY_LABEL_DELTA;

  // Tap a country → reveal its name, glow it, and centre it (clamped so it
  // doesn't zoom in far enough to flip into the city view).
  const handleSelectCountry = useCallback(
    (g: (typeof countryGroups)[number]) => {
      hapticLight();
      setSelectedKey(g.key);
      mapRef.current?.animateToRegion(
        {
          latitude: g.center.lat,
          longitude: g.center.lng,
          latitudeDelta: Math.max(g.latSpan * 1.35, TAP_MIN_DELTA),
          longitudeDelta: Math.max(g.lngSpan * 1.35, TAP_MIN_DELTA),
        },
        600,
      );
    },
    [],
  );

  // Drop the selection when leaving country view.
  useEffect(() => {
    if (!isCountry) setSelectedKey(null);
  }, [isCountry]);

  // Fit to places when switching to flat — skip when a preview is active
  useEffect(() => {
    if (isGlobe || visiblePlaces.length === 0 || previewActiveRef.current) return;
    const coords = visiblePlaces.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    const id = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, { edgePadding: FIT_PADDING, animated: true });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, overlay?.places, overlay?.filter, isGlobe]);

  useEffect(() => {
    if (!previewCoord) {
      previewActiveRef.current = false;
      return;
    }
    previewActiveRef.current = true;

    const id = setTimeout(() => {
      if (modeRef.current === "globe") {
        mapRef.current?.animateCamera(
          {
            center: { latitude: previewCoord.lat, longitude: previewCoord.lng },
            altitude: 500_000,
            pitch: 0,
            heading: 0,
          },
          { duration: 700 },
        );
      } else {
        // Offset center south so the pin appears above the bottom sheet
        mapRef.current?.animateToRegion(
          {
            latitude: previewCoord.lat - 0.20,
            longitude: previewCoord.lng,
            latitudeDelta: 0.9,
            longitudeDelta: 0.9,
          },
          700,
        );
      }
    }, 80);
    return () => clearTimeout(id);
  }, [previewCoord]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(() => {
    hapticLight();
    const next: MapMode = isGlobe ? "standard" : "globe";
    setMode(next);

    if (next === "globe") {
      setTimeout(() => mapRef.current?.animateCamera(GLOBE_CAMERA, { duration: 900 }), 80);
    } else {
      setTimeout(() => {
        if (visiblePlaces.length > 0) {
          const coords = visiblePlaces.map((p) => ({ latitude: p.lat, longitude: p.lng }));
          mapRef.current?.fitToCoordinates(coords, { edgePadding: FIT_PADDING, animated: true });
        } else {
          mapRef.current?.animateToRegion(WORLD_REGION, 700);
        }
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobe, places, overlay]);

  // Renders one of the user's own city pins — tappable across the whole stack
  // (puck + label), and labelled with its city name once zoomed in close.
  const renderMyMarker = (place: SavedPlace) => (
    <Marker
      key={`mine:${place.place_id}:${showCityLabels ? "l" : ""}`}
      coordinate={{ latitude: place.lat, longitude: place.lng }}
      anchor={{ x: 0.5, y: showCityLabels ? 1 : 0.5 }}
      tracksViewChanges={false}
      onPress={onSelectCity ? () => onSelectCity(place) : undefined}
    >
      <View style={styles.pinStack}>
        {showCityLabels && (
          <View style={styles.cityLabel}>
            <Text style={styles.cityLabelText} numberOfLines={1}>
              {place.name ?? place.city ?? place.formatted ?? ""}
            </Text>
          </View>
        )}
        <View style={styles.markerOuter}>
          <View style={styles.markerInner} />
        </View>
      </View>
    </Marker>
  );

  const renderFriendMarker = (place: SavedPlace) => {
    const isShared = overlay?.filter === "both" && sharedKeys.has(overlayKey(place));
    return (
      <Marker
        key={`friend:${place.place_id}:${showCityLabels ? "l" : ""}`}
        coordinate={{ latitude: place.lat, longitude: place.lng }}
        title={place.name ?? place.city ?? place.formatted ?? undefined}
        description={
          isShared
            ? `You and ${overlay?.name ?? "your friend"} have both been here!`
            : [place.city, place.country].filter(Boolean).join(", ") || undefined
        }
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
      >
        <View style={[styles.markerOuter, isShared && styles.markerOuterShared]}>
          <View style={isShared ? styles.markerInnerShared : styles.markerInnerFriend} />
        </View>
      </Marker>
    );
  };

  const selectedGroup = isCountry ? countryGroups.find((g) => g.key === selectedKey) ?? null : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={isGlobe ? "hybridFlyover" : "standard"}
        initialCamera={GLOBE_CAMERA}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onRegionChangeComplete={setRegion}
        onPress={() => setSelectedKey(null)}
        mapPadding={{ top: 0, right: 0, bottom: bottomInset, left: LOGO_LEFT_INSET }}
      >
        {/* Country highlight view — explicit polygons per country (all sub-polygons
            of MultiPolygons), except the country we've zoomed into. The tapped
            country glows stronger. */}
        {isCountry &&
          countryGroups
            .filter((g) => g.key !== focusedKey)
            .map((g) => {
              const selected = g.key === selectedKey;
              return g.polygons.map((poly, i) => (
                <Polygon
                  key={`country:${g.key}:${i}`}
                  coordinates={poly.coordinates}
                  holes={poly.holes.length ? poly.holes : undefined}
                  fillColor={selected ? COUNTRY_GLOW[g.owner] : COUNTRY_FILL[g.owner]}
                  strokeColor={COUNTRY_STROKE[g.owner]}
                  strokeWidth={selected ? 2.6 : 1.4}
                  tappable
                  onPress={() => handleSelectCountry(g)}
                />
              ));
            })}

        {/* Selected country's name — centred on the country, no background. */}
        {selectedGroup && selectedGroup.key !== focusedKey && (
          <Marker
            coordinate={{ latitude: selectedGroup.center.lat, longitude: selectedGroup.center.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            pointerEvents="none"
          >
            <Text style={styles.countryName}>{selectedGroup.name}</Text>
          </Marker>
        )}

        {/* Inside the focused country: show its visited city pins. */}
        {isCountry &&
          focusedKey &&
          myMarkers.filter((p) => countryKey(p) === focusedKey).map(renderMyMarker)}
        {isCountry &&
          focusedKey &&
          friendMarkers.filter((p) => countryKey(p) === focusedKey).map(renderFriendMarker)}

        {/* City pin view — all pins. */}
        {!isCountry && myMarkers.map(renderMyMarker)}
        {!isCountry && friendMarkers.map(renderFriendMarker)}
      </MapView>

      {/* Floating dark-glass map controls — Flighty's stacked globe controls */}
      <GlassCircleButton
        onPress={handleToggle}
        scheme="dark"
        accessibilityLabel={isGlobe ? "Switch to standard map" : "Switch to globe"}
        style={{ position: "absolute", top: insets.top + 12, right: 16 }}
      >
        <Icon
          name={isGlobe ? "map.fill" : "globe.americas.fill"}
          fallback={isGlobe ? "🗺" : "🌐"}
          size={20}
          color="#ffffff"
        />
      </GlassCircleButton>

      {/* City ↔ country highlighting */}
      <GlassCircleButton
        onPress={() => {
          hapticLight();
          setView((v) => (v === "city" ? "country" : "city"));
        }}
        scheme="dark"
        accessibilityLabel={isCountry ? "Show cities" : "Highlight countries"}
        style={{ position: "absolute", top: insets.top + 12 + 44 + 10, right: 16 }}
      >
        <Icon
          name={isCountry ? "mappin.and.ellipse" : "globe"}
          fallback={isCountry ? "📍" : "🌐"}
          size={20}
          color="#ffffff"
        />
      </GlassCircleButton>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pinStack: { alignItems: "center" },
  markerOuter: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35, shadowRadius: 3, elevation: 4,
  },
  markerInner: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: "#007aff",
  },
  markerInnerFriend: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: "#ff9500",
  },
  markerInnerShared: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: "#8b5cf6",
  },
  // Shared pins get a slightly larger halo so they pop on the globe
  markerOuterShared: {
    width: 19, height: 19, borderRadius: 9.5,
    shadowColor: "#8b5cf6",
    shadowOpacity: 0.6,
  },
  // City name pill that floats above a pin once zoomed in
  cityLabel: {
    backgroundColor: "rgba(11,12,14,0.82)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
    maxWidth: 160,
  },
  cityLabelText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  // Selected country name — plain text over the country, no background pill.
  countryName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
