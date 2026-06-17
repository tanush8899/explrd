import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/lib/theme";

// Friend-style fallback palette (mirrors the gradients used across the app).
const AVATAR_GRADIENTS: [string, string][] = [
  ["#f59e0b", "#ef4444"],
  ["#3b82f6", "#8b5cf6"],
  ["#10b981", "#06b6d4"],
  ["#ec4899", "#8b5cf6"],
  ["#6366f1", "#3b82f6"],
  ["#f97316", "#eab308"],
];

/** Deterministic gradient pick from a stable key (user id / name). */
export function gradientFor(key: string): [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

/** Initials from a display name ("Tanush Sanjay" → "TS"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

type Variant = "gold" | "gradient";

type Props = {
  /** Google profile picture, when available. */
  uri?: string | null;
  /** Display name — drives initials and the gradient seed. */
  name?: string | null;
  /** Stable gradient seed (e.g. user id). Falls back to `name`. */
  idKey?: string | null;
  /** Diameter in px. */
  size: number;
  /** Fallback look when there's no picture. */
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Circular avatar. Renders the Google picture when we have one, otherwise the
 * gold (self) or gradient (friends) initials chip the app used before.
 */
export default function Avatar({
  uri,
  name,
  idKey,
  size,
  variant = "gradient",
  style,
  textStyle,
}: Props) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const label = initialsOf(name ?? "");

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[dim, { backgroundColor: colors.fill }, style] as StyleProp<ImageStyle>}
      />
    );
  }

  if (variant === "gold") {
    return (
      <View style={[dim, styles.center, { backgroundColor: colors.gold }, style]}>
        <Text style={[{ fontWeight: "700", color: colors.goldInk }, textStyle]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={gradientFor(idKey || name || "?")}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[dim, styles.center, style]}
    >
      <Text style={[{ fontWeight: "700", color: "#ffffff" }, textStyle]}>
        {label}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
