import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/SessionContext";
import { signOut } from "@/lib/auth";
import { fetchMyPlaces, deletePin, type GeoResult } from "@/lib/api";
import AddPlacePanel from "@/components/BottomSheet/AddPlacePanel";
import MyPlacesPanel from "@/components/BottomSheet/MyPlacesPanel";
import SharePanel from "@/components/BottomSheet/SharePanel";
import PlacesMap, { type PlacesMapHandle } from "@/components/PlacesMap";
import { GlassSurface, Icon } from "@/components/Glass";
import type { SavedPlace } from "@explrd/shared";

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = "places" | "passport" | "add";

const SNAP_POINTS = ["24%", "48%", "93%"];

const TAB_TITLES: Record<Tab, string> = {
  places: "My Places",
  passport: "Passport",
  add: "Add Place",
};

const BLUE = "#0a84ff";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MainScreen() {
  const { session, user } = useSession();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<PlacesMapHandle>(null);

  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("places");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);

  const snapPoints = useMemo(() => SNAP_POINTS, []);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Explorer";
  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

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

  // ── Navigation between panels ───────────────────────────────────────────────
  const openTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "add") {
      sheetRef.current?.snapToIndex(2);
    } else {
      setPreview(null);
      sheetRef.current?.snapToIndex(1);
    }
  };

  const closeAdd = () => {
    Keyboard.dismiss();
    setPreview(null);
    mapRef.current?.fitAll();
    openTab("places");
  };

  // ── Map preview while searching ─────────────────────────────────────────────
  const handleSelectPlace = useCallback((result: GeoResult) => {
    setPreview({
      lat: result.lat,
      lng: result.lng,
      label: result.display_name.split(",")[0].trim(),
    });
    mapRef.current?.focusOn(result.lat, result.lng);
    // Drop the sheet so the map fly-to is visible behind it.
    sheetRef.current?.snapToIndex(1);
  }, []);

  const handleDeselectPlace = useCallback(() => {
    setPreview(null);
    sheetRef.current?.snapToIndex(2);
  }, []);

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

  const handleAvatarPress = () => {
    Alert.alert(displayName, user?.email ?? undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  // ── Backdrop ─────────────────────────────────────────────────────────────────
  const renderBackdrop = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={1}
        appearsOnIndex={2}
        opacity={0.25}
        pressBehavior="collapse"
      />
    ),
    []
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Satellite globe ────────────────────────────────────────────────── */}
      <PlacesMap ref={mapRef} places={places} preview={preview} />

      {/* Loading veil — shown until first fetch completes */}
      {loadingPlaces && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}

      {/* ── Floating sheet ─────────────────────────────────────────────────── */}
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
        style={styles.sheetContainer}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {/* Header — Flighty-style oversized title + avatar / close */}
        <BottomSheetView style={styles.header}>
          <Text style={styles.headerTitle}>{TAB_TITLES[activeTab]}</Text>
          {activeTab === "add" ? (
            <TouchableOpacity
              onPress={closeAdd}
              style={styles.closeBtn}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Icon name="xmark" fallback="✕" size={15} color="#3c3f44" weight="bold" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleAvatarPress}
              style={styles.avatar}
              hitSlop={8}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </TouchableOpacity>
          )}
        </BottomSheetView>

        {/* Panels — all existing functionality, new clothes */}
        {activeTab === "add" && (
          <AddPlacePanel
            places={places}
            onSaved={handleSaved}
            onDelete={handleDelete}
            onSelectPlace={handleSelectPlace}
            onDeselectPlace={handleDeselectPlace}
            onDone={closeAdd}
          />
        )}
        {activeTab === "places" && (
          <MyPlacesPanel
            places={places}
            onDelete={handleDelete}
            deletingId={deletingId}
            onAddPress={() => openTab("add")}
          />
        )}
        {activeTab === "passport" && <SharePanel places={places} />}
      </BottomSheet>

      {/* ── Floating liquid-glass tab bar ──────────────────────────────────── */}
      {activeTab !== "add" && (
        <View
          style={[styles.tabBarWrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}
          pointerEvents="box-none"
        >
          <GlassSurface style={styles.tabPill} interactive>
            <TabButton
              label="My Places"
              icon="map.fill"
              fallback="🗺"
              active={activeTab === "places"}
              onPress={() => openTab("places")}
            />
            <TabButton
              label="Passport"
              icon="wallet.pass.fill"
              fallback="🛂"
              active={activeTab === "passport"}
              onPress={() => openTab("passport")}
            />
          </GlassSurface>

          <GlassSurface style={styles.searchCircle} interactive>
            <TouchableOpacity
              onPress={() => openTab("add")}
              style={styles.searchTouch}
              activeOpacity={0.8}
            >
              <Icon name="magnifyingglass" fallback="🔍" size={22} color="#1c1c1e" weight="semibold" />
            </TouchableOpacity>
          </GlassSurface>
        </View>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  label,
  icon,
  fallback,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  fallback: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      activeOpacity={0.8}
    >
      <Icon
        name={icon}
        fallback={fallback}
        size={21}
        color={active ? BLUE : "#5a5f66"}
      />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ABSOLUTE_FILL = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

const styles = StyleSheet.create({
  root: {
    ...ABSOLUTE_FILL,
    backgroundColor: "#06080d",
  },

  loadingOverlay: {
    ...ABSOLUTE_FILL,
    backgroundColor: "rgba(6,8,13,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Sheet
  sheetContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  sheetBackground: {
    backgroundColor: "#ffffff",
    borderRadius: 44,
  },
  sheetHandle: {
    backgroundColor: "#d8dadd",
    width: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 2,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: "#0b0c0e",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ecd393",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5b4a17",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f2f3f5",
    alignItems: "center",
    justifyContent: "center",
  },

  // Floating tab bar
  tabBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  tabPill: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 5,
    gap: 2,
  },
  tabBtn: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 22,
    borderRadius: 999,
    gap: 2,
  },
  tabBtnActive: {
    backgroundColor: "rgba(10,132,255,0.14)",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5a5f66",
  },
  tabLabelActive: {
    color: BLUE,
  },
  searchCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  searchTouch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
