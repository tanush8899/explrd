import React from "react";
import { Platform, StyleSheet, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Text } from "react-native";

const hasLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

type GlassSurfaceProps = ViewProps & {
  /** Lets the glass respond to touches with the native shimmer (iOS 26+). */
  interactive?: boolean;
  tintColor?: string;
};

/**
 * Liquid-glass surface: real UIGlassEffect on iOS 26+, frosted blur with a
 * hairline highlight everywhere else. Pass borderRadius via `style`.
 */
export function GlassSurface({
  style,
  children,
  interactive,
  tintColor,
  ...rest
}: GlassSurfaceProps) {
  if (hasLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor={tintColor}
        colorScheme="light"
        style={[styles.glass, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView intensity={70} tint="light" style={[styles.fallback, style]} {...rest}>
      {children}
    </BlurView>
  );
}

type IconProps = {
  name: SFSymbol;
  /** Plain-text stand-in for Android / web where SF Symbols don't exist. */
  fallback: string;
  size?: number;
  color?: string;
  weight?: "regular" | "medium" | "semibold" | "bold";
};

/** SF Symbol on iOS, text glyph elsewhere. */
export function Icon({ name, fallback, size = 20, color = "#111214", weight = "semibold" }: IconProps) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={name}
        size={size}
        tintColor={color}
        weight={weight}
        resizeMode="scaleAspectFit"
      />
    );
  }
  return <Text style={{ fontSize: size * 0.9, color }}>{fallback}</Text>;
}

const styles = StyleSheet.create({
  glass: {
    overflow: "hidden",
  },
  fallback: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.75)",
    overflow: "hidden",
  },
});
