import React, { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";

type Props = {
  /** 0–100 target fill percentage. */
  pct: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  delay?: number;
  style?: ViewStyle;
};

/**
 * A thin progress bar whose fill slides from 0 to `pct` on mount / when pct
 * changes. Width animation can't use the native driver, but these are cheap.
 */
export default function AnimatedBar({
  pct,
  height = 6,
  trackColor = "rgba(255,255,255,0.12)",
  fillColor = "#ffffff",
  delay = 80,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(pct, 100));

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: target,
      duration: 700,
      delay,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [target, delay, progress]);

  const width = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width,
          borderRadius: height / 2,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}
