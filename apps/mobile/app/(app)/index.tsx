import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Keyboard, Alert, Dimensions, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Sheet, { type SheetHandle, type AvatarAnchor } from "@/components/Sheet";
import { useSession } from "@/lib/SessionContext";
import { useProfile } from "@/lib/ProfileContext";
import { usePlaces } from "@/lib/PlacesContext";
import { selfAvatarUrl } from "@/lib/avatar";
import { hapticSelection } from "@/lib/haptics";

import AddPlacePanel from "@/components/BottomSheet/AddPlacePanel";
import MyPlacesPanel from "@/components/BottomSheet/MyPlacesPanel";
import SharePanel from "@/components/BottomSheet/SharePanel";
import FriendsPanel from "@/components/BottomSheet/FriendsPanel";
import ProfilePanel from "@/components/BottomSheet/ProfilePanel";
import PlacesMap, { type PreviewCoord, type FriendOverlay } from "@/components/PlacesMap";
import { useFriends } from "@/lib/FriendsContext";
import AvatarMenu from "@/components/AvatarMenu";
import { signOut } from "@/lib/auth";
import BottomNav, { type NavTab } from "@/components/BottomNav";
import PassportStamp from "@/components/PassportStamp";
import type { SavedPlace } from "@explrd/shared";
import type { GeoResult } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = NavTab | "add" | "profile";

const TAB_TITLES: Record<ActiveTab, string> = {
  places: "My Places",
  friends: "Friends",
  passport: "Passport",
  add: "Add a City",
  profile: "Profile",
};

