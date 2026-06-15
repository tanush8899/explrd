import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";

type Props = {
  value: React.ReactNode;
  label: string;
  /** "light" sits on a white card; "dark" sits inside a gradient hero. */
  tone?: "light" | "dark";
  sub?: string;
  style?: StyleProp<ViewStyle>;
};

/** A single value + uppercase label cell. Used in stat grids on cards & heroes. */
export default function StatTile({ value, label, tone = "light", sub, style }: Props) {
  const dark = tone === "dark";
  return (
    <View style={[styles.tile, dark ? styles.tileDark : styles.tileLight, style]}>
      <Text style={[styles.value, dark && styles.valueDark]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
      {sub ? <Text style={[styles.sub, dark && styles.subDark]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLight: { backgroundColor: colors.fill },
  tileDark: { backgroundColor: "rgba(255,255,255,0.08)" },
  value: { fontSize: 20, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  valueDark: { color: "#ffffff" },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 3,
  },
  labelDark: { color: "rgba(255,255,255,0.6)" },
  sub: { fontSize: 10, color: colors.faint, marginTop: 2 },
  subDark: { color: "rgba(255,255,255,0.45)" },
});
