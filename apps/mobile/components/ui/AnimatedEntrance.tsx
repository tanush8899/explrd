import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { motion } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  /** Position in a list — drives the stagger delay. */
  index?: number;
  /** Extra delay on top of the staggered amount (ms). */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Fades + lifts content in on mount, staggered by index, so cards and rows
 * arrive with a little life instead of popping. Pure presentational wrapper.
 */
export default function AnimatedEntrance({ children, index = 0, delay = 0, style }: Props) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.duration(motion.enter.duration)
        .delay(delay + index * motion.stagger)
        .springify()
        .damping(18)}
    >
      {children}
    </Animated.View>
  );
}
