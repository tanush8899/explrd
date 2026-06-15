import React from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";
import { tap } from "@/lib/haptics";

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Optional leading element (avatar / dot). */
  leading?: React.ReactNode;
};

/** A single pill in a filter row — Flighty's segmented chips. */
export default function Chip({ label, active, onPress, leading }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.8}
      onPress={() => {
        tap();
        onPress?.();
      }}
    >
      {leading}
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.fill,
  },
  chipActive: { backgroundColor: colors.ink },
  text: { fontSize: 14, fontWeight: "600", color: colors.inkSecondary, letterSpacing: -0.2 },
  textActive: { color: "#ffffff" },
});
