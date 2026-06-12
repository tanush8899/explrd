import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import type { SavedPlace } from "@explrd/shared";

export type PlacesMapHandle = {
  /** Fly the camera to a specific coordinate (used when previewing a search result). */
  focusOn: (lat: number, lng: number) => void;
  /** Zoom back out to fit every saved place. */
  fitAll: () => void;
};

type Props = {
  places: SavedPlace[];
  /** Temporary marker for a search result that hasn't been saved yet. */
  preview?: { lat: number; lng: number; label: string } | null;
};

const WORLD_REGION: Region = {
  latitude: 25,
  longitude: -30,
  latitudeDelta: 110,
  longitudeDelta: 110,
};

// Bottom sheet rests around 45% — keep pins clear of the sheet and status bar.
const FIT_PADDING = { top: 110, right: 56, bottom: 420, left: 56 };

const PlacesMap = forwardRef<PlacesMapHandle, Props>(function PlacesMap(
  { places, preview },
  ref
) {
  const mapRef = useRef<MapView>(null);

  const fitAll = () => {
    if (places.length === 0) return;
    const coords = places.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: FIT_PADDING,
      animated: true,
    });
  };

  useImperativeHandle(ref, () => ({
    focusOn: (lat, lng) => {
      mapRef.current?.animateCamera(
        {
          center: { latitude: lat, longitude: lng },
          altitude: 250_000,
          zoom: 11,
        },
        { duration: 900 }
      );
    },
    fitAll,
  }));

  useEffect(() => {
    if (places.length === 0) return;
    // Brief delay so MapView is mounted and layout is complete before animating.
    const id = setTimeout(fitAll, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={WORLD_REGION}
      // Satellite globe with labels — the Flighty look. Flyover gives the 3D
      // globe on iOS; Android falls back to standard hybrid imagery.
      mapType={Platform.OS === "ios" ? "hybridFlyover" : "hybrid"}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      pitchEnabled
    >
      {places.map((place) => (
        <Marker
          key={place.place_id}
          coordinate={{ latitude: place.lat, longitude: place.lng }}
          title={place.name ?? place.city ?? place.formatted ?? undefined}
          description={
            [place.city, place.country].filter(Boolean).join(", ") || undefined
          }
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.dotOuter}>
            <View style={styles.dotInner} />
          </View>
        </Marker>
      ))}

      {preview && (
        <Marker
          coordinate={{ latitude: preview.lat, longitude: preview.lng }}
          title={preview.label}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.previewOuter}>
            <View style={styles.previewInner} />
          </View>
        </Marker>
      )}
    </MapView>
  );
});

export default PlacesMap;

const styles = StyleSheet.create({
  // Saved places — small white dots like Flighty's airport markers
  dotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  // Search preview — Flighty blue pulse dot
  previewOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(10,132,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewInner: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#0a84ff",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
});
