import React, {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius as r, shadow as sh } from "@/lib/theme";

const { height: SCREEN } = Dimensions.get("window");

// ── Layout constants ──────────────────────────────────────────────────────────
const RADIUS       = r.sheet;                    // iPhone continuous corner curve
const PILL_CONTENT = 64;                         // handle-row(18) + search-row(44) + margin(2)
const MID_H        = Math.round(SCREEN * 0.52);  // state 1
const FULL_H       = Math.round(SCREEN * 0.90);  // state 2
// Horizontal side margins per snap (state 0 / 1 / 2). State 2 is edge-to-edge.
const SIDES      = [18, 10, 0] as const;
// Gap between sheet bottom and screen bottom in states 0 & 1 (flush in state 2).
const BOTTOM_GAP = 12;

// ── Motion ────────────────────────────────────────────────────────────────────
// One spring for every transition, gesture-driven or programmatic. Tuned to the
// iOS / Flighty feel: quick to settle with the faintest overshoot. All animation
// runs on the UI thread (reanimated), so it never drops frames under JS load.
const SPRING = {
  damping: 22,
  stiffness: 240,
  mass: 0.9,
  restDisplacementThreshold: 0.4,
  restSpeedThreshold: 2,
} as const;

// How far (in px of height) a release velocity is projected forward to pick the
// landing snap. Larger → flicks travel further / skip states more eagerly.
const PROJECTION = 0.1;
// Resistance applied when dragging past the top or bottom snap (rubber-banding).
const RUBBER = 0.18;

// ── Context ───────────────────────────────────────────────────────────────────
// Panels use this to hand off a downward-flick at the scroll top to the sheet,
// and to know whether their ScrollView should be enabled.
export const SheetScrollContext = createContext<{
  /** Call when the user ends a downward drag at the very top of a ScrollView */
  onScrollEndDragAtTop: (speed: number) => void;
  /** False in states 0 & 1 so gestures move the sheet instead of scrolling */
  scrollEnabled: boolean;
}>({ onScrollEndDragAtTop: () => {}, scrollEnabled: true });

// ── Types ─────────────────────────────────────────────────────────────────────
export type SheetHandle = { snapTo: (i: 0 | 1 | 2) => void };

export type AvatarAnchor = { x: number; y: number; width: number; height: number };

