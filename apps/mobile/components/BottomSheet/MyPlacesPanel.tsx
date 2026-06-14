import React, { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SheetScrollContext } from "@/components/Sheet";
import { Ionicons } from "@expo/vector-icons";
import { getExplrdStats, getPlaceHierarchy } from "@explrd/shared";
import type { SavedPlace, CountryNode } from "@explrd/shared";
import { colors, gradients, type as t } from "@/lib/theme";
import {
  HeroCard,
  Card,
  ProgressBar,
  StatTile,
  SectionHeading,
  ListRow,
  AnimatedEntrance,
} from "@/components/ui";

type Props = {
  places: SavedPlace[];
  onDelete: (placeId: string) => Promise<void>;
  deletingId: string | null;
  displayName?: string;
};

export default function MyPlacesPanel({ places, onDelete, deletingId }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const stats = useMemo(() => getExplrdStats(places), [places]);
  const hierarchy = useMemo(() => getPlaceHierarchy(places), [places]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const confirmDelete = (place: SavedPlace) => {
    const label = place.name ?? place.city ?? place.formatted ?? place.place_id;
    Alert.alert("Remove Place", `Remove "${label}" from your passport?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void onDelete(place.place_id) },
    ]);
  };

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
      {/* World-explored hero */}
      <AnimatedEntrance index={0}>
        <HeroCard eyebrow="World Explored">
          <Text style={styles.bigPercent}>{stats.percentWorldTraveled}%</Text>
          <ProgressBar
            progress={stats.percentWorldTraveled}
            gradient={gradients.progress}
            track="rgba(255,255,255,0.14)"
            height={6}
            style={styles.heroBar}
          />
          <View style={styles.statRow}>
            <StatTile tone="dark" value={stats.uniqueCities} label="Cities" />
            <StatTile tone="dark" value={stats.uniqueCountries} label="Countries" />
            <StatTile tone="dark" value={stats.uniqueContinents} label="Continents" />
          </View>
        </HeroCard>
      </AnimatedEntrance>

      {/* Empty state */}
      {places.length === 0 && (
        <AnimatedEntrance index={1}>
          <Card style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={26} color={colors.blue} />
            </View>
            <Text style={styles.emptyTitle}>No places yet</Text>
            <Text style={styles.emptyDesc}>
              Tap the search button to save your first city.
            </Text>
          </Card>
        </AnimatedEntrance>
      )}

      {/* Continents → flat country cards */}
      {hierarchy.map((continent) => (
        <View key={`c:${continent.continent}`}>
          <SectionHeading actionLabel={`${continent.percentExplored}%`}>
            {continent.continent}
          </SectionHeading>
          <Text style={styles.continentSub}>
            {continent.exploredCountries}/{continent.totalCountries} countries explored
          </Text>

          {continent.countries.map((country, idx) => (
            <AnimatedEntrance key={`co:${continent.continent}:${country.country}`} index={idx}>
              <CountryCard
                country={country}
                open={!!expanded[`co:${continent.continent}:${country.country}`]}
                onToggle={() => toggle(`co:${continent.continent}:${country.country}`)}
                onDeletePlace={confirmDelete}
                deletingId={deletingId}
              />
            </AnimatedEntrance>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Country card ─────────────────────────────────────────────────────────────

function CountryCard({
  country,
  open,
  onToggle,
  onDeletePlace,
  deletingId,
}: {
  country: CountryNode;
  open: boolean;
  onToggle: () => void;
  onDeletePlace: (p: SavedPlace) => void;
  deletingId: string | null;
}) {
  const pct = country.percentExplored ?? 0;
  const initials = country.country.slice(0, 2).toUpperCase();

  return (
    <Card style={styles.countryCard}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.countryHeader}>
        <View style={styles.flagBadge}>
          <Text style={styles.flagText}>{initials}</Text>
        </View>
        <View style={styles.countryText}>
          <Text style={styles.countryName} numberOfLines={1}>{country.country}</Text>
          <Text style={styles.countryMeta}>
            {country.exploredStates > 0 ? `${country.exploredStates} regions • ` : ""}
            {country.exploredCities} {country.exploredCities === 1 ? "city" : "cities"}
          </Text>
        </View>
        <Text style={styles.countryPct}>{pct}%</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.faint}
          style={styles.countryChevron}
        />
      </TouchableOpacity>

      <ProgressBar progress={pct} color={colors.blue} height={4} style={styles.countryBar} />

      {open && (
        <View style={styles.cityList}>
          {country.statesHierarchy.map((stateNode) => (
            <View key={stateNode.state ?? "null"}>
              {stateNode.state ? (
                <Text style={styles.stateLabel}>{stateNode.state}</Text>
              ) : null}
              {stateNode.cities.flatMap((cityNode) =>
                cityNode.places.map((place) => (
                  <ListRow
                    key={place.place_id}
                    divider
                    title={place.name ?? place.city ?? place.formatted ?? place.place_id}
                    leading={<View style={styles.placeDot} />}
                    trailing={
                      <TouchableOpacity
                        onPress={() => onDeletePlace(place)}
                        disabled={deletingId === place.place_id}
                        hitSlop={10}
                        style={styles.deleteBtn}
                      >
                        {deletingId === place.place_id ? (
                          <ActivityIndicator size="small" color={colors.faint} />
                        ) : (
                          <Ionicons name="close" size={15} color={colors.faint} />
                        )}
                      </TouchableOpacity>
                    }
                  />
                )),
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },

  // Hero
  bigPercent: { fontSize: 46, fontWeight: "800", color: "#ffffff", letterSpacing: -1.6 },
  heroBar: { marginTop: 10, marginBottom: 16 },
  statRow: { flexDirection: "row", gap: 8 },

  // Continent
  continentSub: { ...t.footnote, marginTop: -6, marginBottom: 12 },

  // Country card
  countryCard: { padding: 14, marginBottom: 10 },
  countryHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  flagBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  flagText: { fontSize: 13, fontWeight: "800", color: colors.inkSecondary, letterSpacing: 0.3 },
  countryText: { flex: 1 },
  countryName: { fontSize: 16, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  countryMeta: { fontSize: 13, color: colors.muted, marginTop: 1 },
  countryPct: { fontSize: 14, fontWeight: "700", color: colors.blue },
  countryChevron: { marginLeft: 2 },
  countryBar: { marginTop: 12 },

  // Expanded cities
  cityList: { marginTop: 4 },
  stateLabel: {
    ...t.eyebrow,
    marginTop: 10,
    marginBottom: 2,
  },
  placeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.ink,
  },
  deleteBtn: { padding: 4 },

  // Empty
  emptyBox: { marginTop: 8, alignItems: "center", paddingVertical: 28 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  emptyDesc: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
  },
});
