import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import type { SavedPlace } from "@explrd/shared";

type Props = {
  places: SavedPlace[];
};

const WORLD_REGION: Region = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 120,
  longitudeDelta: 120,
};

// Bottom sheet at 30% snap leaves ~70% of screen for the map.
// Padding keeps pins clear of the sheet handle, status bar, and sign-out pill.
const FIT_PADDING = { top: 80, right: 48, bottom: 360, left: 48 };

export default function PlacesMap({ places }: Props) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (places.length === 0) return;
    const coords = places.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    // Brief delay so MapView is mounted and layout is complete before animating.
    const id = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: FIT_PADDING,
        animated: true,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [places]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={WORLD_REGION}
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {places.map((place) => (
        <Marker
          key={place.place_id}
          coordinate={{ latitude: place.lat, longitude: place.lng }}
          title={place.name ?? place.city ?? place.formatted ?? undefined}
          description={
            [place.city, place.country].filter(Boolean).join(", ") || undefined
          }
          pinColor="#111214"
        />
      ))}
    </MapView>
  );
}
