import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Glass";
import { getExplrdStats, getPlaceHierarchy } from "@explrd/shared";
import type { SavedPlace } from "@explrd/shared";

type Props = {
  places: SavedPlace[];
  onDelete: (placeId: string) => void;
  deletingId: string | null;
  onAddPress: () => void;
};

type ExpandedState = Record<string, boolean>;

export default function MyPlacesPanel({
  places,
  onDelete,
  deletingId,
  onAddPress,
}: Props) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const stats = useMemo(() => getExplrdStats(places), [places]);
  const hierarchy = useMemo(() => getPlaceHierarchy(places), [places]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const confirmDelete = (place: SavedPlace) => {
    const label = place.name ?? place.city ?? place.formatted ?? place.place_id;
    Alert.alert("Remove Place", `Remove "${label}" from your passport?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => onDelete(place.place_id),
      },
    ]);
  };

  // ── Empty state — Flighty's "Let's Fly Somewhere" ───────────────────────────
  if (places.length === 0) {
    return (
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Let's Explore Somewhere</Text>
          <View style={styles.emptyHintRow}>
            <Text style={styles.emptyDesc}>Tap </Text>
            <TouchableOpacity onPress={onAddPress} hitSlop={8}>
              <View style={styles.emptySearchChip}>
                <Icon name="magnifyingglass" fallback="🔍" size={12} color="#ffffff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.emptyDesc}> Search to add your first place</Text>
          </View>
        </View>
      </BottomSheetScrollView>
    );
  }

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      {/* ── Passport summary card — Flighty's gradient stat card ───────────── */}
      <LinearGradient
        colors={["#2a1a58", "#16204b", "#0a0f1a"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.summaryCard}
      >
        <Text style={styles.summaryHeader}>ALL-TIME EXPLR PASSPORT</Text>
        <Text style={styles.summarySubheader}>
          ✦ PASSPORT • PASS • PASAPORTE
        </Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>CITIES</Text>
            <Text style={styles.summaryBig}>{stats.uniqueCities}</Text>
          </View>
          <View style={[styles.summaryCell, styles.summaryCellWide]}>
            <Text style={styles.summaryLabel}>WORLD EXPLORED</Text>
            <Text style={styles.summaryBig}>
              {Math.round(stats.percentWorldTraveled)}
              <Text style={styles.summaryUnit}>%</Text>
            </Text>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={["#f7cf62", "#f2a8ff", "#76d5ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(Math.round(stats.percentWorldTraveled), 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>COUNTRIES</Text>
            <Text style={styles.summaryMid}>{stats.uniqueCountries}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>CONTINENTS</Text>
            <Text style={styles.summaryMid}>{stats.uniqueContinents}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>SCORE</Text>
            <Text style={styles.summaryMid}>{stats.score.toLocaleString()}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Where you've been ──────────────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>Where You've Been</Text>

      {hierarchy.map((continent) => {
        const continentKey = `c:${continent.continent}`;
        const isOpen = !!expanded[continentKey];
        return (
          <View key={continentKey} style={styles.continentBlock}>
            {/* Continent row */}
            <TouchableOpacity
              onPress={() => toggle(continentKey)}
              style={styles.continentRow}
              activeOpacity={0.7}
            >
              <View style={styles.continentLeft}>
                <Text style={styles.continentName}>{continent.continent}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {continent.exploredCountries}/{continent.totalCountries}
                  </Text>
                </View>
              </View>
              <Icon
                name={isOpen ? "chevron.up" : "chevron.down"}
                fallback={isOpen ? "▲" : "▼"}
                size={13}
                color="#b3b8bf"
              />
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
                      activeOpacity={0.7}
                    >
                      <Text style={styles.countryName}>{country.country}</Text>
                      <View style={styles.countryRight}>
                        <Text style={styles.countryMeta}>
                          {country.exploredCities}{" "}
                          {country.exploredCities === 1 ? "city" : "cities"}
                        </Text>
                        <Icon
                          name={isCountryOpen ? "chevron.up" : "chevron.down"}
                          fallback={isCountryOpen ? "▲" : "▼"}
                          size={11}
                          color="#c6c9ce"
                        />
                      </View>
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

function PlaceRow({
  place,
  onDelete,
  deleting,
}: {
  place: SavedPlace;
  onDelete: (p: SavedPlace) => void;
  deleting: boolean;
}) {
  const label = place.name ?? place.city ?? place.formatted ?? place.place_id;
  return (
    <View style={styles.placeRow}>
      <View style={styles.placeDot} />
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
          <Icon name="xmark" fallback="✕" size={11} color="#b3b8bf" />
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 140 },

  // Gradient summary card
  summaryCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  summaryHeader: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#ffffff",
  },
  summarySubheader: {
    fontSize: 9,
    letterSpacing: 1,
    color: "rgba(255,255,255,0.45)",
    marginTop: 3,
    marginBottom: 18,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 14,
  },
  summaryCell: {
    flex: 1,
  },
  summaryCellWide: {
    flex: 1.6,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  summaryBig: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: "#ffffff",
  },
  summaryUnit: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
  },
  summaryMid: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#ffffff",
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: "100%", borderRadius: 3 },

  // Section
  sectionHeader: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#0b0c0e",
    marginBottom: 12,
  },

  // Continent card
  continentBlock: {
    marginBottom: 10,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f6f7f8",
  },
  continentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  continentLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  continentName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#0b0c0e",
  },
  badge: {
    backgroundColor: "rgba(10,132,255,0.10)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#0a84ff" },

  // Country
  countryBlock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  countryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  countryName: { fontSize: 14, fontWeight: "600", color: "#23262b" },
  countryRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  countryMeta: { fontSize: 12, color: "#85898f" },

  // State
  stateBlock: { paddingBottom: 4 },
  stateLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#85898f",
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Place row
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 9,
    gap: 10,
  },
  placeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0a84ff",
  },
  placeLabel: { flex: 1, fontSize: 14, color: "#3d4249" },
  deleteBtn: { marginLeft: 12, padding: 2 },
  deleteBtnText: { fontSize: 12, color: "#b3b8bf" },

  // Empty
  emptyBox: {
    marginTop: 56,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#5a5f66",
  },
  emptyHintRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyDesc: {
    fontSize: 14,
    color: "#85898f",
  },
  emptySearchChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#85898f",
    alignItems: "center",
    justifyContent: "center",
  },
});
