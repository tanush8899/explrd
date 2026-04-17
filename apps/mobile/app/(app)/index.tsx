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

// snap indices: 0 = 30%, 1 = 55%, 2 = 95%
const SNAP_POINTS = ["30%", "55%", "95%"];
const TAB_SNAP: Record<Tab, number> = { add: 0, places: 1, share: 1 };

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MainScreen() {
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("places");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const snapPoints = useMemo(() => SNAP_POINTS, []);

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

  // Expand to 95% when search is focused
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
      // Re-fetch in background to get fully-normalised data from the server
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

      {/* Loading overlay — shown until first fetch completes */}
      {loadingPlaces && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#868c94" />
        </View>
      )}

      {/* Sign-out pill — floats above the map */}
      <TouchableOpacity
        onPress={signOut}
        style={[styles.signOutBtn, { top: insets.top + 12 }]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        {/* Tab bar — fixed, non-scrollable header */}
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

        {/* Panel — each manages its own BottomSheetScrollView internally */}
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

  signOutBtn: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  signOutText: { fontSize: 12, fontWeight: "500", color: "#111214" },

  sheetHandle: { backgroundColor: "#d1d5db" },
  sheetBackground: { backgroundColor: "#ffffff" },

  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 4,
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
