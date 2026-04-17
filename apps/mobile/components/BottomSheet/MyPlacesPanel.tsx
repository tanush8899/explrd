import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { getExplrdStats, getPlaceHierarchy } from "@explrd/shared";
import type { SavedPlace } from "@explrd/shared";

type Props = {
  places: SavedPlace[];
  onDelete: (placeId: string) => void;
  deletingId: string | null;
};

type ExpandedState = Record<string, boolean>;

export default function MyPlacesPanel({ places, onDelete, deletingId }: Props) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const stats = useMemo(() => getExplrdStats(places), [places]);
  const hierarchy = useMemo(() => getPlaceHierarchy(places), [places]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const confirmDelete = (place: SavedPlace) => {
    const label = place.name ?? place.city ?? place.formatted ?? place.place_id;
    Alert.alert(
      "Remove Place",
      `Remove "${label}" from your passport?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onDelete(place.place_id),
        },
      ]
    );
  };

  if (places.length === 0) {
    return (
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>My Places</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No places yet</Text>
          <Text style={styles.emptyDesc}>
            Switch to the Add tab to save your first city.
          </Text>
        </View>
      </BottomSheetScrollView>
    );
  }

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Places</Text>

      {/* Stats pills */}
      <View style={styles.statsRow}>
        <StatPill label="Cities" value={stats.uniqueCities} />
        <StatPill label="Countries" value={stats.uniqueCountries} />
        <StatPill label="Continents" value={stats.uniqueContinents} />
      </View>

      {/* World explored progress */}
      <View style={styles.worldBox}>
        <View style={styles.worldBoxHeader}>
          <Text style={styles.worldLabel}>World Explored</Text>
          <Text style={styles.worldPct}>
            {Math.round(stats.percentWorldTraveled)}%
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={["#f7cf62", "#f2a8ff", "#76d5ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  Math.round(stats.percentWorldTraveled),
                  100
                )}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.worldScore}>
          Explorer Score: {stats.score.toLocaleString()}
        </Text>
      </View>

      {/* Continent → Country → State → City hierarchy */}
      {hierarchy.map((continent) => {
        const continentKey = `c:${continent.continent}`;
        const isOpen = !!expanded[continentKey];
        return (
          <View key={continentKey} style={styles.continentBlock}>
            {/* Continent row */}
            <TouchableOpacity
              onPress={() => toggle(continentKey)}
              style={styles.continentRow}
            >
              <View style={styles.continentLeft}>
                <Text style={styles.continentName}>{continent.continent}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {continent.exploredCountries}/{continent.totalCountries}
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>{isOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {isOpen &&
              continent.countries.map((country) => {
                const countryKey = `co:${continent.continent}:${country.country}`;
                const isCountryOpen = !!expanded[countryKey];
                return (
                  <View key={countryKey} style={styles.countryBlock}>
                    {/* Country row */}
                    <TouchableOpacity
                      onPress={() => toggle(countryKey)}
                      style={styles.countryRow}
                    >
                      <Text style={styles.countryName}>{country.country}</Text>
                      <Text style={styles.countryMeta}>
                        {country.exploredCities} cities{" "}
                        {isCountryOpen ? "▲" : "▼"}
                      </Text>
                    </TouchableOpacity>

                    {isCountryOpen &&
                      country.statesHierarchy.map((stateNode) => (
                        <View
                          key={`${countryKey}:${stateNode.state ?? "null"}`}
                          style={styles.stateBlock}
                        >
                          {stateNode.state ? (
                            <Text style={styles.stateLabel}>
                              {stateNode.state}
                            </Text>
                          ) : null}

                          {stateNode.cities.map((cityNode) =>
                            cityNode.places.map((place) => (
                              <PlaceRow
                                key={place.place_id}
                                place={place}
                                onDelete={confirmDelete}
                                deleting={deletingId === place.place_id}
                              />
                            ))
                          )}
                        </View>
                      ))}
                  </View>
                );
              })}
          </View>
        );
      })}
    </BottomSheetScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PlaceRow({
  place,
  onDelete,
  deleting,
}: {
  place: SavedPlace;
  onDelete: (p: SavedPlace) => void;
  deleting: boolean;
}) {
  const label =
    place.name ?? place.city ?? place.formatted ?? place.place_id;
  return (
    <View style={styles.placeRow}>
      <Text style={styles.placeLabel} numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => onDelete(place)}
        disabled={deleting}
        hitSlop={10}
        style={styles.deleteBtn}
      >
        {deleting ? (
          <Text style={styles.deleteBtnText}>…</Text>
        ) : (
          <Text style={styles.deleteBtnText}>✕</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 16, fontWeight: "600", color: "#111214", marginBottom: 12 },

  // Stats row
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statPill: {
    flex: 1,
    backgroundColor: "#f7f8f9",
    borderWidth: 1,
    borderColor: "#f0f1f2",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111214" },
  statLabel: { fontSize: 11, color: "#868c94", marginTop: 2 },

  // World explored
  worldBox: {
    borderWidth: 1,
    borderColor: "#f0f1f2",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#ffffff",
    marginBottom: 16,
  },
  worldBoxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  worldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#868c94",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  worldPct: { fontSize: 14, fontWeight: "700", color: "#111214" },
  progressTrack: {
    height: 6,
    backgroundColor: "#f0f1f2",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", borderRadius: 3 },
  worldScore: { fontSize: 11, color: "#868c94" },

  // Continent
  continentBlock: {
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#f0f1f2",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  continentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  continentLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  continentName: { fontSize: 14, fontWeight: "600", color: "#111214" },
  badge: {
    backgroundColor: "#f7f8f9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: "#868c94" },
  chevron: { fontSize: 10, color: "#868c94" },

  // Country
  countryBlock: {
    borderTopWidth: 1,
    borderTopColor: "#f7f8f9",
  },
  countryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#fafbfc",
  },
  countryName: { fontSize: 13, color: "#111214" },
  countryMeta: { fontSize: 12, color: "#868c94" },

  // State
  stateBlock: { paddingLeft: 8 },
  stateLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#868c94",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Place row
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f7f8f9",
  },
  placeLabel: { flex: 1, fontSize: 13, color: "#3d4249" },
  deleteBtn: { marginLeft: 12, paddingHorizontal: 4 },
  deleteBtnText: { fontSize: 12, color: "#868c94" },

  // Empty
  emptyBox: {
    marginTop: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#e4e6e8",
    borderRadius: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: "#3d4249" },
  emptyDesc: {
    fontSize: 13,
    color: "#868c94",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 19,
  },
});