// Sheet resting heights, mirrored from Sheet.tsx so the map can lift the Apple
// logo to sit just above whichever stop the sheet is parked at.
const SCREEN_H = Dimensions.get("window").height;
const SHEET_MID = Math.round(SCREEN_H * 0.52);
const SHEET_FULL = Math.round(SCREEN_H * 0.9);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MainScreen() {
  const { user } = useSession();
  const { profile } = useProfile();
  const { places, setPlaces, refresh, deletePlace } = usePlaces();
  const { selectedData: friendData, mapFilter, incoming } = useFriends();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<SheetHandle>(null);

  const [activeTab, setActiveTab]       = useState<ActiveTab>("places");
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [previewCoord, setPreviewCoord] = useState<PreviewCoord | null>(null);
  const [stampPlace, setStampPlace]     = useState<SavedPlace | null>(null);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [menuAnchor, setMenuAnchor]     = useState<AvatarAnchor | null>(null);
  const [sheetSnap, setSheetSnap]       = useState<0 | 1 | 2>(1);

  const avatarUri = useMemo(() => selfAvatarUrl(user, profile), [user, profile]);

  // Keep the Apple logo just above the sheet's top edge at whichever stop it's
  // resting on. The sheet sits BOTTOM_GAP (12px) off the bottom in pill/mid and
  // flush in full; add a small gap so the logo clears the edge without floating.
  const mapBottomInset = useMemo(() => {
    const pillHeight = 64 + Math.max(0, insets.bottom - 12);
    const heights = [pillHeight, SHEET_MID, SHEET_FULL];
    const cardBottom = [12, 12, 0];
    // iOS floats the attribution ~25px above the layout margin, so sit the
    // margin well below the sheet's top edge — the logo lands just above it.
    return heights[sheetSnap] + cardBottom[sheetSnap] - 34;
  }, [sheetSnap, insets.bottom]);

  // Tab to return to when the profile panel is closed.
  const tabBeforeProfile = useRef<ActiveTab>("places");

  // Ref so onSnap callback can read activeTab without stale closure
  const activeTabRef = useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;

  const fullName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");
  const displayName =
    profile?.display_name ||
    fullName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Explorer";

  // Initials from first+last name when we have them, else from the display name.
  const avatarLabel = useMemo(() => {
    if (profile?.first_name) {
      return (
        profile.first_name[0] + (profile.last_name?.[0] ?? "")
      ).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [profile?.first_name, profile?.last_name, displayName]);

  // ── Avatar menu / profile ─────────────────────────────────────────────────────
  const handleAvatarPress = useCallback((anchor: AvatarAnchor) => {
    hapticSelection();
    setMenuAnchor(anchor);
    setMenuOpen(true);
  }, []);

  const handleViewProfile = useCallback(() => {
    tabBeforeProfile.current =
      activeTabRef.current === "profile" ? "places" : activeTabRef.current;
    setActiveTab("profile");
    sheetRef.current?.snapTo(2);
  }, []);

  const handleProfileClose = useCallback(() => {
    Keyboard.dismiss();
    const back = tabBeforeProfile.current;
    setActiveTab(back === "add" ? "places" : back);
  }, []);

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void signOut() },
    ]);
  }, []);

  // ── Nav ───────────────────────────────────────────────────────────────────────
  const handleNavTabPress = useCallback((tab: NavTab) => {
    setActiveTab(tab);
  }, []);

  const handleAddPress = useCallback(() => {
    setActiveTab("add");
    sheetRef.current?.snapTo(2);
  }, []);

  const handleSearchPillPress = useCallback(() => {
    setActiveTab("add");
    sheetRef.current?.snapTo(2);
  }, []);

  const handleSearchClose = useCallback(() => {
    Keyboard.dismiss();
    setPreviewCoord(null);
    setActiveTab("places");
    sheetRef.current?.snapTo(0);
  }, []);

  // Called by Sheet when it snaps to a new index — if the user drags the sheet
  // to pill while in the add/search flow, exit the flow entirely.
  // Guard: skip during programmatic save-snap so the map/polygon stays visible.
  const handleSnap = useCallback((i: 0 | 1 | 2) => {
    setSheetSnap(i);
    if (activeTabRef.current === "add" && i === 0) {
      Keyboard.dismiss();
      setPreviewCoord(null);
      setActiveTab("places");
    } else if (activeTabRef.current === "profile" && i === 0) {
      Keyboard.dismiss();
      setActiveTab("places");
    }
  }, []);

  const handleSelectPlace = useCallback((result: GeoResult) => {
    setPreviewCoord({
      lat: result.lat,
      lng: result.lng,
      place_id: result.place_id,
      addresstype: result.addresstype,
    });
    sheetRef.current?.snapTo(1);
  }, []);

  const handleDeselectPlace = useCallback(() => {
    setPreviewCoord(null);
    sheetRef.current?.snapTo(2);
  }, []);

  const handleSearchFocus = useCallback(
    () => sheetRef.current?.snapTo(2),
    [],
  );

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  const handleSaved = useCallback(
    (optimistic: SavedPlace) => {
      // Optimistic insert; background refresh fills in server-normalised fields.
      setPlaces((prev) =>
        prev.some((p) => p.place_id === optimistic.place_id)
          ? prev
          : [optimistic, ...prev],
      );
      refresh();
      // Play the stamp celebration, then keep the user in the add flow so they
      // can add another city back-to-back. AddPlacePanel resets to a clean,
      // focused search; the close (X) button is how they finish and return.
      setPreviewCoord(null);
      setStampPlace(optimistic);
      setActiveTab("add");
      sheetRef.current?.snapTo(2);
    },
    [setPlaces, refresh],
  );

  const handleDelete = useCallback(
    async (placeId: string) => {
      if (deletingId) return;
      setDeletingId(placeId);
      try {
        await deletePlace(placeId);
      } catch (e) {
        console.warn("deletePlace:", e);
        throw e;
      } finally {
        setDeletingId(null);
      }
    },
    [deletePlace, deletingId],
  );

  const navActiveTab: NavTab =
    activeTab === "add" ? "places" : (activeTab as NavTab);

  // Friend's globe overlay — only while the friends tab is open with a friend selected
  const friendOverlay: FriendOverlay | null = useMemo(() => {
    if (activeTab !== "friends" || !friendData) return null;
    return {
      places: friendData.places,
      filter: mapFilter,
      name: friendData.displayName.split(/\s+/)[0],
    };
  }, [activeTab, friendData, mapFilter]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <PlacesMap
        places={places}
        previewCoord={previewCoord}
        friendOverlay={friendOverlay}
        bottomInset={mapBottomInset}
      />

      <Sheet
        ref={sheetRef}
        initialIndex={1}
        title={TAB_TITLES[activeTab]}
        avatarLabel={avatarLabel}
        avatarUri={avatarUri}
        onAvatarPress={handleAvatarPress}
        searchPlaceholder="Search a city…"
        onSearchPillPress={handleSearchPillPress}
        showCloseButton={activeTab === "add" || activeTab === "profile"}
        onClose={activeTab === "profile" ? handleProfileClose : handleSearchClose}
        midHeight={previewCoord !== null && activeTab === "add" ? 340 : undefined}
        onSnap={handleSnap}
        footer={
          activeTab !== "add" && activeTab !== "profile" ? (
            <BottomNav
              activeTab={navActiveTab}
              onTabPress={handleNavTabPress}
              onAdd={handleAddPress}
              friendsBadge={incoming.length}
            />
          ) : undefined
        }
      >
        {activeTab === "places" && (
          <MyPlacesPanel
            places={places}
            onDelete={handleDelete}
            deletingId={deletingId}
            displayName={displayName}
          />
        )}
        {activeTab === "friends" && (
          <FriendsPanel myPlaces={places} myDisplayName={displayName} />
        )}
        {activeTab === "passport" && <SharePanel places={places} />}
        {activeTab === "profile" && (
          <ProfilePanel displayName={displayName} avatarLabel={avatarLabel} />
        )}
        {activeTab === "add" && (
          <AddPlacePanel
            places={places}
            onSaved={handleSaved}
            onDelete={handleDelete}
            onSearchFocus={handleSearchFocus}
            onSearchBlur={() => {}}
            onSelectPlace={handleSelectPlace}
            onDeselectPlace={handleDeselectPlace}
          />
        )}
      </Sheet>

      {stampPlace && (
        <PassportStamp
          place={stampPlace}
          onDismiss={() => {
            setStampPlace(null);
            setPreviewCoord(null);
          }}
        />
      )}

      <AvatarMenu
        visible={menuOpen}
        anchor={menuAnchor}
        displayName={displayName}
        avatarLabel={avatarLabel}
        avatarUri={avatarUri}
        handle={profile?.username ?? null}
        onClose={() => setMenuOpen(false)}
        onViewProfile={handleViewProfile}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
