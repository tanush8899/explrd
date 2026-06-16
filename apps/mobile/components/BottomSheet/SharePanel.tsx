import React, { useContext, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { type ViewShotRef } from "react-native-view-shot";
import { getExplrdStats, getContinentSummary, getCountryCoverage } from "@explrd/shared";
import type { SavedPlace } from "@explrd/shared";
import { SheetScrollContext } from "@/components/Sheet";
import { useSession } from "@/lib/SessionContext";
import { useProfile } from "@/lib/ProfileContext";
import PassportCard from "@/components/PassportCard";
import AnimatedBar from "@/components/AnimatedBar";
import { colors } from "@/lib/theme";

// Finite world totals so each meter can show "X of Y" + how much is left.
const WORLD_COUNTRIES = 195;
const WORLD_CONTINENTS = 7;

type Props = {
  places: SavedPlace[];
};

/** "tanush_sanjay" / "tanush sanjay" → "Tanush Sanjay". */
function titleCase(s: string): string {
  return s
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ─── Derived insights ─────────────────────────────────────────────────────────

function deriveInsights(places: SavedPlace[]) {
  if (places.length === 0) return null;

  // Extreme lats/lngs
  let north = places[0], south = places[0], east = places[0], west = places[0];
  for (const p of places) {
    if (p.lat > north.lat) north = p;
    if (p.lat < south.lat) south = p;
    if (p.lng > east.lng)  east  = p;
    if (p.lng < west.lng)  west  = p;
  }

  // Country counts
  const countryCounts = new Map<string, number>();
  for (const p of places) {
    const c = p.country ?? p.normalized_country;
    if (c) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  const sortedCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topCountryEntry = sortedCountries[0] ?? null;
  const soloCountries   = sortedCountries.filter(([, n]) => n === 1).map(([c]) => c);

  // Rarest continent (fewest places)
  const continentCounts = new Map<string, number>();
  for (const p of places) {
    const c = p.continent ?? p.normalized_continent;
    if (c) continentCounts.set(c, (continentCounts.get(c) ?? 0) + 1);
  }
  const continentList = [...continentCounts.entries()];
  const rareContinent = continentList.sort((a, b) => a[1] - b[1])[0] ?? null;

  // All 7 continents
  const ALL_CONTINENTS = ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"];
  const visitedSet = new Set(continentList.map(([c]) => c));
  const unvisited = ALL_CONTINENTS.filter((c) => !visitedSet.has(c));

  return {
    north, south, east, west,
    topCountry: topCountryEntry ? { name: topCountryEntry[0], count: topCountryEntry[1] } : null,
    soloCountries,
    rareContinent: rareContinent ? { name: rareContinent[0], count: rareContinent[1] } : null,
    unvisited,
    uniqueCountriesCount: countryCounts.size,
  };
}

function placeLabel(p: SavedPlace): string {
  return [p.city ?? p.name ?? p.formatted ?? p.place_id, p.country].filter(Boolean).join(", ");
}

function lngDir(lng: number) { return lng >= 0 ? "E" : "W"; }
function latDir(lat: number) { return lat >= 0 ? "N" : "S"; }

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function SharePanel({ places }: Props) {
  const { user } = useSession();
  const { profile } = useProfile();
  const shotRef = useRef<ViewShotRef>(null);
  const [capturing, setCapturing] = useState(false);

  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  const displayName = useMemo(() => {
    const fromProfile =
      profile?.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    const raw =
      fromProfile ||
      (user?.user_metadata?.full_name as string | undefined) ||
      user?.email?.split("@")[0] ||
      "Explorer";
    return titleCase(raw);
  }, [profile, user]);

  const stats     = useMemo(() => getExplrdStats(places),       [places]);
  const continents = useMemo(() => getContinentSummary(places), [places]);
  const countries  = useMemo(() => getCountryCoverage(places),  [places]);
  const insights   = useMemo(() => deriveInsights(places),      [places]);

  const handleShare = async () => {
    if (!shotRef.current || capturing) return;
    setCapturing(true);
    try {
      const uri = await shotRef.current.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png" });
      } else {
        await Share.share({ url: uri });
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "";
      if (!msg.includes("cancelled") && !msg.includes("dismiss")) {
        Alert.alert("Error", "Could not share passport image.");
      }
    } finally {
      setCapturing(false);
    }
  };

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
      {/* ── Passport card ──────────────────────────────────────────────────── */}
      <View style={styles.cardWrapper}>
        <PassportCard ref={shotRef} displayName={displayName} stats={stats} />
      </View>

      {/* Share lives in its own button so it never overlaps the card's date. */}
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={handleShare}
        disabled={capturing}
        activeOpacity={0.85}
      >
        {capturing ? (
          <ActivityIndicator size="small" color={colors.blue} />
        ) : (
          <>
            <Ionicons name="share-outline" size={17} color={colors.blue} />
            <Text style={styles.shareBtnText}>Share Passport</Text>
          </>
        )}
      </TouchableOpacity>

      {places.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Your passport is empty</Text>
          <Text style={styles.emptyDesc}>
            Add your first city to start building your travel story.
          </Text>
        </View>
      )}

      {places.length > 0 && (
        <>
          {/* ── World Explored — sleek progress meters ───────────────────────── */}
          <SectionHeading>World Explored</SectionHeading>
          <WorldMeterCard
            label="Countries"
            value={stats.uniqueCountries}
            total={WORLD_COUNTRIES}
            color="#3b82f6"
          />
          <WorldMeterCard
            label="Continents"
            value={stats.uniqueContinents}
            total={WORLD_CONTINENTS}
            color="#8b5cf6"
          />
          <WorldMeterCard
            label="Cities"
            value={stats.uniqueCities}
            color="#10b981"
          />

          {/* ── Highlights ───────────────────────────────────────────────────── */}
          {insights && (
            <>
              <SectionHeading>Highlights</SectionHeading>

              <View style={styles.highlightGrid}>
                <HighlightCard
                  icon="arrow-up-circle"
                  color="#f59e0b"
                  label="Northernmost Stamp"
                  value={placeLabel(insights.north)}
                  sub={`${Math.abs(insights.north.lat).toFixed(1)}° ${latDir(insights.north.lat)}`}
                />
                <HighlightCard
                  icon="arrow-down-circle"
                  color="#06b6d4"
                  label="Southernmost Stamp"
                  value={placeLabel(insights.south)}
                  sub={`${Math.abs(insights.south.lat).toFixed(1)}° ${latDir(insights.south.lat)}`}
                />
                <HighlightCard
                  icon="chevron-forward-circle"
                  color="#ec4899"
                  label="Furthest East"
                  value={placeLabel(insights.east)}
                  sub={`${Math.abs(insights.east.lng).toFixed(1)}° ${lngDir(insights.east.lng)}`}
                />
                <HighlightCard
                  icon="chevron-back-circle"
                  color="#f97316"
                  label="Furthest West"
                  value={placeLabel(insights.west)}
                  sub={`${Math.abs(insights.west.lng).toFixed(1)}° ${lngDir(insights.west.lng)}`}
                />
              </View>

              {insights.topCountry && (
                <FactRow
                  icon="trophy"
                  iconColor="#f59e0b"
                  title="Most stamped country"
                  value={insights.topCountry.name}
                  sub={`${insights.topCountry.count} ${insights.topCountry.count === 1 ? "place" : "places"} logged`}
                />
              )}

              {insights.soloCountries.length > 0 && (
                <FactRow
                  icon="footsteps"
                  iconColor="#10b981"
                  title="One-hit wonders"
                  value={`${insights.soloCountries.length} ${insights.soloCountries.length === 1 ? "country" : "countries"}`}
                  sub={
                    insights.soloCountries.length <= 4
                      ? insights.soloCountries.join(" • ")
                      : `${insights.soloCountries.slice(0, 4).join(" • ")} + ${insights.soloCountries.length - 4} more`
                  }
                />
              )}

              {insights.unvisited.length > 0 && (
                <FactRow
                  icon="compass"
                  iconColor="#8b5cf6"
                  title="Continents still to explore"
                  value={`${insights.unvisited.length} remaining`}
                  sub={insights.unvisited.join(" • ")}
                />
              )}

              {insights.unvisited.length === 0 && (
                <FactRow
                  icon="earth"
                  iconColor="#3b82f6"
                  title="All-continent achiever"
                  value="Every continent visited!"
                  sub="You've set foot on all 7 continents — incredible."
                />
              )}
            </>
          )}

          {/* ── Continent Breakdown ───────────────────────────────────────────── */}
          {continents.length > 0 && (
            <>
              <SectionHeading>By Continent</SectionHeading>
              {continents.map((c) => (
                <View key={c.continent} style={styles.continentRow}>
                  <View style={styles.continentLeft}>
                    <Text style={styles.continentName}>{c.continent}</Text>
                    <Text style={styles.continentSub}>
                      {c.countries}/{c.totalCountries} countries • {c.cities} cities
                    </Text>
                    <View style={styles.cProgressTrack}>
                      <View style={[styles.cProgressFill, { width: `${c.percentExplored}%` }]} />
                    </View>
                  </View>
                  <View style={styles.continentBadge}>
                    <Text style={styles.continentPct}>{c.percentExplored}%</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Countries visited ─────────────────────────────────────────────── */}
          {countries.length > 0 && (
            <>
              <SectionHeading>Countries Visited</SectionHeading>
              <View style={styles.countryGrid}>
                {countries.map((c) => (
                  <View key={c.country} style={styles.countryChip}>
                    <Text style={styles.countryChipName} numberOfLines={1}>{c.country}</Text>
                    <Text style={styles.countryChipCount}>{c.exploredCities} {c.exploredCities === 1 ? "city" : "cities"}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Recent stamps ─────────────────────────────────────────────────── */}
          {places.length > 0 && (
            <>
              <SectionHeading>Recent Stamps</SectionHeading>
              {places.slice(0, 8).map((p) => (
                <View key={p.place_id} style={styles.recentRow}>
                  <View style={styles.recentDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentCity} numberOfLines={1}>
                      {p.city ?? p.name ?? p.formatted ?? p.place_id}
                    </Text>
                    <Text style={styles.recentCountry} numberOfLines={1}>
                      {[p.state, p.country].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

function WorldMeterCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  // Bounded metrics fill toward their real total; cities (unbounded) use a soft
  // log curve so the bar still reads as progress.
  const pct = total
    ? Math.min((value / total) * 100, 100)
    : Math.min((Math.log1p(value) / Math.log1p(120)) * 100, 100);
  const left = total ? Math.max(total - value, 0) : null;

  return (
    <View style={styles.meterCard}>
      <View style={styles.meterCardTop}>
        <Text style={styles.meterCardLabel}>{label}</Text>
        <Text style={styles.meterCardValue}>
          {value}
          {total ? <Text style={styles.meterCardTotal}> / {total}</Text> : null}
        </Text>
      </View>
      <AnimatedBar pct={pct} height={8} fillColor={color} trackColor="#eceef1" />
      <Text style={styles.meterCardSub}>
        {left != null
          ? left > 0
            ? `${left} to go`
            : "Every one explored 🎉"
          : `${value} ${value === 1 ? "city" : "cities"} stamped`}
      </Text>
    </View>
  );
}

function HighlightCard({ icon, color, label, value, sub }: {
  icon: string;
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.highlightCard}>
      <View style={[styles.highlightIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as never} size={20} color={color} />
      </View>
      <Text style={styles.highlightLabel}>{label}</Text>
      <Text style={styles.highlightValue} numberOfLines={2}>{value}</Text>
      {sub && <Text style={styles.highlightSub}>{sub}</Text>}
    </View>
  );
}

function FactRow({ icon, iconColor, title, value, sub }: {
  icon: string;
  iconColor: string;
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.factRow}>
      <View style={[styles.factIconWrap, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon as never} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text style={styles.factValue}>{value}</Text>
        {sub && <Text style={styles.factSub} numberOfLines={2}>{sub}</Text>}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 100 },

  // Passport card + share overlay
  cardWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: -8,
    marginBottom: 4,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
  },
  shareBtnText: { fontSize: 15, fontWeight: "700", color: colors.blue },

  // World Explored meter cards
  meterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f0f1f2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  meterCardTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  meterCardLabel: { fontSize: 15, fontWeight: "700", color: "#111214", letterSpacing: -0.2 },
  meterCardValue: { fontSize: 17, fontWeight: "800", color: "#111214", letterSpacing: -0.3 },
  meterCardTotal: { fontSize: 14, fontWeight: "600", color: "#a0a7b0" },
  meterCardSub: { fontSize: 11, color: "#868c94", marginTop: 8, fontWeight: "500" },

  // Empty
  emptyBox: {
    marginTop: 8,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#e4e6e8",
    borderRadius: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: "#3d4249" },
  emptyDesc: { fontSize: 13, color: "#868c94", marginTop: 6, textAlign: "center", lineHeight: 19 },

  // Section headings
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111214",
    letterSpacing: -0.3,
    marginTop: 22,
    marginBottom: 12,
  },

  // Score card
  scoreCardWrapper: { borderRadius: 20, overflow: "hidden", marginBottom: 4 },
  scoreCard: { borderRadius: 20, padding: 20 },
  scoreTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  scoreEyebrow: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreNum: { fontSize: 38, fontWeight: "800", color: "#ffffff", letterSpacing: -1 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tierEmoji: { fontSize: 14 },
  tierLabel: { fontSize: 12, fontWeight: "700" },

  // Score bars
  scoreBreakdown: { gap: 10 },
  scoreBarBlock: {},
  scoreBarMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  scoreBarLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: "500" },
  scoreBarValue: { fontSize: 11, fontWeight: "700" },
  scoreBarTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  scoreBarFill: { height: "100%", borderRadius: 2 },

  // World Explored breakdown
  breakdownRow: { flexDirection: "row", gap: 8 },
  breakdownCard: {
    flex: 1,
    backgroundColor: "#f7f8f9",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ebebf0",
  },
  breakdownValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5, marginBottom: 2 },
  breakdownLabel: { fontSize: 11, fontWeight: "700", color: "#111214", marginBottom: 2 },
  breakdownSub: { fontSize: 10, color: "#868c94", lineHeight: 14 },

  // Highlights grid
  highlightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  highlightCard: {
    width: "47.5%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f0f1f2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#868c94",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  highlightValue: { fontSize: 13, fontWeight: "700", color: "#111214", lineHeight: 18 },
  highlightSub: { fontSize: 11, color: "#3b82f6", marginTop: 3, fontWeight: "600" },

  // Fact rows
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f0f1f2",
    gap: 12,
  },
  factIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  factTitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#868c94",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  factValue: { fontSize: 15, fontWeight: "700", color: "#111214" },
  factSub: { fontSize: 12, color: "#868c94", marginTop: 3, lineHeight: 17 },

  // Continent rows
  continentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0f1f2",
    gap: 12,
  },
  continentLeft: { flex: 1 },
  continentName: { fontSize: 14, fontWeight: "700", color: "#111214", marginBottom: 2 },
  continentSub: { fontSize: 11, color: "#868c94", marginBottom: 6 },
  cProgressTrack: {
    height: 3,
    backgroundColor: "#f0f1f2",
    borderRadius: 2,
    overflow: "hidden",
  },
  cProgressFill: { height: "100%", backgroundColor: colors.blue, borderRadius: 2 },
  continentBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e4e6e8",
    alignItems: "center",
    justifyContent: "center",
  },
  continentPct: { fontSize: 12, fontWeight: "700", color: colors.blue },

  // Country grid
  countryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  countryChip: {
    backgroundColor: "#f7f8f9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ebebf0",
    alignItems: "center",
  },
  countryChipName: { fontSize: 13, fontWeight: "600", color: "#111214" },
  countryChipCount: { fontSize: 10, color: "#868c94", marginTop: 1 },

  // Recent stamps
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f7f8f9",
    gap: 10,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111214",
    flexShrink: 0,
  },
  recentCity: { fontSize: 14, fontWeight: "600", color: "#111214" },
  recentCountry: { fontSize: 12, color: "#868c94", marginTop: 1 },
});
