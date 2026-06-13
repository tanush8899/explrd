import React, {
  createContext,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius as r, shadow as sh } from "@/lib/theme";

const { height: SCREEN } = Dimensions.get("window");

// ── Layout constants ──────────────────────────────────────────────────────────
const RADIUS       = r.sheet;                     // iPhone continuous corner curve
const PILL_CONTENT = 64;                          // handle-row(18) + search-row(44) + margin(2)
const MID_H        = Math.round(SCREEN * 0.52);  // state 1
const FULL_H       = Math.round(SCREEN * 0.90);  // state 2
// Horizontal side margins per snap (state 0 / 1 / 2)
// State 2 goes fully edge-to-edge (0).
const SIDES      = [18, 10, 0] as const;
// Gap between sheet bottom and screen bottom in states 0 & 1.
// State 2 drops to 0 so the sheet is fully flush on all four edges.
const BOTTOM_GAP = 12;

// ── Spring — fast and bouncy ──────────────────────────────────────────────────
const SPRING = { tension: 84, friction: 10, useNativeDriver: false } as const;

// ── Context ───────────────────────────────────────────────────────────────────
// Panels use this to hand off a downward-flick at the scroll top to the sheet,
// and to know whether their ScrollView should be enabled.
export const SheetScrollContext = createContext<{
  /** Call when the user ends a downward drag at the very top of a ScrollView */
  onScrollEndDragAtTop: (speed: number) => void;
  /** False in states 0 & 1 so gestures go to the sheet PanResponder */
  scrollEnabled: boolean;
}>({ onScrollEndDragAtTop: () => {}, scrollEnabled: true });

