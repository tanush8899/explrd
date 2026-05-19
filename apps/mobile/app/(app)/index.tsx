import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/SessionContext";
import { signOut } from "@/lib/auth";
import { fetchMyPlaces, deletePin } from "@/lib/api";
import AddPlacePanel from "@/components/BottomSheet/AddPlacePanel";
import MyPlacesPanel from "@/components/BottomSheet/MyPlacesPanel";
import SharePanel from "@/components/BottomSheet/SharePanel";
import PlacesMap from "@/components/PlacesMap";
import type { SavedPlace } from "@explrd/shared";

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = "add" | "places" | "share";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "add", label: "Add" },
  { key: "places", label: "My Places" },
  { key: "share", label: "Share" },
];

// Three snap states mirroring the Flighty-style floating sheet:
//   0 → peek: large title header visible, tab bar peeking
//   1 → mid:  header + tab bar + first section of content
//   2 → full: near-full-screen scrollable content
const SNAP_POINTS = [180, "52%", "90%"] as const;
const TAB_SNAP: Record<Tab, number> = { add: 0, places: 1, share: 1 };

// Gap between the sheet and the screen edges (floating look)
const SHEET_HORIZONTAL_MARGIN = 12;
const SHEET_BOTTOM_INSET = 16;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MainScreen() {
  const { session, user } = useSession();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("places");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const snapPoints = useMemo(() => [...SNAP_POINTS], []);

  // Derive avatar initials from email (e.g. "tanush@..." → "T")
  const avatarInitials = useMemo(() => {
    const email = user?.email ?? "";
    return email.slice(0, 2).toUpperCase() || "ME";
  }, [user?.email]);

  // ── Load places ─────────────────────────────────────────────────────────────
  const loadPlaces = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await fetchMyPlaces(session.access_token);
      setPlaces(data);
    } catch (e) {
      console.warn("fetchMyPlaces:", e);
    } finally {
      setLoadingPlaces(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  // ── Tab switching ────────────────────────────────────────────────────────────
  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab);
    sheetRef.current?.snapToIndex(TAB_SNAP[tab]);
  };

  // Expand to full when search is focused
  const handleSearchFocus = useCallback(
    () => sheetRef.current?.snapToIndex(2),
    []
  );
  const handleSearchBlur = useCallback(
    () => sheetRef.current?.snapToIndex(0),
    []
  );

  // ── CRUD callbacks ───────────────────────────────────────────────────────────
  const handleSaved = useCallback(
    (optimistic: SavedPlace) => {
      setPlaces((prev) =>
        prev.some((p) => p.place_id === optimistic.place_id)
          ? prev
          : [optimistic, ...prev]
      );
      loadPlaces();
    },
    [loadPlaces]
  );

  const handleDelete = useCallback(
    async (placeId: string) => {
      if (!session?.access_token || deletingId) return;
      setDeletingId(placeId);
      try {
        await deletePin(session.access_token, placeId);
        setPlaces((prev) => prev.filter((p) => p.place_id !== placeId));
      } catch (e) {
        console.warn("deletePin:", e);
      } finally {
        setDeletingId(null);
      }
    },
    [session?.access_token, deletingId]
  );

  // ── Backdrop ─────────────────────────────────────────────────────────────────
  const renderBackdrop = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={1}
        appearsOnIndex={2}
        pressBehavior="collapse"
      />
    ),
    []
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <PlacesMap places={places} />

      {/* Loading overlay */}
      {loadingPlaces && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#868c94" />
        </View>
      )}

      {/* ── Floating bottom sheet ──────────────────────────────────────────── */}
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        // ── Floating / detached appearance ──────────────────────────────────
        detached
        bottomInset={SHEET_BOTTOM_INSET + insets.bottom}
        style={styles.sheetOuter}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        backdropComponent={renderBackdrop}
        // Smooth spring animation
        animateOnMount
      >
        {/* ── Large-title header (always visible) ───────────────────────── */}
        <BottomSheetView style={[styles.sheetHeader, { paddingTop: 8 }]}>
          <Text style={styles.sheetTitle}>My Places</Text>
          <View style={styles.headerActions}>
            {/* Share icon */}
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Text style={styles.iconBtnText}>↑</Text>
            </TouchableOpacity>
            {/* Avatar — tap to sign out */}
            <TouchableOpacity
              onPress={signOut}
              style={styles.avatarCircle}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarText}>{avatarInitials}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <BottomSheetView style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabPress(tab.key)}
              style={[
                styles.tabBtn,
                activeTab === tab.key && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </BottomSheetView>

        {/* ── Panel content ─────────────────────────────────────────────── */}
        {activeTab === "add" && (
          <AddPlacePanel
            onSaved={handleSaved}
            onSearchFocus={handleSearchFocus}
            onSearchBlur={handleSearchBlur}
          />
        )}
        {activeTab === "places" && (
          <MyPlacesPanel
            places={places}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        )}
        {activeTab === "share" && <SharePanel places={places} />}
      </BottomSheet>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232,234,237,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Floating sheet ────────────────────────────────────────────────────────
  sheetOuter: {
    marginHorizontal: SHEET_HORIZONTAL_MARGIN,
  },
  sheetBackground: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    // Shadow so the sheet lifts off the map
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetHandle: {
    backgroundColor: "#d1d5db",
    width: 36,
  },

  // ── Sheet header ─────────────────────────────────────────────────────────
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111214",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    fontSize: 16,
    color: "#111214",
    fontWeight: "600",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#c9a84c",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f1f2",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 999,
  },
  tabBtnActive: { backgroundColor: "#111214" },
  tabText: { fontSize: 13, fontWeight: "500", color: "#868c94" },
  tabTextActive: { color: "#ffffff" },
});
