import React, { useState } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, motion } from "@/lib/theme";
import { tap } from "@/lib/haptics";

export type Segment<T extends string> = { key: T; label: string };

type Props<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Sliding-thumb segmented control (Flighty's "All-Time / 2026"): a grey track
 * with a white thumb that springs between equal-width segments on the UI thread.
 */
export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  style,
}: Props<T>) {
  const [trackW, setTrackW] = useState(0);
  const activeIndex = Math.max(0, segments.findIndex((s) => s.key === value));
  const x = useSharedValue(0);

  const pad = 3;
  const segW = trackW > 0 ? (trackW - pad * 2) / segments.length : 0;

  React.useEffect(() => {
    if (segW > 0) x.value = withSpring(activeIndex * segW, motion.gentle);
  }, [activeIndex, segW, x]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View style={[styles.track, style]} onLayout={onLayout}>
      {segW > 0 && (
        <Animated.View
          style={[styles.thumb, { width: segW, left: pad, top: pad, bottom: pad }, thumbStyle]}
        />
      )}
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <TouchableOpacity
            key={s.key}
            style={styles.segment}
            activeOpacity={0.7}
            onPress={() => {
              if (s.key === value) return;
              tap();
              onChange(s.key);
            }}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {s.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.fill,
    borderRadius: 999,
    padding: 3,
    alignSelf: "flex-start",
  },
  thumb: {
    position: "absolute",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segment: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.muted, letterSpacing: -0.2 },
  labelActive: { color: colors.ink },
});
