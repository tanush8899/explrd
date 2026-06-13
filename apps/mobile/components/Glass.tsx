import React from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Text } from "react-native";
import { colors } from "@/lib/theme";

const hasLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

type Scheme = "light" | "dark";

type GlassSurfaceProps = ViewProps & {
  /** Lets the glass respond to touches with the native shimmer (iOS 26+). */
  interactive?: boolean;
  tintColor?: string;
  /** "dark" = floating controls over the globe; "light" = bright UI surfaces. */
  scheme?: Scheme;
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
  scheme = "light",
  ...rest
}: GlassSurfaceProps) {
  if (hasLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor={tintColor}
        colorScheme={scheme}
        style={[styles.glass, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  if (scheme === "dark") {
    return (
      <BlurView intensity={60} tint="dark" style={[styles.fallbackDark, style]} {...rest}>
        <View style={styles.darkSpecular} pointerEvents="none" />
        {children}
      </BlurView>
    );
  }
  return (
    <BlurView intensity={70} tint="light" style={[styles.fallbackLight, style]} {...rest}>
      {children}
    </BlurView>
  );
}

type GlassCircleButtonProps = {
  onPress: () => void;
  size?: number;
  scheme?: Scheme;
  accessibilityLabel?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Circular liquid-glass control button — Flighty's floating globe controls.
 * Wraps a GlassSurface with a centered touch target and a soft floating shadow.
 */
export function GlassCircleButton({
  onPress,
  size = 44,
  scheme = "dark",
  accessibilityLabel,
  children,
  style,
}: GlassCircleButtonProps) {
  const r = size / 2;
  return (
    <View
      style={[
        styles.circleShadow,
        { width: size, height: size, borderRadius: r },
        style,
      ]}
    >
      <GlassSurface
        scheme={scheme}
        interactive
        style={{ width: size, height: size, borderRadius: r }}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.75}
          accessibilityLabel={accessibilityLabel}
          style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
        >
          {children}
        </TouchableOpacity>
      </GlassSurface>
    </View>
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
export function Icon({ name, fallback, size = 20, color = colors.ink, weight = "semibold" }: IconProps) {
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
  fallbackLight: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.75)",
    overflow: "hidden",
  },
  fallbackDark: {
    backgroundColor: "rgba(28,28,30,0.45)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassDarkHairline,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  darkSpecular: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.glassDarkSpecular,
  },
  circleShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
});
