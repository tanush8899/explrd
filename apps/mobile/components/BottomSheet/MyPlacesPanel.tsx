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
import type { ContinentNode, CountryNode, SavedPlace } from "@explrd/shared";
import { countryFlag } from "@/lib/flags";
import { colors, gradients, radius, space, type as t, shadow } from "@/lib/theme";

type Props = {
  places: SavedPlace[];
  onDelete: (placeId: string) => Promise<void>;
  deletingId: string | null;
  displayName?: string;
};

export default function MyPlacesPanel({ places, onDelete, deletingId }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const stats = useMemo(() => getExplrdStats(places), [places]);
  const hierarchy = useMemo(() => getPlaceHierarchy(places), [places]);

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const confirmDelete = (place: SavedPlace) => {
    const label = place.name ?? place.city ?? place.formatted ?? place.place_id;
    Alert.alert("Remove Place", `Remove “${label}” from your passport?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void onDelete(place.place_id),
      },
    ]);
  };

  const worldPct = Math.min(stats.percentWorldTraveled, 100);

  // Collapse the sheet on a downward flick at the scroll top; scrolling is only
  // enabled once the sheet is fully open (handled by the Sheet).
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
      {/* ── Hero: world explored ─────────────────────────────────────────── */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <Text style={styles.heroEyebrow}>WORLD EXPLORED</Text>
          <View style={styles.heroChip}>
            <Ionicons name="earth" size={12} color={colors.onDarkSecondary} />
            <Text style={styles.heroChipText}>
              {stats.uniqueCountries} {stats.uniqueCountries === 1 ? "country" : "countries"}
            </Text>
          </View>
        </View>

        <Text style={styles.heroPct}>{stats.percentWorldTraveled}%</Text>

        <View style={styles.heroTrack}>
          <LinearGradient
            colors={gradients.progress}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.heroFill, { width: `${worldPct}%` }]}
          />
        </View>

        <View style={styles.heroStats}>
          <HeroStat value={stats.uniqueCities} label="Cities" />
          <View style={styles.heroDivider} />
          <HeroStat value={stats.uniqueCountries} label="Countries" />
          <View style={styles.heroDivider} />
          <HeroStat value={stats.uniqueContinents} label="Continents" />
        </View>
      </LinearGradient>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {places.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="map-outline" size={26} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>No places yet</Text>
          <Text style={styles.emptyDesc}>
            Search a city or country to start building your passport.
          </Text>
        </View>
      ) : (
        hierarchy.map((continent) => (
          <ContinentSection
            key={continent.continent}
            continent={continent}
            open={open}
            onToggle={toggle}
            deletingId={deletingId}
            onDelete={confirmDelete}
          />
        ))
      )}
    </ScrollView>
  );
}

// ─── Continent section ───────────────────────────────────────────────────────

function ContinentSection({
  continent,
  open,
  onToggle,
  deletingId,
  onDelete,
}: {
  continent: ContinentNode;
  open: Record<string, boolean>;
  onToggle: (key: string) => void;
  deletingId: string | null;
  onDelete: (p: SavedPlace) => void;
}) {
  const pct = Math.min(continent.percentExplored, 100);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{continent.continent}</Text>
        <Text style={styles.sectionPct}>{continent.percentExplored}%</Text>
      </View>
      <Text style={styles.sectionSub}>
        {continent.exploredCountries} of {continent.totalCountries} countries explored
      </Text>
      <View style={styles.sectionTrack}>
        <View style={[styles.sectionFill, { width: `${pct}%` }]} />
      </View>

      <View style={styles.group}>
        {continent.countries.map((country, i) => {
          const key = `${continent.continent}:${country.country}`;
          return (
            <View key={key}>
              {i > 0 && <View style={styles.separator} />}
              <CountryRow
                country={country}
                isOpen={!!open[key]}
                onPress={() => onToggle(key)}
              />
              {open[key] && (
                <PlaceList
                  country={country}
                  deletingId={deletingId}
                  onDelete={onDelete}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Country row ─────────────────────────────────────────────────────────────

function CountryRow({
  country,
  isOpen,
  onPress,
}: {
  country: CountryNode;
  isOpen: boolean;
  onPress: () => void;
}) {
  const parts: string[] = [];
  if (country.exploredCities > 0)
    parts.push(`${country.exploredCities} ${country.exploredCities === 1 ? "city" : "cities"}`);
  if (country.exploredStates > 0)
    parts.push(`${country.exploredStates} ${country.exploredStates === 1 ? "state" : "states"}`);
  const meta = parts.join("  ·  ") || "Explored";
  const pct = country.percentExplored ?? 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.flagWell}>
        <Text style={styles.flag}>{countryFlag(country.country)}</Text>
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {country.country}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPct}>{pct}%</Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-forward"}
          size={15}
          color={colors.faint}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Expanded place list ─────────────────────────────────────────────────────

function PlaceList({
  country,
  deletingId,
  onDelete,
}: {
  country: CountryNode;
  deletingId: string | null;
  onDelete: (p: SavedPlace) => void;
}) {
  return (
    <View style={styles.placeList}>
      {country.statesHierarchy.map((stateNode) => (
        <View key={stateNode.state ?? "—"}>
          {stateNode.state ? (
            <Text style={styles.stateLabel}>{stateNode.state}</Text>
          ) : null}
          {stateNode.cities.map((city) =>
            city.places.map((place) => (
              <PlaceRow
                key={place.place_id}
                place={place}
                deleting={deletingId === place.place_id}
                onDelete={onDelete}
              />
            )),
          )}
        </View>
      ))}
    </View>
  );
}

function PlaceRow({
  place,
  deleting,
  onDelete,
}: {
  place: SavedPlace;
  deleting: boolean;
  onDelete: (p: SavedPlace) => void;
}) {
  const label = place.name ?? place.city ?? place.formatted ?? place.place_id;
  return (
    <View style={styles.placeRow}>
      <View style={styles.placeDot} />
      <Text style={styles.placeName} numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => onDelete(place)}
        disabled={deleting}
        hitSlop={10}
        style={styles.placeRemove}
        activeOpacity={0.6}
      >
        <Ionicons
          name={deleting ? "ellipsis-horizontal" : "close"}
          size={14}
          color={colors.muted}
        />
      </TouchableOpacity>
    </View>
  );
}

// ─── Hero stat ───────────────────────────────────────────────────────────────

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.xl,
  },

  // Hero
  hero: {
    borderRadius: radius.lg,
    padding: space.xl,
    marginBottom: space.xxl,
    ...shadow.hero,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroEyebrow: {
    ...t.eyebrow,
    color: colors.onDarkSecondary,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.onDarkFill,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onDarkSecondary,
    letterSpacing: -0.1,
  },
  heroPct: {
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -1.6,
    color: colors.onDark,
    marginTop: space.sm,
  },
  heroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    marginTop: space.md,
    marginBottom: space.xl,
  },
  heroFill: { height: "100%", borderRadius: 3 },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onDark,
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.onDarkMuted,
    marginTop: 3,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  // Continent section
  section: { marginBottom: space.xxl },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...t.title,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  sectionPct: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.blue,
    letterSpacing: -0.4,
  },
  sectionSub: {
    ...t.footnote,
    marginTop: 2,
  },
  sectionTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    overflow: "hidden",
    marginTop: space.sm,
    marginBottom: space.md,
  },
  sectionFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.blue,
  },

  // Grouped country card
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginLeft: 14 + 40 + 12, // align past the flag well
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  flagWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  flag: { fontSize: 22, lineHeight: 26 },
  rowMid: { flex: 1, justifyContent: "center" },
  rowTitle: {
    ...t.headline,
    fontWeight: "700",
  },
  rowMeta: {
    ...t.footnote,
    marginTop: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowPct: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.blue,
    letterSpacing: -0.3,
  },

  // Expanded place list
  placeList: {
    paddingLeft: 14 + 40 + 12,
    paddingRight: 14,
    paddingBottom: space.sm,
  },
  stateLabel: {
    ...t.eyebrow,
    marginTop: space.sm,
    marginBottom: 2,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    gap: 10,
  },
  placeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.faint,
  },
  placeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: colors.inkSecondary,
    letterSpacing: -0.2,
  },
  placeRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty
  empty: {
    alignItems: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  emptyTitle: {
    ...t.headline,
    fontWeight: "700",
  },
  emptyDesc: {
    ...t.subhead,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 20,
  },
});
