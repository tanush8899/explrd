import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ViewShot from "react-native-view-shot";
import type { ExplrdStats } from "@explrd/shared";

export type PassportCardProps = {
  displayName: string;
  stats: ExplrdStats;
};

// forwardRef so SharePanel can call .capture() on the ViewShot inside
const PassportCard = forwardRef<ViewShot, PassportCardProps>(
  ({ displayName, stats }, ref) => {
    const pct = Math.min(Math.round(stats.percentWorldTraveled), 100);
    const today = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return (
      <ViewShot ref={ref} options={{ format: "png", quality: 1 }}>
        <LinearGradient
          colors={["#2a1a58", "#111827", "#0a0f1a"]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.card}
        >
          {/* Decorative glow blobs */}
          <View style={styles.blobGold} />
          <View style={styles.blobCyan} />
          <View style={styles.blobWhite} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerLeft}>EXPLR PASSPORT</Text>
            <Text style={styles.headerRight}>{today}</Text>
          </View>
          <View style={styles.divider} />

          {/* Explorer label + name */}
          <View style={styles.nameSection}>
            <Text style={styles.eyebrow}>EXPLORER</Text>
            <Text style={styles.displayName} numberOfLines={2}>
              {displayName}
            </Text>
          </View>

          {/* World explored box */}
          <View style={styles.worldBox}>
            <View style={styles.worldBoxHeader}>
              <Text style={styles.worldPct}>{pct}%</Text>
              <View style={styles.worldBadge}>
                <Text style={styles.worldBadgeText}>WORLD EXPLORED</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={["#f7cf62", "#f2a8ff", "#76d5ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${pct}%` }]}
              />
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatChip label="CITIES" value={stats.uniqueCities} />
            <StatChip label="COUNTRIES" value={stats.uniqueCountries} />
            <StatChip label="CONTINENTS" value={stats.uniqueContinents} />
          </View>

          {/* Footer */}
          <View style={styles.divider} />
          <View style={styles.footerRow}>
            <Text style={styles.footerLeft}>explr</Text>
            <Text style={styles.footerRight}>Keep Exploring</Text>
          </View>
        </LinearGradient>
      </ViewShot>
    );
  }
);

PassportCard.displayName = "PassportCard";
export default PassportCard;

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    width: "100%",
    aspectRatio: 1.58,
    justifyContent: "space-between",
  },

  // Glow blobs
  blobGold: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(247,207,98,0.28)",
  },
  blobCyan: {
    position: "absolute",
    top: -60,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(114,197,255,0.18)",
  },
  blobWhite: {
    position: "absolute",
    top: 0,
    left: "25%",
    width: "50%",
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.6)",
  },
  headerRight: {
    fontSize: 9,
    color: "rgba(255,255,255,0.45)",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 8,
  },

  // Name
  nameSection: {
    marginVertical: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  displayName: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -1,
    color: "#ffffff",
  },

  // World explored
  worldBox: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 6,
  },
  worldBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  worldPct: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  worldBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  worldBadgeText: {
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.7)",
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  statChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  statLabel: {
    fontSize: 6,
    fontWeight: "600",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },

  // Footer
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  footerLeft: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
  },
  footerRight: {
    fontSize: 9,
    color: "rgba(255,255,255,0.45)",
  },
});
