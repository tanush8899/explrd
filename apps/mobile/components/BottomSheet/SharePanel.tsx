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
import PassportCard from "@/components/PassportCard";
import { colors } from "@/lib/theme";
import {
  HeroCard,
  Card,
  IconWell,
  ProgressBar,
  SectionHeading,
  ListRow,
  AnimatedEntrance,
} from "@/components/ui";

type Props = { places: SavedPlace[] };

// ─── Score tier ───────────────────────────────────────────────────────────────

function scoreTier(score: number): { label: string; emoji: string; color: string } {
  if (score >= 1000) return { label: "Legendary Explorer", emoji: "🌍", color: "#f59e0b" };
  if (score >= 500)  return { label: "World Traveler",     emoji: "✈️", color: "#7cb1ff" };
  if (score >= 300)  return { label: "Globetrotter",       emoji: "🗺️", color: "#b794ff" };
  if (score >= 150)  return { label: "Adventurer",         emoji: "⛺", color: "#5be0a0" };
  if (score >= 50)   return { label: "Explorer",           emoji: "🧭", color: "#5fd6e8" };
  return                    { label: "Wanderer",            emoji: "👣", color: "#c7ccd4" };
}

// ─── Derived insights ─────────────────────────────────────────────────────────

function deriveInsights(places: SavedPlace[]) {
  if (places.length === 0) return null;

  let north = places[0], south = places[0], east = places[0], west = places[0];
  for (const p of places) {
    if (p.lat > north.lat) north = p;
    if (p.lat < south.lat) south = p;
    if (p.lng > east.lng)  east  = p;
    if (p.lng < west.lng)  west  = p;
  }

  const countryCounts = new Map<string, number>();
  for (const p of places) {
    const c = p.country ?? p.normalized_country;
    if (c) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  const sortedCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topCountryEntry = sortedCountries[0] ?? null;
  const soloCountries   = sortedCountries.filter(([, n]) => n === 1).map(([c]) => c);

  const continentCounts = new Map<string, number>();
  for (const p of places) {
    const c = p.continent ?? p.normalized_continent;
    if (c) continentCounts.set(c, (continentCounts.get(c) ?? 0) + 1);
  }
  const continentList = [...continentCounts.entries()];

  const ALL_CONTINENTS = ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"];
  const visitedSet = new Set(continentList.map(([c]) => c));
  const unvisited = ALL_CONTINENTS.filter((c) => !visitedSet.has(c));

  return {
    north, south, east, west,
    topCountry: topCountryEntry ? { name: topCountryEntry[0], count: topCountryEntry[1] } : null,
    soloCountries,
    unvisited,
  };
}

function placeLabel(p: SavedPlace): string {
  return [p.city ?? p.name ?? p.formatted ?? p.place_id, p.country].filter(Boolean).join(", ");
}
const lngDir = (lng: number) => (lng >= 0 ? "E" : "W");
const latDir = (lat: number) => (lat >= 0 ? "N" : "S");

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function SharePanel({ places }: Props) {
  const { user } = useSession();
  const shotRef = useRef<ViewShotRef>(null);
  const [capturing, setCapturing] = useState(false);

  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Explorer";

  const stats      = useMemo(() => getExplrdStats(places),       [places]);
  const continents = useMemo(() => getContinentSummary(places),  [places]);
  const countries  = useMemo(() => getCountryCoverage(places),   [places]);
  const insights   = useMemo(() => deriveInsights(places),       [places]);
  const tier       = scoreTier(stats.score);

  const handleShare = async () => {
    if (!shotRef.current || capturing) return;
    setCapturing(true);
    try {
      const uri = await shotRef.current.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "image/png" });
      else await Share.share({ url: uri });
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
      {/* Passport card + share */}
      <AnimatedEntrance index={0}>
        <View style={styles.cardWrapper}>
          <PassportCard ref={shotRef} displayName={displayName} stats={stats} />
          <TouchableOpacity
            style={styles.shareOverlay}
            onPress={handleShare}
            disabled={capturing}
            activeOpacity={0.8}
            hitSlop={8}
          >
            {capturing
              ? <ActivityIndicator size="small" color="#ffffff" />
              : <Ionicons name="share-outline" size={18} color="#ffffff" />}
          </TouchableOpacity>
        </View>
      </AnimatedEntrance>

      {places.length === 0 && (
        <AnimatedEntrance index={1}>
          <Card style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Your passport is empty</Text>
            <Text style={styles.emptyDesc}>
              Add your first city to start building your travel story.
            </Text>
          </Card>
        </AnimatedEntrance>
      )}

      {places.length > 0 && (
        <>
          {/* Explorer score */}
          <AnimatedEntrance index={1}>
            <HeroCard eyebrow="Explorer Score" style={styles.block}>
              <View style={styles.scoreTop}>
                <Text style={styles.scoreNum}>{stats.score.toLocaleString()}</Text>
                <View style={[styles.tierBadge, { borderColor: tier.color + "66" }]}>
                  <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                  <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
                </View>
              </View>
              <View style={styles.scoreBars}>
                <ScoreBar label="Countries" value={stats.uniqueCountries} max={195} color="#7cb1ff" />
                <ScoreBar label="Regions"   value={stats.uniqueStates}    max={500} color="#b794ff" />
                <ScoreBar label="Cities"    value={stats.uniqueCities}    max={1000} color="#5be0a0" />
              </View>
            </HeroCard>
          </AnimatedEntrance>

          {/* World explored breakdown */}
          <SectionHeading>World Explored</SectionHeading>
          <View style={styles.breakdownRow}>
            <BreakdownCard value={`${stats.worldExploredBreakdown.countries}%`} label="Country" sub="of global territory" color="#3b82f6" />
            <BreakdownCard value={`${stats.worldExploredBreakdown.regions}%`}   label="Region"  sub="within countries"   color="#8b5cf6" />
            <BreakdownCard value={`${stats.worldExploredBreakdown.cities}%`}    label="City"    sub="urban depth"        color="#10b981" />
          </View>

          {/* Highlights */}
          {insights && (
            <>
              <SectionHeading>Highlights</SectionHeading>
              <View style={styles.highlightGrid}>
                <HighlightCard icon="arrow-up-outline"   color="#f59e0b" label="Northernmost" value={placeLabel(insights.north)} sub={`${Math.abs(insights.north.lat).toFixed(1)}° ${latDir(insights.north.lat)}`} />
                <HighlightCard icon="arrow-down-outline" color="#06b6d4" label="Southernmost" value={placeLabel(insights.south)} sub={`${Math.abs(insights.south.lat).toFixed(1)}° ${latDir(insights.south.lat)}`} />
                <HighlightCard icon="arrow-forward-outline" color="#ec4899" label="Furthest East" value={placeLabel(insights.east)} sub={`${Math.abs(insights.east.lng).toFixed(1)}° ${lngDir(insights.east.lng)}`} />
                <HighlightCard icon="arrow-back-outline"    color="#f97316" label="Furthest West" value={placeLabel(insights.west)} sub={`${Math.abs(insights.west.lng).toFixed(1)}° ${lngDir(insights.west.lng)}`} />
              </View>

              {insights.topCountry && (
                <FactRow icon="trophy" color="#f59e0b" title="Most stamped country" value={insights.topCountry.name}
                  sub={`${insights.topCountry.count} ${insights.topCountry.count === 1 ? "place" : "places"} logged`} />
              )}
              {insights.soloCountries.length > 0 && (
                <FactRow icon="footsteps" color="#10b981" title="One-hit wonders"
                  value={`${insights.soloCountries.length} ${insights.soloCountries.length === 1 ? "country" : "countries"}`}
                  sub={insights.soloCountries.length <= 4 ? insights.soloCountries.join(" • ") : `${insights.soloCountries.slice(0, 4).join(" • ")} + ${insights.soloCountries.length - 4} more`} />
              )}
              {insights.unvisited.length > 0 ? (
                <FactRow icon="compass" color="#8b5cf6" title="Continents still to explore"
                  value={`${insights.unvisited.length} remaining`} sub={insights.unvisited.join(" • ")} />
              ) : (
                <FactRow icon="earth" color="#3b82f6" title="All-continent achiever"
                  value="Every continent visited!" sub="You've set foot on all 7 continents — incredible." />
              )}
            </>
          )}

          {/* By continent */}
          {continents.length > 0 && (
            <>
              <SectionHeading>By Continent</SectionHeading>
              <Card padded={false} style={styles.listCard}>
                {continents.map((c, i) => (
                  <View key={c.continent} style={[styles.continentRow, i > 0 && styles.rowDivider]}>
                    <View style={styles.continentLeft}>
                      <Text style={styles.continentName}>{c.continent}</Text>
                      <Text style={styles.continentSub}>
                        {c.countries}/{c.totalCountries} countries • {c.cities} cities
                      </Text>
                      <ProgressBar progress={c.percentExplored} color={colors.blue} height={4} style={styles.continentBar} />
                    </View>
                    <Text style={styles.continentPct}>{c.percentExplored}%</Text>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Countries visited */}
          {countries.length > 0 && (
            <>
              <SectionHeading>Countries Visited</SectionHeading>
              <View style={styles.countryGrid}>
                {countries.map((c) => (
                  <View key={c.country} style={styles.countryChip}>
                    <Text style={styles.countryChipName} numberOfLines={1}>{c.country}</Text>
                    <Text style={styles.countryChipCount}>
                      {c.exploredCities} {c.exploredCities === 1 ? "city" : "cities"}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Recent stamps */}
          {places.length > 0 && (
            <>
              <SectionHeading>Recent Stamps</SectionHeading>
              <Card padded={false} style={styles.listCard}>
                {places.slice(0, 8).map((p, i) => (
                  <ListRow
                    key={p.place_id}
                    divider={i > 0}
                    leading={<View style={styles.stampDot} />}
                    title={p.city ?? p.name ?? p.formatted ?? p.place_id}
                    subtitle={[p.state, p.country].filter(Boolean).join(", ") || undefined}
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View style={styles.scoreBarBlock}>
      <View style={styles.scoreBarMeta}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <Text style={[styles.scoreBarValue, { color }]}>{value}</Text>
      </View>
      <ProgressBar progress={pct || 1} color={color} track="rgba(255,255,255,0.12)" height={4} />
    </View>
  );
}

function BreakdownCard({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
  return (
    <Card inset padded={false} style={styles.breakdownCard}>
      <Text style={[styles.breakdownValue, { color }]}>{value}</Text>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownSub}>{sub}</Text>
    </Card>
  );
}

function HighlightCard({ icon, color, label, value, sub }: {
  icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; label: string; value: string; sub?: string;
}) {
  return (
    <Card style={styles.highlightCard}>
      <IconWell name={icon} color={color} diameter={34} />
      <Text style={styles.highlightLabel}>{label}</Text>
      <Text style={styles.highlightValue} numberOfLines={2}>{value}</Text>
      {sub ? <Text style={[styles.highlightSub, { color }]}>{sub}</Text> : null}
    </Card>
  );
}

function FactRow({ icon, color, title, value, sub }: {
  icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; title: string; value: string; sub?: string;
}) {
  return (
    <Card style={styles.factRow}>
      <IconWell name={icon} color={color} diameter={38} />
      <View style={styles.factBody}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text style={styles.factValue}>{value}</Text>
        {sub ? <Text style={styles.factSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  block: { marginBottom: 4 },

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
  shareOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyBox: { marginTop: 8, alignItems: "center", paddingVertical: 28 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  emptyDesc: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: "center", lineHeight: 20, maxWidth: 260 },

  // Score
  scoreTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  scoreNum: { fontSize: 40, fontWeight: "800", color: "#ffffff", letterSpacing: -1.4 },
  tierBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.06)", marginTop: 6,
  },
  tierEmoji: { fontSize: 14 },
  tierLabel: { fontSize: 12, fontWeight: "700" },
  scoreBars: { gap: 12 },
  scoreBarBlock: {},
  scoreBarMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  scoreBarLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "500" },
  scoreBarValue: { fontSize: 12, fontWeight: "700" },

  // Breakdown
  breakdownRow: { flexDirection: "row", gap: 8 },
  breakdownCard: { flex: 1, padding: 12 },
  breakdownValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.6, marginBottom: 2 },
  breakdownLabel: { fontSize: 12, fontWeight: "700", color: colors.ink, marginBottom: 2 },
  breakdownSub: { fontSize: 11, color: colors.muted, lineHeight: 14 },

  // Highlights
  highlightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  highlightCard: { width: "47.5%", padding: 14 },
  highlightLabel: {
    fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase",
    letterSpacing: 0.5, marginTop: 10, marginBottom: 3,
  },
  highlightValue: { fontSize: 14, fontWeight: "700", color: colors.ink, lineHeight: 18 },
  highlightSub: { fontSize: 11, marginTop: 3, fontWeight: "700" },

  // Fact rows
  factRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 10 },
  factBody: { flex: 1 },
  factTitle: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  factValue: { fontSize: 16, fontWeight: "700", color: colors.ink },
  factSub: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },

  // Continent list
  listCard: { paddingHorizontal: 14 },
  continentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  continentLeft: { flex: 1 },
  continentName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  continentSub: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 8 },
  continentBar: {},
  continentPct: { fontSize: 14, fontWeight: "700", color: colors.blue },

  // Country chips
  countryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  countryChip: {
    backgroundColor: colors.fill, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center",
  },
  countryChipName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  countryChipCount: { fontSize: 11, color: colors.muted, marginTop: 1 },

  // Recent stamps
  stampDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
});
