import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as MediaLibrary from "expo-media-library";
import { useSession } from "@/lib/SessionContext";
import { usePlaces } from "@/lib/PlacesContext";
import { savePin } from "@/lib/api";
import {
  scanPhotosForCities,
  type DetectedCity,
  type ScanProgress,
  type ScanSignal,
} from "@/lib/photoSync";
import {
  hapticLight,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from "@/lib/haptics";
import { colors, gradients } from "@/lib/theme";
import type { SavedPlace } from "@explrd/shared";

type Phase = "intro" | "denied" | "scanning" | "review" | "saving" | "done";

type Props = {
  /** "onboarding" is the first-run gate; "resync" is the profile re-scan. */
  mode: "onboarding" | "resync";
  /** Called when the user finishes, skips, or dismisses. */
  onClose: () => void;
};

const SAVE_CONCURRENCY = 4;

function granted(p: MediaLibrary.PermissionResponse | null): boolean {
  // On iOS `granted` is true for both full and limited ("selected photos")
  // access — both let us read locations from the photos we can see.
  return !!p && p.granted;
}

export default function PhotoSyncView({ mode, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { places, setPlaces, refresh } = usePlaces();
  const [permission, requestPermission] = MediaLibrary.usePermissions();

  const [phase, setPhase] = useState<Phase>("intro");
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [detected, setDetected] = useState<DetectedCity[]>([]);
  // place_ids the user has ticked to add. Nothing is checked by default — the
  // user opts in to each city (or uses "Select all").
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const scanSignal = useRef<ScanSignal>({ aborted: false });

  const isOnboarding = mode === "onboarding";

  // ── Scan ──────────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    setError(null);
    setProgress({ phase: "reading", scanned: 0 });
    setPhase("scanning");
    scanSignal.current = { aborted: false };
    try {
      const cities = await scanPhotosForCities({
        onProgress: setProgress,
        signal: scanSignal.current,
      });
      // Drop cities already in the passport — nothing to confirm for those.
      const existing = new Set(places.map((p) => p.place_id));
      const fresh = cities.filter((c) => !existing.has(c.place_id));
      setDetected(fresh);
      // Start with nothing selected — the user ticks the cities they want.
      setSelected(new Set());
      setPhase("review");
      if (fresh.length > 0) hapticSuccess();
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setPhase("intro");
        return;
      }
      setError("Something went wrong scanning your photos. Please try again.");
      setPhase("intro");
    }
  }, [places]);

  const handleStart = useCallback(async () => {
    hapticLight();
    let perm = permission;
    if (!granted(perm)) {
      perm = await requestPermission();
    }
    if (granted(perm)) {
      void runScan();
    } else {
      setPhase("denied");
    }
  }, [permission, requestPermission, runScan]);

  const handleCancelScan = useCallback(() => {
    scanSignal.current.aborted = true;
  }, []);

  // ── Review actions ──────────────────────────────────────────────────────────
  const visible = detected.filter((c) => selected.has(c.place_id));

  const handleToggle = useCallback((placeId: string) => {
    hapticSelection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }, []);

  // Tick every detected city, or clear the lot when they're all already ticked.
  const handleToggleAll = useCallback(() => {
    hapticSelection();
    setSelected((prev) =>
      prev.size === detected.length ? new Set() : new Set(detected.map((c) => c.place_id)),
    );
  }, [detected]);

  const handleSave = useCallback(async () => {
    if (!session?.access_token || visible.length === 0) return;
    hapticLight();
    setError(null);
    setSaveProgress({ done: 0, total: visible.length });
    setPhase("saving");

    const queue = [...visible];
    const saved: SavedPlace[] = [];
    let failures = 0;
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        const city = queue[cursor++];
        try {
          await savePin(session.access_token, {
            place_id: city.place_id,
            display_name: city.display_name,
            lat: city.lat,
            lng: city.lng,
            address: city.address,
          });
          saved.push({
            place_id: city.place_id,
            name: city.display_name,
            lat: city.lat,
            lng: city.lng,
            formatted: city.display_name,
            notes: null,
            city: null,
            state: null,
            country: null,
            continent: null,
            normalized_city: null,
            normalized_state: null,
            normalized_country: null,
            normalized_continent: null,
            city_boundary: null,
            state_boundary: null,
            country_boundary: null,
            continent_boundary: null,
          });
        } catch {
          failures += 1;
        }
        setSaveProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(SAVE_CONCURRENCY, queue.length) }, worker),
    );

    // Optimistic insert so the map/list fill in immediately; refresh reconciles
    // with the server-normalised place records (boundaries, names, dedupe).
    if (saved.length > 0) {
      setPlaces((prev) => {
        const have = new Set(prev.map((p) => p.place_id));
        return [...saved.filter((s) => !have.has(s.place_id)), ...prev];
      });
      void refresh();
    }

    if (failures > 0 && saved.length === 0) {
      hapticWarning();
      setError("Couldn't add those places. Check your connection and try again.");
      setPhase("review");
      return;
    }

    hapticSuccess();
    setPhase("done");
    setTimeout(onClose, 900);
  }, [session?.access_token, visible, setPlaces, refresh, onClose]);

  const handleSkip = useCallback(() => {
    hapticSelection();
    onClose();
  }, [onClose]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={gradients.auth} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
        {phase === "intro" && (
          <Intro mode={mode} error={error} onStart={handleStart} />
        )}

        {phase === "denied" && (
          <Denied onOpenSettings={() => void Linking.openSettings()} onSkip={handleSkip} mode={mode} />
        )}

        {phase === "scanning" && (
          <Scanning progress={progress} onCancel={handleCancelScan} />
        )}

        {phase === "review" && (
          <Review
            cities={detected}
            selected={selected}
            selectedCount={visible.length}
            mode={mode}
            error={error}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
            onSave={handleSave}
            onSkip={handleSkip}
          />
        )}

        {phase === "saving" && <Saving progress={saveProgress} />}

        {phase === "done" && <Done count={saveProgress.total} />}
      </View>
    </LinearGradient>
  );
}

