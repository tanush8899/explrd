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
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius as r, shadow as sh, motion } from "@/lib/theme";
import { tap } from "@/lib/haptics";

const { height: SCREEN } = Dimensions.get("window");

// ── Layout constants ──────────────────────────────────────────────────────────
const RADIUS       = r.sheet;                    // iPhone continuous corner curve
const PILL_CONTENT = 64;                          // handle-row(18) + search-row(44) + margin(2)
const MID_H        = Math.round(SCREEN * 0.52);  // state 1
const FULL_H       = Math.round(SCREEN * 0.90);  // state 2
const SIDES        = [18, 10, 0] as const;       // horizontal margin per state
const BOTTOM_GAP   = 12;                          // float gap in states 0 & 1

// ── Context ───────────────────────────────────────────────────────────────────
// Panels hand off a downward-flick at the scroll top to the sheet, and read
// whether their ScrollView should scroll (only when fully open).
export const SheetScrollContext = createContext<{
  onScrollEndDragAtTop: (speed: number) => void;
  scrollEnabled: boolean;
}>({ onScrollEndDragAtTop: () => {}, scrollEnabled: true });

// ── Height ↔ progress worklet helpers ─────────────────────────────────────────
// p: 0 = pill, 1 = mid, 2 = full. h: [pill, mid, full] heights.
function progressToHeight(p: number, h: readonly number[]): number {
  "worklet";
  if (p <= 1) return h[0] + p * (h[1] - h[0]);
  return h[1] + (p - 1) * (h[2] - h[1]);
}
function heightToProgress(v: number, h: readonly number[]): number {
  "worklet";
  if (v <= h[1]) return (v - h[0]) / (h[1] - h[0]);
  return 1 + (v - h[1]) / (h[2] - h[1]);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type SheetHandle = { snapTo: (i: 0 | 1 | 2) => void };

type Props = {
  children: React.ReactNode;
  title?: string;
  avatarLabel?: string;
  onAvatarPress?: () => void;
  /** Optional share affordance shown left of the avatar (Flighty header row). */
  onSharePress?: () => void;
  footer?: React.ReactNode;
  searchPlaceholder?: string;
  onSearchPillPress?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  initialIndex?: 0 | 1 | 2;
  midHeight?: number;
  onSnap?: (i: 0 | 1 | 2) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────
const Sheet = forwardRef<SheetHandle, Props>(function Sheet(
  {
    children,
    title,
    avatarLabel,
    onAvatarPress,
    onSharePress,
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

  // Portion of the home-indicator zone still inside the floating sheet.
  const safeInset    = Math.max(0, insets.bottom - BOTTOM_GAP);
  const PILL_H       = PILL_CONTENT + safeInset;
  const effectiveMid = midHeight ?? MID_H;

  // ── Animation state (UI thread) ─────────────────────────────────────────────
  const progress = useSharedValue<number>(initialIndex);  // 0 → 2, continuous
  const startH   = useSharedValue<number>(0);             // height captured at gesture start
  const heights  = useSharedValue<number[]>([PILL_H, effectiveMid, FULL_H]);
  const snapSV   = useSharedValue<number>(initialIndex);

  // ── React state — gates conditional rendering + scroll context ──────────────
  const [snap, setSnap] = useState<0 | 1 | 2>(initialIndex);
  const snapIdx = useRef<0 | 1 | 2>(initialIndex);

  // Keep height shared value current as insets / midHeight change.
  useEffect(() => {
    heights.value = [PILL_H, effectiveMid, FULL_H];
  }, [PILL_H, effectiveMid, heights]);

  // ── Snap ────────────────────────────────────────────────────────────────────
  const settle = useCallback((target: 0 | 1 | 2, prev: 0 | 1 | 2, finished: boolean) => {
    if (!finished) return;
    if (target < prev) setSnap(target);  // collapsing — swap content only once settled
    tap();
  }, []);

  const snapTo = useCallback(
    (i: 0 | 1 | 2) => {
      onSnap?.(i);
      const prev = snapIdx.current;
      snapIdx.current = i;
      snapSV.value = i;
      if (i > prev) setSnap(i);          // expanding — show content immediately
      progress.value = withSpring(i, motion.sheet, (finished) => {
        "worklet";
        runOnJS(settle)(i, prev, !!finished);
      });
    },
    [onSnap, settle, progress, snapSV],
  );

  useImperativeHandle(ref, () => ({ snapTo }), [snapTo]);

  // ── Drag gesture (one fresh instance per draggable chrome region) ───────────
  const makePan = useCallback(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])      // small vertical move to engage — taps pass through
        .failOffsetX([-14, 14])      // let horizontal scrolls (friend rail) win
        .onBegin(() => {
          cancelAnimation(progress);
          const cp = Math.min(2, Math.max(0, progress.value));
          startH.value = progressToHeight(cp, heights.value);
        })
        .onUpdate((e) => {
          const nextH = startH.value - e.translationY;
          let p = heightToProgress(nextH, heights.value);
          if (p < 0) p = p * 0.18;            // rubber-band below pill
          if (p > 2) p = 2 + (p - 2) * 0.18;  // rubber-band above full
          progress.value = p;
        })
        .onEnd((e) => {
          const vy = e.velocityY / 1000;       // px/ms, matching legacy thresholds
          const currentH = startH.value - e.translationY;
          const currentP = heightToProgress(currentH, heights.value);
          const current = snapSV.value;

          const VEL_FLICK = 0.4;
          const VEL_JUMP  = 2.8;

          let target: number;
          if (Math.abs(vy) >= VEL_FLICK) {
            if (vy > 0) {
              const step = vy >= VEL_JUMP && current === 2 ? 2 : 1;
              target = Math.max(0, current - step);
            } else {
              target = Math.min(2, current + 1);
            }
          } else {
            target = current;
            let best = Math.abs(current - currentP);
            for (const c of [0, 1, 2]) {
              const d = Math.abs(c - currentP);
              if (d < best) { best = d; target = c; }
            }
          }
          runOnJS(snapTo)(target as 0 | 1 | 2);
        }),
    [progress, startH, heights, snapSV, snapTo],
  );

  const handlePan = useMemo(makePan, [makePan]);
  const pillPan   = useMemo(makePan, [makePan]);
  const headerPan = useMemo(makePan, [makePan]);

  // ── Animated styles ─────────────────────────────────────────────────────────
  const outerStyle = useAnimatedStyle(() => {
    const cp = Math.min(2, Math.max(0, progress.value));
    const side = interpolate(cp, [0, 1, 2], SIDES as unknown as number[], Extrapolation.CLAMP);
    return {
      height: progressToHeight(cp, heights.value),
      left: side,
      right: side,
      bottom: interpolate(cp, [0, 1, 2], [BOTTOM_GAP, BOTTOM_GAP, 0], Extrapolation.CLAMP),
    };
  });

  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
  }));
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.45], [0, 1], Extrapolation.CLAMP),
  }));
  const handleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [0, 1], Extrapolation.CLAMP),
  }));
  const footerStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      Math.min(2, Math.max(0, progress.value)),
      [0, 1, 2],
      [safeInset, safeInset, insets.bottom],
      Extrapolation.CLAMP,
    ),
  }));

  // ── Scroll context ──────────────────────────────────────────────────────────
  const ctxValue = useMemo(
    () => ({
      onScrollEndDragAtTop: (_speed: number) => {
        const i = snapIdx.current;
        if (i > 0) snapTo((i - 1) as 0 | 1);
      },
      scrollEnabled: snap === 2,
    }),
    [snap, snapTo],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SheetScrollContext.Provider value={ctxValue}>
      <Animated.View style={[styles.shadow, { borderRadius: RADIUS }, outerStyle]}>
        <View style={[styles.card, { borderRadius: RADIUS }]}>

          {/* Handle */}
          <GestureDetector gesture={handlePan}>
            <Animated.View style={[styles.handleArea, handleStyle]}>
              <View style={styles.handlePill} />
            </Animated.View>
          </GestureDetector>

          {/* State 0 — bordered search pill */}
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
                  <Ionicons name="search" size={18} color={colors.muted} />
                  <Text style={styles.pillHint} numberOfLines={1}>
                    {searchPlaceholder}
                  </Text>
                  {avatarLabel != null && (
                    <TouchableOpacity
                      onPress={onAvatarPress}
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

          {/* States 1 & 2 — full content */}
          {snap >= 1 && (
            <Animated.View style={[styles.fullContent, fullStyle]}>
              {showCloseButton ? (
                <GestureDetector gesture={headerPan}>
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
                        <Ionicons name="close" size={16} color={colors.inkSecondary} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </GestureDetector>
              ) : title != null ? (
                <GestureDetector gesture={headerPan}>
                  <View style={styles.header}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                    <View style={styles.headerActions}>
                      {onSharePress && (
                        <TouchableOpacity
                          onPress={onSharePress}
                          style={styles.headerCircle}
                          activeOpacity={0.8}
                          hitSlop={6}
                        >
                          <Ionicons name="share-outline" size={18} color={colors.ink} />
                        </TouchableOpacity>
                      )}
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
                  </View>
                </GestureDetector>
              ) : null}

              <View style={styles.content}>{children}</View>

              {footer != null && (
                <Animated.View style={[styles.footer, footerStyle]}>
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
  cancelBtn: { padding: 4 },
  cancelCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
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
  // ── Header (states 1 & 2) ───────────────────────────────────────────────────
  fullContent: { flex: 1 },
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
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
  content: {
    flex: 1,
    overflow: "hidden",
  },
  footer: {},
});