// ── Height ↔ progress helpers (parameterised so they work with dynamic pillH) ─
function p2h(p: number, h0: number, h1: number, h2: number): number {
  if (p <= 1) return h0 + p * (h1 - h0);
  return h1 + (p - 1) * (h2 - h1);
}
function h2p(h: number, h0: number, h1: number, h2: number): number {
  if (h <= h1) return (h - h0) / (h1 - h0);
  return 1 + (h - h1) / (h2 - h1);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type SheetHandle = { snapTo: (i: 0 | 1 | 2) => void };

type Props = {
  children: React.ReactNode;
  title?: string;
  avatarLabel?: string;
  onAvatarPress?: () => void;
  footer?: React.ReactNode;
  searchPlaceholder?: string;
  onSearchPillPress?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  initialIndex?: 0 | 1 | 2;
  /** Override the state-1 height (defaults to 52 % of screen). */
  midHeight?: number;
  /** Called whenever the sheet settles at a new snap index. */
  onSnap?: (i: 0 | 1 | 2) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────
const Sheet = forwardRef<SheetHandle, Props>(function Sheet(
  {
    children,
    title,
    avatarLabel,
    onAvatarPress,
    footer,
    searchPlaceholder = "Search for a place…",
    onSearchPillPress,
    showCloseButton = false,
    onClose,
    initialIndex = 1,
    midHeight,
    onSnap,
  },
  ref,
) {
  const insets = useSafeAreaInsets();

  // ── Dynamic heights ────────────────────────────────────────────────────────
  // safeInset is the portion of the home-indicator zone that still sits
  // *inside* the sheet (the BOTTOM_GAP lifts the sheet so some of the
  // inset is already cleared outside).
  const safeInset = Math.max(0, insets.bottom - BOTTOM_GAP);
  // PILL_H ensures the search row clears the home indicator.
  const PILL_H = PILL_CONTENT + safeInset;
  // Heights ref kept current so PanResponder callbacks (created once) always
  // work with the right values.
  const effectiveMid = midHeight ?? MID_H;
  const heights = [PILL_H, effectiveMid, FULL_H] as const;
  const hRef    = useRef(heights);
  hRef.current  = heights;

  // ── State ──────────────────────────────────────────────────────────────────
  const snapIdx         = useRef<0 | 1 | 2>(initialIndex);
  const [snap, setSnap] = useState<0 | 1 | 2>(initialIndex);

  // Single animated progress value: 0 = pill, 1 = mid, 2 = full
  const progress      = useRef(new Animated.Value(initialIndex)).current;
  const progressRef   = useRef<number>(initialIndex);
  const gestureStartH = useRef<number>(heights[initialIndex]);

  // ── Interpolated visuals ───────────────────────────────────────────────────
  // Height uses dynamic PILL_H; re-interpolates on each render (fine for Animated.View)
  const animHeight = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [PILL_H, effectiveMid, FULL_H],
    extrapolate: "clamp",
  });
  const animSide = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: SIDES as unknown as number[],
    extrapolate: "clamp",
  });
  // Bottom gap: float in states 0 & 1, flush in state 2
  const animBottom = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [BOTTOM_GAP, BOTTOM_GAP, 0],
    extrapolate: "clamp",
  });
  // Footer padding: complement of animBottom so home indicator is always cleared
  // and the nav pill rides smoothly — no snap-based discrete jumps.
  const animFooterPad = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [safeInset, safeInset, insets.bottom],
    extrapolate: "clamp",
  });
  // Cross-fade: pill out 0→0.3, full content in 0→0.45
  const pillOpacity = progress.interpolate({
    inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: "clamp",
  });
  const fullOpacity = progress.interpolate({
    inputRange: [0, 0.45], outputRange: [0, 1], extrapolate: "clamp",
  });
  // handleArea (top of card) fades in as sheet leaves state 0 —
  // in state 0 the handle lives inside the pill container instead.
  const handleOpacity = progress.interpolate({
    inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: "clamp",
  });

  // Keep progressRef current so gesture start positions are always accurate
  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressRef.current = value; });
    return () => progress.removeListener(id);
  }, [progress]);

  // ── Snap ──────────────────────────────────────────────────────────────────
  function snapTo(i: 0 | 1 | 2) {
    onSnap?.(i);
    const prev = snapIdx.current;
    snapIdx.current = i;
    if (i > prev) setSnap(i);                      // UP: show content immediately
    Animated.spring(progress, { toValue: i, ...SPRING }).start(({ finished }) => {
      if (finished && i < prev) setSnap(i);         // DOWN: wait for settle
    });
  }

  useImperativeHandle(ref, () => ({ snapTo }));

  // ── PanResponder ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        // Interrupt any running spring and lock in exact visual height
        progress.stopAnimation();
        const [h0, h1, h2] = hRef.current;
        gestureStartH.current = p2h(progressRef.current, h0, h1, h2);
      },
      onPanResponderMove: (_, g) => {
        const [h0, h1, h2] = hRef.current;
        const nextH = gestureStartH.current - g.dy;
        let p = h2p(nextH, h0, h1, h2);
        if (p < 0) p = p * 0.18;
        if (p > 2) p = 2 + (p - 2) * 0.18;
        progress.setValue(p);
      },
      onPanResponderRelease: (_, g) => {
        const [h0, h1, h2] = hRef.current;
        // Current drag position as a progress value
        const currentH = gestureStartH.current - g.dy;
        const currentP = h2p(currentH, h0, h1, h2);
        const current  = snapIdx.current;

        // Thresholds
        const VEL_FLICK = 0.4;  // min |vy| to treat as a directional flick
        const VEL_JUMP  = 2.8;  // |vy| required to skip an entire state

        let target: 0 | 1 | 2;

        if (Math.abs(g.vy) >= VEL_FLICK) {
          if (g.vy > 0) {
            // Downward flick — collapse one state; skip only on very hard fling
            const step = (g.vy >= VEL_JUMP && current === 2) ? 2 : 1;
            target = Math.max(0, current - step) as 0 | 1 | 2;
          } else {
            // Upward flick — always expand exactly one state at a time
            target = Math.min(2, current + 1) as 0 | 1 | 2;
          }
        } else {
          // Slow drag — snap to whichever state the finger is nearest to
          target = ([0, 1, 2] as const).reduce<0 | 1 | 2>(
            (best, i) => Math.abs(i - currentP) < Math.abs(best - currentP) ? i : best,
            current,
          );
        }

        snapTo(target);
      },
    }),
  ).current;

  // ── Scroll context ────────────────────────────────────────────────────────
  // Memoised on snap so scrollEnabled re-renders consumers when state changes.
  const ctxValue = useMemo(() => ({
    onScrollEndDragAtTop: (_speed: number) => {
      // Always step down exactly one state (2→1, 1→0).
      const i = snapIdx.current;
      if (i > 0) snapTo((i - 1) as 0 | 1);
    },
    // Only allow scrolling when the sheet is fully open.
    scrollEnabled: snap === 2,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [snap]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SheetScrollContext.Provider value={ctxValue}>
      {/*
       * animBottom: BOTTOM_GAP in states 0 & 1 (sheet floats above screen edge),
       * 0 in state 2 (fully flush — no gap on left, right, or bottom).
       * animSide: mirrors this, going to 0 in state 2.
       * Footer paddingBottom = insets.bottom so the home indicator is always cleared.
       */}
      <Animated.View
        style={[
          styles.shadow,
          {
            bottom:       animBottom,
            left:         animSide,
            right:        animSide,
            height:       animHeight,
            borderRadius: RADIUS,
          },
        ]}
      >
        <View style={[styles.card, { borderRadius: RADIUS }]}>

          {/* ── Handle ────────────────────────────────────────────────────── */}
          <Animated.View
            style={[styles.handleArea, { opacity: handleOpacity }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.handlePill} />
          </Animated.View>

          {/* ── State 0: Bordered search pill ────────────────────────────── */}
          {/* Single bordered container: handle at top, search row below.
              panHandlers on the outer view; taps pass to inner Touchable. */}
          {/* Outer wrapper: absolute, flex-column so handle sits above border */}
          <Animated.View
            style={[styles.pillWrapper, { opacity: pillOpacity }]}
            pointerEvents={snap === 0 ? "auto" : "none"}
            {...panResponder.panHandlers}
          >
            {/* Pull tab — above the grey border */}
            <View style={styles.pillHandleRow}>
              <View style={styles.handlePill} />
            </View>

            {/* Bordered search bar */}
            <View style={styles.pillContainer}>
              <TouchableOpacity
                style={styles.pillSearchRow}
                onPress={onSearchPillPress}
                activeOpacity={0.88}
              >
                <Ionicons name="search" size={18} color="#8e8e93" />
                <Text style={styles.pillHint} numberOfLines={1}>
                  {searchPlaceholder}
                </Text>
                {avatarLabel != null && (
                  <>
                    <TouchableOpacity
                      onPress={onAvatarPress}
                      style={styles.pillAvatar}
                      hitSlop={8}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pillAvatarText}>{avatarLabel}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── States 1 & 2: Full content ───────────────────────────────── */}
          {snap >= 1 && (
            <Animated.View style={[styles.fullContent, { opacity: fullOpacity }]}>

              {showCloseButton ? (
                <View style={styles.searchHeader} {...panResponder.panHandlers}>
                  <Text style={styles.searchHeaderTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.cancelBtn}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <View style={styles.cancelCircle}>
                      <Text style={styles.cancelX}>✕</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : title != null ? (
                <View style={styles.header} {...panResponder.panHandlers}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                  {avatarLabel != null && (
                    <TouchableOpacity
                      onPress={onAvatarPress}
                      style={styles.avatar}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.avatarText}>{avatarLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              <View style={styles.content}>
                {children}
              </View>

              {footer != null && (
                <Animated.View style={[styles.footer, { paddingBottom: animFooterPad }]}>
                  {footer}
                </Animated.View>
              )}

            </Animated.View>
          )}

        </View>
      </Animated.View>
    </SheetScrollContext.Provider>
  );
});

export default Sheet;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    ...sh.sheet,
  },
  card: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  handleArea: {
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  handlePill: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#d1d1d6",
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 10,
    minHeight: 44,
  },
  searchHeaderTitle: {
    flex: 1,
    fontSize: 26,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  cancelBtn: {
    padding: 4,
  },
  cancelCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelX: {
    fontSize: 13,
    color: colors.inkSecondary,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 1,
  },
  // ── Pill (state 0) ──────────────────────────────────────────────────────────
  // Outer wrapper: absolutely positioned, flex-column
  pillWrapper: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
  },
  // Handle row sits above the border — not inside it
  pillHandleRow: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 6,
  },
  pillContainer: {
    borderRadius: 28,
    backgroundColor: colors.fillSecondary,
  },
  pillSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,         // equal left & right
    paddingVertical: 12,           // equal top & bottom → vertically centred
    gap: 10,
  },
  pillHint: {
    flex: 1,
    fontSize: 17,
    color: colors.muted,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  // Gold avatar chip — Flighty's "TS" pill
  pillAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,              // self-contained circle, no parent clipping needed
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  pillAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.goldInk,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.goldInk,
  },
  fullContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    flex: 1,
    fontSize: 34,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.9,
    marginRight: 12,
  },
  content: {
    flex: 1,
    overflow: "hidden",
  },
  footer: {},
});
