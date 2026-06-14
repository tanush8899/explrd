import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color?: string;
  /** Background tint; defaults to a 12% wash of `color`. */
  bg?: string;
  size?: number;
  diameter?: number;
  style?: StyleProp<ViewStyle>;
};

/** Tinted round icon background — the small colored well used across cards. */
export default function IconWell({
  name,
  color = "#007aff",
  bg,
  size,
  diameter = 38,
  style,
}: Props) {
  const wash = bg ?? withAlpha(color, 0.12);
  return (
    <View
      style={[
        styles.well,
        { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: wash },
        style,
      ]}
    >
      <Ionicons name={name} size={size ?? Math.round(diameter * 0.5)} color={color} />
    </View>
  );
}

/** Accepts #rrggbb and returns an rgba() with the given alpha. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  well: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
