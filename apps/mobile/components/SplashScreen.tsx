import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  opacity: Animated.Value;
};

export default function SplashScreen({ opacity }: Props) {
  const wordmarkY   = useRef(new Animated.Value(28)).current;
  const wordmarkOp  = useRef(new Animated.Value(0)).current;
  const taglineOp   = useRef(new Animated.Value(0)).current;
  const dot1        = useRef(new Animated.Value(0)).current;
  const dot2        = useRef(new Animated.Value(0)).current;
  const dot3        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── Entrance: wordmark springs up, then tagline fades in
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(wordmarkY, {
          toValue: 0,
          tension: 52,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkOp, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(60),
      Animated.timing(taglineOp, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();

    // ── Three-dot stagger loop, starts after entrance settles
    const makeDot = (anim: Animated.Value) =>
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 260, useNativeDriver: true }),
      ]);

    const loop = Animated.loop(
      Animated.stagger(160, [makeDot(dot1), makeDot(dot2), makeDot(dot3)]),
    );
    const t = setTimeout(() => loop.start(), 780);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity }]}>
      <LinearGradient
        colors={["#2a1a58", "#111827", "#0a0f1a"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient glow blobs — match PassportCard aesthetic */}
      <View style={styles.blobGold} />
      <View style={styles.blobCyan} />
      <View style={styles.blobWhite} />

      {/* Wordmark + tagline */}
      <View style={styles.center}>
        <Animated.Text
          style={[
            styles.wordmark,
            { opacity: wordmarkOp, transform: [{ translateY: wordmarkY }] },
          ]}
        >
          explr
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: taglineOp }]}>
          Keep Exploring.
        </Animated.Text>
      </View>

      {/* Three-dot loading indicator */}
      <View style={styles.dotsRow}>
        {([dot1, dot2, dot3] as Animated.Value[]).map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── Glow blobs ─────────────────────────────────────────────────────────────
  blobGold: {
    position: "absolute",
    top: -140,
    right: -140,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(247,207,98,0.14)",
  },
  blobCyan: {
    position: "absolute",
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(114,197,255,0.11)",
  },
  blobWhite: {
    position: "absolute",
    top: "38%",
    left: "20%",
    width: "60%",
    height: 80,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  // ── Content ────────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 48,
  },
  wordmark: {
    fontSize: 56,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -2.5,
  },
  tagline: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.4,
  },

  // ── Dots ───────────────────────────────────────────────────────────────────
  dotsRow: {
    position: "absolute",
    bottom: 68,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
});