type Props = {
  children: React.ReactNode;
  title?: string;
  avatarLabel?: string;
  onAvatarPress?: (anchor: AvatarAnchor) => void;
  footer?: React.ReactNode;
  searchPlaceholder?: string;
  onSearchPillPress?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  initialIndex?: 0 | 1 | 2;
  /** Override the state-1 height (defaults to 52 % of screen). */
  midHeight?: number;
  /** Called whenever the sheet begins settling at a new snap index. */
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

  // ── Avatar anchoring ─────────────────────────────────────────────────────────
  // The dropdown menu springs from the avatar, so we measure it on press and
  // hand the window-space rect up to the screen.
  const headerAvatarRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const pillAvatarRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const emitAvatarPress = useCallback(
    (node: React.ComponentRef<typeof TouchableOpacity> | null) => {
      if (!onAvatarPress || !node) return;
      node.measureInWindow((x, y, width, height) => {
        onAvatarPress({ x, y, width, height });
      });
    },
    [onAvatarPress],
  );

  // ── Dynamic snap heights ─────────────────────────────────────────────────────
  // safeInset is the portion of the home-indicator zone still inside the sheet
  // (BOTTOM_GAP already lifts the sheet clear of part of it).
  const safeInset = Math.max(0, insets.bottom - BOTTOM_GAP);
  const PILL_H = PILL_CONTENT + safeInset;          // search row clears home indicator
  const effectiveMid = midHeight ?? MID_H;
  const heights = useMemo<[number, number, number]>(
    () => [PILL_H, effectiveMid, FULL_H],
    [PILL_H, effectiveMid],
  );
  // Always-current copy for the imperative snapTo (which has a stable identity).
  const heightsRef = useRef(heights);
  heightsRef.current = heights;

  // Bottom padding for the scroll content so its last items clear the floating
  // footer (the glass nav pill). ~60px nav row + the home-indicator inset.
  const contentPadBottom = footer != null ? 60 + insets.bottom : 0;

  // ── Shared values (UI thread source of truth) ───────────────────────────────
  const height      = useSharedValue(heights[initialIndex]); // live sheet height (px)
  const startHeight = useSharedValue(heights[initialIndex]); // height at gesture start
  const snaps       = useSharedValue<[number, number, number]>(heights);
  const snapIndex   = useSharedValue<number>(initialIndex);

  // ── JS-side snap bookkeeping ─────────────────────────────────────────────────
  const snapIdxJS         = useRef<0 | 1 | 2>(initialIndex);
  const [snap, setSnap]   = useState<0 | 1 | 2>(initialIndex);
  const onSnapRef         = useRef(onSnap);
  onSnapRef.current       = onSnap;

  // Fires the moment a snap is committed (gesture release or imperative call).
  // UP transitions reveal content immediately; DOWN waits for the settle.
  const commitSnap = useCallback((i: 0 | 1 | 2) => {
    onSnapRef.current?.(i);
    const prev = snapIdxJS.current;
    snapIdxJS.current = i;
    if (i >= prev) setSnap(i);
  }, []);

  // Fires when the spring finishes — collapses content for DOWN transitions.
  const settleSnap = useCallback((i: 0 | 1 | 2) => {
    snapIdxJS.current = i;
    setSnap(i);
  }, []);

  // ── Keep snap heights in sync, re-pinning the sheet when they change ─────────
  const didMount = useRef(false);
  useEffect(() => {
    snaps.value = heights;
    if (!didMount.current) {
      didMount.current = true;
      height.value = heights[snapIdxJS.current];
      return;
    }
    // e.g. midHeight changes while open → glide to the new height for this snap.
    height.value = withSpring(heights[snapIdxJS.current], SPRING);
  }, [heights, snaps, height]);

  // ── Programmatic snap (imperative handle + internal use) ─────────────────────
  const snapTo = useCallback(
    (i: 0 | 1 | 2) => {
      commitSnap(i);
      snapIndex.value = i;
      cancelAnimation(height);
      height.value = withSpring(heightsRef.current[i], SPRING, (finished) => {
        if (finished) runOnJS(settleSnap)(i);
      });
    },
    [commitSnap, settleSnap, height, snapIndex],
  );

  useImperativeHandle(ref, () => ({ snapTo }), [snapTo]);

  // ── Pan gesture (shared by every drag zone) ──────────────────────────────────
  // `enabled` is gated so that at full height the content ScrollView takes over;
  // otherwise dragging anywhere on the sheet moves it. Rebuilt only when that
  // gate flips — the worklets read shared values, so they never go stale.
  const dragEnabled = snap !== 2;
  const makePan = useCallback(
    (enabled: boolean) =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY([-10, 10]) // let taps through; only claim real drags
        .failOffsetX([-24, 24])   // yield to horizontal gestures
        .onStart(() => {
          cancelAnimation(height);
          startHeight.value = height.value;
        })
        .onUpdate((e) => {
          const s = snaps.value;
          const min = s[0];
          const max = s[2];
          let h = startHeight.value - e.translationY;
          if (h > max) h = max + (h - max) * RUBBER;       // rubber-band past full
          else if (h < min) h = min + (h - min) * RUBBER;  // rubber-band past pill
          height.value = h;
        })
        .onEnd((e) => {
          const s = snaps.value;
          // Project where the throw would land, then snap to the nearest stop.
          const projected = height.value - e.velocityY * PROJECTION;
          let idx = 0;
          let best = Math.abs(projected - s[0]);
          for (let i = 1; i < 3; i++) {
            const d = Math.abs(projected - s[i]);
            if (d < best) {
              best = d;
              idx = i;
            }
          }
          snapIndex.value = idx;
          runOnJS(commitSnap)(idx as 0 | 1 | 2);
          height.value = withSpring(
            s[idx],
            { ...SPRING, velocity: -e.velocityY },
            (finished) => {
              if (finished) runOnJS(settleSnap)(idx as 0 | 1 | 2);
            },
          );
        }),
    [height, startHeight, snaps, snapIndex, commitSnap, settleSnap],
  );

  // The grab/pill zones never scroll, so their pan is always live. The content
  // zone's pan switches off at full height to free the ScrollView.
  const grabPan    = useMemo(() => makePan(true), [makePan]);
  const pillPan     = useMemo(() => makePan(true), [makePan]);
  const contentPan = useMemo(() => makePan(dragEnabled), [makePan, dragEnabled]);

  // ── Derived progress (0 = pill, 1 = mid, 2 = full) for visual interpolation ──
  const progress = useDerivedValue(() => {
    const s = snaps.value;
    return interpolate(height.value, s, [0, 1, 2], Extrapolation.CLAMP);
  });

  // ── Animated styles ──────────────────────────────────────────────────────────
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const side = interpolate(p, [0, 1, 2], SIDES as unknown as number[], Extrapolation.CLAMP);
    return {
      height: height.value,
      left: side,
      right: side,
      bottom: interpolate(p, [0, 1, 2], [BOTTOM_GAP, BOTTOM_GAP, 0], Extrapolation.CLAMP),
    };
  });
  const handleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [0, 1], Extrapolation.CLAMP),
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
  }));
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.45], [0, 1], Extrapolation.CLAMP),
  }));
  const footerStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      progress.value,
      [0, 1, 2],
      [safeInset, safeInset, insets.bottom],
      Extrapolation.CLAMP,
    ),
  }));

  // ── Scroll context ────────────────────────────────────────────────────────────
  const ctxValue = useMemo(
    () => ({
      // A downward drag at the very top of a list steps the sheet down one stop.
      onScrollEndDragAtTop: () => {
        const i = snapIdxJS.current;
        if (i > 0) snapTo((i - 1) as 0 | 1);
      },
      // Lists only scroll once the sheet is fully open.
      scrollEnabled: snap === 2,
    }),
    [snap, snapTo],
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SheetScrollContext.Provider value={ctxValue}>
      <Animated.View
        style={[styles.shadow, { borderRadius: RADIUS }, cardStyle]}
      >
        <View style={[styles.card, { borderRadius: RADIUS }]}>

          {/*
           * Rigid body — fixed at FULL_H and pinned to the top. Because its size
           * never changes, its children never re-layout while the card height
           * springs; the card just clips more or less of it (overflow: hidden).
           * This is what kills the content jitter: nothing inside reflows.
           */}
          <View style={styles.body} pointerEvents={snap >= 1 ? "auto" : "none"}>

            {/* Grab zone: handle + header (always draggable) */}
            <GestureDetector gesture={grabPan}>
              <View>
                <Animated.View style={[styles.handleArea, handleStyle]}>
                  <View style={styles.handlePill} />
                </Animated.View>

                {snap >= 1 && (
                  <Animated.View style={fullStyle}>
                    {showCloseButton ? (
                      <View style={styles.searchHeader}>
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
                      <View style={styles.header}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        {avatarLabel != null && (
                          <TouchableOpacity
                            ref={headerAvatarRef}
                            onPress={() => emitAvatarPress(headerAvatarRef.current)}
                            style={styles.avatar}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.avatarText}>{avatarLabel}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : null}
                  </Animated.View>
                )}
              </View>
            </GestureDetector>

            {/* Content (drag when not full, scroll when full) */}
            {snap >= 1 && (
              <GestureDetector gesture={contentPan}>
                <Animated.View
                  style={[styles.content, { paddingBottom: contentPadBottom }, fullStyle]}
                >
                  {children}
                </Animated.View>
              </GestureDetector>
            )}
          </View>

          {/* Footer — the glass nav pill, floating over the animated bottom edge */}
          {snap >= 1 && footer != null && (
            <Animated.View style={[styles.footer, footerStyle]}>
              {footer}
            </Animated.View>
          )}

          {/* ── State 0: bordered search pill overlay ──────────────────────── */}
          <GestureDetector gesture={pillPan}>
            <Animated.View
              style={[styles.pillWrapper, pillStyle]}
              pointerEvents={snap === 0 ? "auto" : "none"}
            >
              <View style={styles.pillHandleRow}>
                <View style={styles.handlePill} />
              </View>

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
                    <TouchableOpacity
                      ref={pillAvatarRef}
                      onPress={() => emitAvatarPress(pillAvatarRef.current)}
                      style={styles.pillAvatar}
                      hitSlop={8}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pillAvatarText}>{avatarLabel}</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </GestureDetector>

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
  // Rigid full-height body, pinned to the top and clipped by the card.
  body: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: FULL_H,
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
  pillWrapper: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
  },
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  pillHint: {
    flex: 1,
    fontSize: 17,
    color: colors.muted,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  pillAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  // Floats over the bottom of the content, riding the card's animated edge.
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
