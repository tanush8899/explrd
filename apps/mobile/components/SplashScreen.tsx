import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import GlobeProgress from "@/components/GlobeProgress";

type Props = {
  opacity: Animated.Value;
};

const ACCENT = "#3b82f6";
const TRACK = 132;
const SEG = 46;

export default function SplashScreen({ opacity }: Props) {
  const riseY = useRef(new Animated.Value(20)).current;
  const markOp = useRef(new Animated.Value(0)).current;
  const taglineOp = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance: globe + wordmark rise and fade in together, then the tagline.
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(riseY, { toValue: 0, tension: 54, friction: 9, useNativeDriver: true }),
        Animated.timing(markOp, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
      Animated.delay(80),
      Animated.timing(taglineOp, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();

    // Sleek indeterminate bar that sweeps left → right on a loop.
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1150,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );
    const t = setTimeout(() => loop.start(), 700);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const segX = slide.interpolate({ inputRange: [0, 1], outputRange: [-SEG, TRACK] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <LinearGradient
        colors={["#1a2238", "#0d1120"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        <Animated.View
          style={{ alignItems: "center", opacity: markOp, transform: [{ translateY: riseY }] }}
        >
          <GlobeProgress percent={0} size={82} strokeColor="rgba(255,255,255,0.92)" strokeWidth={2.4} />
          <View style={styles.gap} />
          <Animated.Text style={styles.wordmark}>explrd</Animated.Text>
        </Animated.View>

        <Animated.Text style={[styles.tagline, { opacity: taglineOp }]}>
          Keep exploring
        </Animated.Text>
      </View>

      {/* Indeterminate loading bar */}
      <View style={styles.loaderTrack}>
        <Animated.View style={[styles.loaderSeg, { transform: [{ translateX: segX }] }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
  gap: { height: 22 },
  wordmark: { fontSize: 46, fontWeight: "700", color: "#ffffff", letterSpacing: -2 },
  tagline: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.3,
  },

  loaderTrack: {
    position: "absolute",
    bottom: 72,
    alignSelf: "center",
    width: TRACK,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  loaderSeg: {
    width: SEG,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ACCENT,
  },
});
