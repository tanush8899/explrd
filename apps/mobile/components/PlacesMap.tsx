import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Geojson, Marker, type Camera, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCircleButton, Icon } from "@/components/Glass";
import { hapticLight } from "@/lib/haptics";
import type { SavedPlace } from "@explrd/shared";

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
// friend-only orange, overlaps purple.
const COUNTRY_FILL: Record<CountryOwner, string> = {
  mine:   "rgba(0,122,255,0.32)",
  friend: "rgba(255,149,0,0.34)",
  both:   "rgba(139,92,246,0.38)",
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

// ── Main component ────────────────────────────────────────────────────────────

export default function PlacesMap({ places, previewCoord, friendOverlay, bottomInset = 0 }: Props) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<MapMode>("globe");
  const [view, setView] = useState<HighlightMode>("city");

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

  // Country highlighting — group saved places by country, tagging each as mine /
  // friend / both, and pick a representative place that carries a boundary.
  const countryGroups = useMemo(() => {
    if (!isCountry) return [];
    const mine = new Map<string, SavedPlace>();
    const friend = new Map<string, SavedPlace>();
    const collect = (list: SavedPlace[], into: Map<string, SavedPlace>) => {
      for (const p of list) {
        const k = countryKey(p);
        if (!k) continue;
        const cur = into.get(k);
        // Prefer whichever record actually carries a country_boundary polygon.
        if (!cur || (!cur.country_boundary && p.country_boundary)) into.set(k, p);
      }
    };
    if (overlay?.filter !== "friend") collect(places, mine);
    if (overlay) collect(overlay.places, friend);

    const out: { key: string; owner: CountryOwner; boundary: NonNullable<SavedPlace["country_boundary"]> }[] = [];
    for (const k of new Set([...mine.keys(), ...friend.keys()])) {
      const inMine = mine.has(k);
      const inFriend = friend.has(k);
      const rep = (mine.get(k) ?? friend.get(k))!;
      if (!rep.country_boundary) continue; // can't outline without a polygon
      out.push({
        key: k,
        owner: inMine && inFriend ? "both" : inFriend ? "friend" : "mine",
        boundary: rep.country_boundary,
      });
    }
    return out;
  }, [isCountry, places, overlay]);

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

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={isGlobe ? "hybridFlyover" : "standard"}
        initialCamera={GLOBE_CAMERA}
        showsUserLocation={false}
        showsMyLocationButton={false}
        mapPadding={{ top: 0, right: 0, bottom: bottomInset, left: LOGO_LEFT_INSET }}
      >
        {isCountry &&
          countryGroups.map((g) => (
            <Geojson
              key={`country:${g.key}`}
              geojson={g.boundary as React.ComponentProps<typeof Geojson>["geojson"]}
              fillColor={COUNTRY_FILL[g.owner]}
              strokeColor={COUNTRY_STROKE[g.owner]}
              strokeWidth={1.5}
            />
          ))}

        {!isCountry &&
          myMarkers.map((place) => (
            <Marker
              key={`mine:${place.place_id}`}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name ?? place.city ?? place.formatted ?? undefined}
              description={[place.city, place.country].filter(Boolean).join(", ") || undefined}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.markerOuter}>
                <View style={styles.markerInner} />
              </View>
            </Marker>
          ))}

        {!isCountry &&
          friendMarkers.map((place) => {
            const isShared = overlay?.filter === "both" && sharedKeys.has(overlayKey(place));
            return (
              <Marker
                key={`friend:${place.place_id}`}
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
          })}

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
});