// ─── Import animation (gallery → globe) ──────────────────────────────────────
function ImportAnimation() {
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(flow, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [flow]);

  // A photo "travels" along the arrow and lands on the globe, which pulses as it
  // receives it.
  const dotTranslate = flow.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });
  const dotOpacity = flow.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });
  const globeScale = flow.interpolate({
    inputRange: [0, 0.7, 0.85, 1],
    outputRange: [1, 1, 1.16, 1],
  });

  return (
    <View style={styles.animRow}>
      <View style={styles.animIconWell}>
        <Ionicons name="images" size={32} color={colors.blue} />
      </View>

      <View style={styles.animTrack}>
        <Ionicons name="arrow-forward" size={20} color={colors.onDarkMuted} />
        <Animated.View
          style={[
            styles.animDot,
            { opacity: dotOpacity, transform: [{ translateX: dotTranslate }] },
          ]}
        />
      </View>

      <Animated.View style={[styles.animIconWell, { transform: [{ scale: globeScale }] }]}>
        <Ionicons name="earth" size={34} color={colors.blue} />
      </Animated.View>
    </View>
  );
}

// ─── Intro ──────────────────────────────────────────────────────────────────
function Intro({
  mode,
  error,
  onStart,
}: {
  mode: "onboarding" | "resync";
  error: string | null;
  onStart: () => void;
}) {
  // Apple Guideline 5.1.1(iv): the message shown before a permission request
  // must not include an exit button that lets the user dodge the request. The
  // only action here proceeds to the system photo-access prompt; the user's
  // decline path is the system dialog itself (→ the "Denied" screen, which can
  // then offer a way out *after* the request).
  return (
    <View style={styles.centered}>
      <ImportAnimation />
      <Text style={styles.title}>
        {mode === "onboarding"
          ? "Build your globe from your photo gallery"
          : "Sync from your photos"}
      </Text>
      <Text style={styles.subtitle}>
        Explrd can use the location data from your photo gallery to quickly find
        cities you've already visited. You will confirm the list before anything is
        added.
      </Text>
      <View style={styles.privacyRow}>
        <Ionicons name="lock-closed" size={14} color={colors.onDarkMuted} />
        <Text style={styles.privacyText}>Your photos stay on your device.</Text>
      </View>

      <View style={styles.bottomBlock}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={onStart} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Scan your photo gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Denied ─────────────────────────────────────────────────────────────────
function Denied({
  mode,
  onOpenSettings,
  onSkip,
}: {
  mode: "onboarding" | "resync";
  onOpenSettings: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.iconWell}>
        <Ionicons name="lock-closed" size={36} color={colors.blue} />
      </View>
      <Text style={styles.title}>Photo access is off</Text>
      <Text style={styles.subtitle}>
        To find places from your photos, allow access to your photo gallery in Settings.
        You can choose all photos or just a selection.
      </Text>
      <View style={styles.bottomBlock}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onOpenSettings} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>{mode === "onboarding" ? "Not now" : "Cancel"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Scanning ────────────────────────────────────────────────────────────────
function Scanning({
  progress,
  onCancel,
}: {
  progress: ScanProgress | null;
  onCancel: () => void;
}) {
  let line = "Looking through your photos…";
  if (progress?.phase === "reading") {
    line = `Scanned ${progress.scanned.toLocaleString()} photos…`;
  } else if (progress?.phase === "resolving") {
    line = `Finding your cities… ${progress.resolved}/${progress.total}`;
  }
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.blue} />
      <Text style={[styles.title, { marginTop: 24 }]}>Scanning your gallery</Text>
      <Text style={styles.subtitle}>{line}</Text>
      <View style={styles.reminderRow}>
        <Ionicons name="information-circle" size={15} color={colors.onDarkMuted} />
        <Text style={styles.reminderText}>
          An explored city is one you've spent at least a day in.
        </Text>
      </View>
      <View style={styles.bottomBlock}>
        <TouchableOpacity style={styles.skipBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.skipText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Review ──────────────────────────────────────────────────────────────────
function Review({
  cities,
  selected,
  selectedCount,
  mode,
  error,
  onToggle,
  onToggleAll,
  onSave,
  onSkip,
}: {
  cities: DetectedCity[];
  selected: Set<string>;
  selectedCount: number;
  mode: "onboarding" | "resync";
  error: string | null;
  onToggle: (placeId: string) => void;
  onToggleAll: () => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  if (cities.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.iconWell}>
          <Ionicons name="checkmark-done" size={36} color={colors.blue} />
        </View>
        <Text style={styles.title}>You're all caught up</Text>
        <Text style={styles.subtitle}>
          We didn't find any new cities in your photos that aren't already on your map.
        </Text>
        <View style={styles.bottomBlock}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onSkip} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>
              {mode === "onboarding" ? "Continue" : "Done"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.reviewRoot}>
      <Text style={styles.reviewTitle}>
        We found {cities.length} {cities.length === 1 ? "city" : "cities"}
      </Text>
      <Text style={styles.reviewSubtitle}>
        Tick the cities to add to your globe. An explored city is one you've spent
        at least a day in.
      </Text>

      <TouchableOpacity
        style={styles.selectAllRow}
        onPress={onToggleAll}
        activeOpacity={0.7}
      >
        <Text style={styles.selectAllText}>
          {selected.size === cities.length ? "Deselect all" : "Select all"}
        </Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {cities.map((c) => {
          const parts = c.display_name.split(",");
          const primary = parts[0].trim();
          const secondary = parts.slice(1).join(",").trim();
          const isOn = selected.has(c.place_id);
          const meta = `${c.photoCount} ${c.photoCount === 1 ? "photo" : "photos"}`;
          return (
            <TouchableOpacity
              key={c.place_id}
              style={styles.row}
              onPress={() => onToggle(c.place_id)}
              activeOpacity={0.6}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowPrimary} numberOfLines={1}>
                  {primary}
                </Text>
                <Text style={styles.rowSecondary} numberOfLines={1}>
                  {secondary ? `${secondary} · ${meta}` : meta}
                </Text>
              </View>
              <Ionicons
                name={isOn ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={isOn ? colors.blue : colors.onDarkMuted}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.reviewFooter}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.primaryBtn, selectedCount === 0 && styles.primaryBtnDisabled]}
          onPress={onSave}
          disabled={selectedCount === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {selectedCount === 0
              ? "Select cities to add"
              : `Add ${selectedCount} ${selectedCount === 1 ? "city" : "cities"}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>{mode === "onboarding" ? "Skip for now" : "Cancel"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Saving ──────────────────────────────────────────────────────────────────
function Saving({ progress }: { progress: { done: number; total: number } }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.blue} />
      <Text style={[styles.title, { marginTop: 24 }]}>Adding to your map</Text>
      <Text style={styles.subtitle}>
        {progress.done}/{progress.total} added
      </Text>
    </View>
  );
}

// ─── Done ────────────────────────────────────────────────────────────────────
function Done({ count }: { count: number }) {
  return (
    <View style={styles.centered}>
      <View style={[styles.iconWell, { backgroundColor: "rgba(52,199,89,0.12)" }]}>
        <Ionicons name="checkmark-circle" size={44} color={colors.success} />
      </View>
      <Text style={styles.title}>
        Added {count} {count === 1 ? "place" : "places"}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  iconWell: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  // Gallery → globe animation
  animRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  animIconWell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  animTrack: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  animDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.onDark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.onDarkSecondary,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 21,
    paddingHorizontal: 6,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.onDarkFill,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.onDarkMuted,
    lineHeight: 16,
  },

  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 20,
    paddingHorizontal: 18,
  },
  reminderText: {
    fontSize: 13,
    color: colors.onDarkMuted,
    textAlign: "center",
    lineHeight: 18,
  },

  bottomBlock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    gap: 6,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.blue,
    borderRadius: 999,
    paddingVertical: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  primaryBtnDisabled: { opacity: 0.4 },
  skipBtn: { paddingVertical: 14, alignItems: "center" },
  skipText: { color: colors.onDarkSecondary, fontSize: 15, fontWeight: "600" },
  errorText: {
    color: "#ff8a82",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 6,
  },

  // Review
  reviewRoot: { flex: 1, paddingTop: 8 },
  reviewTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.onDark,
  },
  reviewSubtitle: {
    fontSize: 14,
    color: colors.onDarkSecondary,
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 20,
  },
  selectAllRow: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.blue,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassDarkHairline,
  },
  rowText: { flex: 1 },
  rowPrimary: { fontSize: 16, fontWeight: "600", color: colors.onDark },
  rowSecondary: { fontSize: 13, color: colors.onDarkMuted, marginTop: 1 },
  reviewFooter: { paddingTop: 8, gap: 6 },
});
