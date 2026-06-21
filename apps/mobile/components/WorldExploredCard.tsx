import React from "react";
import { View, Text, StyleSheet } from "react-native";
import AnimatedBar from "@/components/AnimatedBar";
import GlobeProgress from "@/components/GlobeProgress";

// Finite world totals so each meter can show "X of Y".
const WORLD_COUNTRIES = 195;
const WORLD_CONTINENTS = 7;

type Props = {
  percent: number;
  countries: number;
  continents: number;
  cities: number;
  /** Cities have no world ceiling — this is the rolling personal milestone. */
  cityMilestone: number;
};

/** The dark "World Explored" card: a liquid-fill globe gauge + per-metric
 *  meters. Lives in the My Places tab. */
export default function WorldExploredCard({
  percent,
  countries,
  continents,
  cities,
  cityMilestone,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.topLeft}>
          <Text style={styles.label}>WORLD EXPLORED</Text>
          <View style={styles.pctRow}>
            <Text style={styles.pct}>{percent}%</Text>
            <Text style={styles.pctSuffix}>of the planet</Text>
          </View>
        </View>
        <GlobeProgress percent={percent} size={92} color="#3b82f6" />
      </View>

      <MeterRow label="Countries" value={countries} total={WORLD_COUNTRIES} color="#3b82f6" />
      <MeterRow label="Continents" value={continents} total={WORLD_CONTINENTS} color="#34c759" />
      <MeterRow
        label="Cities"
        caption="personal milestone"
        value={cities}
        total={cityMilestone}
        color="#ff9f0a"
      />
    </View>
  );
}

function MeterRow({
  label,
  caption,
  value,
  total,
  color,
}: {
  label: string;
  caption?: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <View style={styles.meterRow}>
      <View style={styles.meterRowTop}>
        <Text style={styles.meterRowLabel}>
          {label}
          {caption ? <Text style={styles.meterRowCaption}>{`   ${caption}`}</Text> : null}
        </Text>
        <Text style={styles.meterRowValue}>
          {value}
          <Text style={styles.meterRowTotal}> / {total}</Text>
        </Text>
      </View>
      <AnimatedBar pct={pct} height={5} fillColor={color} trackColor="rgba(255,255,255,0.10)" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#141a2c",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  topLeft: { flex: 1 },
  label: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.45)", letterSpacing: 1.4 },
  pctRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 8 },
  pct: { fontSize: 46, fontWeight: "800", color: "#ffffff", letterSpacing: -1.5, lineHeight: 50 },
  pctSuffix: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginLeft: 8,
    marginBottom: 7,
  },
  meterRow: { marginTop: 18 },
  meterRowTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  meterRowLabel: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.92)" },
  meterRowCaption: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.4)" },
  meterRowValue: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  meterRowTotal: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.4)" },
});
