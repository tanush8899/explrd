import React, { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SheetScrollContext } from "@/components/Sheet";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getExplrdStats, getPlaceHierarchy } from "@explrd/shared";
import type { SavedPlace } from "@explrd/shared";

type Props = {
  places: SavedPlace[];
  onDelete: (placeId: string) => Promise<void>;
  deletingId: string | null;
  displayName?: string;
};

type ExpandedState = Record<string, boolean>;

export default function MyPlacesPanel({
  places,
  onDelete,
  deletingId,
  displayName,
}: Props) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const stats = useMemo(() => getExplrdStats(places), [places]);
  const hierarchy = useMemo(() => getPlaceHierarchy(places), [places]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const confirmDelete = (place: SavedPlace) => {
    const label =
      place.name ?? place.city ?? place.formatted ?? place.place_id;
    Alert.alert("Remove Place", `Remove "${label}" from your passport?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void onDelete(place.place_id),
      },
    ]);
  };

  const initial = displayName ? displayName.charAt(0).toUpperCase() : "E";
  const progressWidth = Math.min(stats.percentWorldTraveled, 100);

  // Collapse the sheet when the user flicks down from the scroll top;
  // disable scroll entirely unless the sheet is fully open (state 2).
  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      onScrollEndDrag={(e) => {
        const { contentOffset, velocity } = e.nativeEvent;
        if (contentOffset.y <= 0 && (velocity?.y ?? 0) < -0.3) {
          onScrollEndDragAtTop(Math.abs(velocity?.y ?? 0));
        }
      }}
    >
      {/* Dark stats card */}
      <View style={styles.statsCardWrapper}>
        <LinearGradient
          colors={["#0f1829", "#1a3050"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsCard}
        >
          {/* Top row */}
          <View style={styles.statsCardTopRow}>
            <Text style={styles.worldExploredLabel}>WORLD EXPLORED</Text>
            <TouchableOpacity style={styles.snapshotPill}>
              <Text style={styles.snapshotText}>SNAPSHOT</Text>
            </TouchableOpacity>
          </View>

          {/* Large percentage */}
          <Text style={styles.percentText}>{stats.percentWorldTraveled}%</Text>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={["#3b82f6", "#8b5cf6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progressWidth}%` }]}
            />
          </View>

          {/* Bottom stats */}
          <View style={styles.statsBottomRow}>
            <StatBox value={stats.uniqueCities} label="CITIES" />
            <StatBox value={stats.uniqueCountries} label="COUNTRIES" />
            <StatBox value={stats.uniqueContinents} label="CONTINENTS" />
          </View>
        </LinearGradient>
      </View>

      {/* Empty state */}
      {places.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No places yet</Text>
          <Text style={styles.emptyDesc}>
            Tap + to save your first city.
          </Text>
        </View>
      )}

      {/* Continent list */}
      {hierarchy.map((continent) => {
        const continentKey = `c:${continent.continent}`;
        const isOpen = !!expanded[continentKey];
        const continentPercent = continent.percentExplored;

        return (
          <View key={continentKey} style={styles.continentBlock}>
            {/* Continent header */}
            <Text style={styles.continentLabel}>CONTINENT</Text>
            <TouchableOpacity
              onPress={() => toggle(continentKey)}
              style={styles.continentRow}
              activeOpacity={0.7}
            >
              <View style={styles.continentLeft}>
                <Text style={styles.continentName}>{continent.continent}</Text>
                <View style={styles.continentBadge}>
                  <Text style={styles.continentBadgeText}>
                    {continentPercent}%
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color="#868c94"
              />
            </TouchableOpacity>

            <Text style={styles.continentSubtitle}>
              {continent.exploredCountries}/{continent.totalCountries} countries
              explored
            </Text>

            {/* Continent progress bar */}
            <View style={styles.continentProgressTrack}>
              <View
                style={[
                  styles.continentProgressFill,
                  { width: `${continentPercent}%` },
                ]}
              />
            </View>

            {/* Country cards */}
            {isOpen &&
              continent.countries.map((country) => {
                const countryKey = `co:${continent.continent}:${country.country}`;
                const isCountryOpen = !!expanded[countryKey];
                const countryPct = country.percentExplored ?? 0;

                return (
                  <View key={countryKey} style={styles.countryCard}>
                    <TouchableOpacity
                      onPress={() => toggle(countryKey)}
                      style={styles.countryCardHeader}
                      activeOpacity={0.7}
                    >
                      <View style={styles.countryCardLeft}>
                        <Text style={styles.countryName}>
                          {country.country}
                        </Text>
                        <Text style={styles.countryMeta}>
                          {country.exploredStates > 0
                            ? `${country.exploredStates} states • `
                            : ""}
                          {country.exploredCities} cities
                        </Text>
                      </View>
                      <View style={styles.countryCardRight}>
                        <Text style={styles.countryPct}>{countryPct}%</Text>
                        <Ionicons
                          name={isCountryOpen ? "chevron-up" : "chevron-forward"}
                          size={14}
                          color="#868c94"
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Country progress bar */}
                    <View style={styles.countryProgressTrack}>
                      <View
                        style={[
                          styles.countryProgressFill,
                          { width: `${countryPct}%` },
                        ]}
                      />
                    </View>

                    {/* State/City/Place rows */}
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
    </ScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
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
  container: { padding: 16, paddingBottom: 100 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: "700", color: "#111214" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e4e6e8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "600", color: "#3d4249" },

  // Stats card
  statsCardWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
  },
  statsCard: {
    borderRadius: 20,
    padding: 20,
    minHeight: 180,
  },
  statsCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  worldExploredLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  snapshotPill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  snapshotText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  percentText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
    marginVertical: 8,
  },
  progressFill: { height: "100%", borderRadius: 2 },
  statsBottomRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Continent
  continentBlock: {
    marginBottom: 20,
  },
  continentLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#868c94",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  continentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  continentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  continentName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111214",
  },
  continentBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e6e8",
    alignItems: "center",
    justifyContent: "center",
  },
  continentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111214",
  },
  continentSubtitle: {
    fontSize: 13,
    color: "#868c94",
    marginBottom: 8,
  },
  continentProgressTrack: {
    height: 4,
    backgroundColor: "#e4e6e8",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 12,
  },
  continentProgressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },

  // Country card
  countryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f1f2",
  },
  countryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  countryCardLeft: { flex: 1 },
  countryName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111214",
    marginBottom: 2,
  },
  countryMeta: { fontSize: 12, color: "#868c94" },
  countryCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countryPct: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3b82f6",
  },
  countryProgressTrack: {
    height: 3,
    backgroundColor: "#f0f1f2",
    borderRadius: 2,
    overflow: "hidden",
  },
  countryProgressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },

  // State
  stateBlock: { paddingTop: 8 },
  stateLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#868c94",
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Place row
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f7f8f9",
  },
  placeLabel: { flex: 1, fontSize: 13, color: "#3d4249" },
  deleteBtn: { marginLeft: 12, paddingHorizontal: 4 },
  deleteBtnText: { fontSize: 12, color: "#868c94" },

  // Empty
  emptyBox: {
    marginTop: 8,
    marginBottom: 24,
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
