import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";
import type { ExplrdStats } from "@explrd/shared";

export type PassportCardProps = {
  displayName: string;
  stats: ExplrdStats;
};

const ACCENT = "#3b82f6";

// forwardRef so SharePanel can call .capture() on the ViewShot inside
const PassportCard = forwardRef<ViewShotRef, PassportCardProps>(
  ({ displayName, stats }, ref) => {
    // Keep one decimal — "4.9%" not a rounded "5%".
    const pct = Math.min(stats.percentWorldTraveled, 100);
    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return (
      <ViewShot ref={ref} options={{ format: "png", quality: 1 }}>
        <LinearGradient
          colors={["#1a2238", "#0d1120"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.kicker}>EXPLRD PASSPORT</Text>
            <Text style={styles.date}>{today}</Text>
          </View>

          {/* Name */}
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName}
          </Text>

          {/* World explored */}
          <View>
            <View style={styles.pctRow}>
              <Text style={styles.pct}>{pct}</Text>
              <Text style={styles.pctSign}>%</Text>
              <Text style={styles.pctLabel}>world explored</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Stat label="Cities" value={stats.uniqueCities} />
            <Stat label="Countries" value={stats.uniqueCountries} />
            <Stat label="Continents" value={stats.uniqueContinents} />
          </View>
        </LinearGradient>
      </ViewShot>
    );
  }
);

PassportCard.displayName = "PassportCard";
export default PassportCard;

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const WHITE = "#ffffff";
const W55 = "rgba(255,255,255,0.55)";
const W40 = "rgba(255,255,255,0.4)";

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 24,
    overflow: "hidden",
    width: "100%",
    aspectRatio: 1.62,
    // Even vertical rhythm: four sections, equal gaps between them.
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { fontSize: 11, fontWeight: "600", letterSpacing: 2.8, color: W40 },
  date: { fontSize: 12, fontWeight: "500", color: W40 },

  // Name
  displayName: { fontSize: 27, fontWeight: "600", letterSpacing: -0.5, color: WHITE },

  // World explored
  pctRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 14 },
  pct: { fontSize: 46, fontWeight: "700", letterSpacing: -1.8, color: WHITE, lineHeight: 46 },
  pctSign: { fontSize: 24, fontWeight: "600", color: W55, marginLeft: 2, marginBottom: 3 },
  pctLabel: { fontSize: 13, fontWeight: "500", color: W40, marginLeft: 10, marginBottom: 6 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3, backgroundColor: ACCENT },

  // Stats
  statsRow: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "700", color: WHITE, letterSpacing: -0.4 },
  statLabel: { fontSize: 12, fontWeight: "500", color: W40, marginTop: 4 },
});
