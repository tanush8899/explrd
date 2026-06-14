import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { colors, motion } from "@/lib/theme";

type Props = {
  /** 0–100 */
  progress: number;
  color?: string;
  /** Two-stop gradient fill (overrides `color`). */
  gradient?: [string, string];
  track?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A thin progress track whose fill springs to width on mount / value change —
 * gives stat cards a small bit of life instead of a static bar.
 */
export default function ProgressBar({
  progress,
  color = colors.blue,
  gradient,
  track = colors.line,
  height = 4,
  style,
}: Props) {
  const pct = Math.max(0, Math.min(100, progress));
  const w = useSharedValue(0);

  useEffect(() => {
    w.value = withSpring(pct, motion.gentle);
  }, [pct, w]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: track }, styles.track, style]}>
      <Animated.View style={[styles.fill, { borderRadius: height / 2 }, fillStyle]}>
        {gradient ? (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
  fill: { height: "100%", overflow: "hidden" },
});
