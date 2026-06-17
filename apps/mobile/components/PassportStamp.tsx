import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SavedPlace } from "@explrd/shared";
import { gradients } from "@/lib/theme";

type Props = {
  place: SavedPlace;
  onDismiss: () => void;
};

const HOLD_MS   = 750;
const FADE_MS   = 280;
const TOTAL_MS  = HOLD_MS + FADE_MS;

export default function PassportStamp({ place, onDismiss }: Props) {
  // ── Animated values ──────────────────────────────────────────────────────────
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const cardScale       = useRef(new Animated.Value(1.35)).current;
  const cardY           = useRef(new Animated.Value(-24)).current;
  const contentOpacity  = useRef(new Animated.Value(0)).current;
  const rippleScale     = useRef(new Animated.Value(0.3)).current;
  const rippleOpacity   = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // ── Entrance ────────────────────────────────────────────────────────────
    Animated.parallel([
      // Overlay fades in
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      // Card springs down and presses like a rubber stamp
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(cardY, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // ── Content fades in once card has settled ───────────────────────────
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();

      // ── Ripple expands from the checkmark ────────────────────────────────
      Animated.parallel([
        Animated.timing(rippleScale, {
          toValue: 3.2,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // ── Auto-dismiss ────────────────────────────────────────────────────────
    const id = setTimeout(() => {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1.08,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: FADE_MS * 0.7,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, HOLD_MS);

    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const placeName =
    place.name ??
    place.city ??
    place.formatted?.split(",")[0]?.trim() ??
    "New Territory";

  const placeDetail =
    [place.city, place.country].filter(Boolean).join(", ") ||
    place.formatted?.split(",").slice(1).join(",").trim() ||
    null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}>
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: cardScale }, { translateY: cardY }] },
        ]}
      >
        <LinearGradient
          colors={gradients.passport}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.gradient}
        >
          {/* Ambient blobs */}
          <View style={styles.blobGold} />
          <View style={styles.blobCyan} />

          {/* Dashed stamp border */}
          <View style={styles.stampBorder} />

          {/* Checkmark + ripple */}
          <View style={styles.checkRow}>
            <Animated.View
              style={[
                styles.ripple,
                { transform: [{ scale: rippleScale }], opacity: rippleOpacity },
              ]}
            />
            <Animated.Text style={[styles.check, { opacity: contentOpacity }]}>
              ✓
            </Animated.Text>
          </View>

          {/* Labels */}
          <Animated.View style={[styles.labels, { opacity: contentOpacity }]}>
            <Text style={styles.eyebrow}>NEW TERRITORY</Text>
            <Text style={styles.placeName} numberOfLines={2}>
              {placeName}
            </Text>
            {placeDetail ? (
              <Text style={styles.placeDetail} numberOfLines={1}>
                {placeDetail}
              </Text>
            ) : null}
            <View style={styles.divider} />
            <Text style={styles.tagline}>Stamped to your passport</Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,15,26,0.72)",
  },
  card: {
    width: 300,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 24,
  },
  gradient: {
    padding: 32,
    alignItems: "center",
    overflow: "hidden",
  },

  // Ambient blobs
  blobGold: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(247,207,98,0.20)",
  },
  blobCyan: {
    position: "absolute",
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(114,197,255,0.15)",
  },

  // Dashed stamp border — four edges as thin lines
  stampBorder: {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    borderStyle: "dashed",
  },

  // Checkmark
  checkRow: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  ripple: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(247,207,98,0.35)",
  },
  check: {
    fontSize: 36,
    color: "#f7cf62",
    fontWeight: "700",
    lineHeight: 44,
  },

  // Text
  labels: {
    alignItems: "center",
    width: "100%",
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  placeName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.8,
    textAlign: "center",
    lineHeight: 32,
  },
  placeDetail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: 5,
    textAlign: "center",
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 14,
  },
  tagline: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.45)",
  },
});
