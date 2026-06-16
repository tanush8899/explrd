import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Keyboard, Alert, StyleSheet } from "react-native";
import Sheet, { type SheetHandle, type AvatarAnchor } from "@/components/Sheet";
import { useSession } from "@/lib/SessionContext";
import { useProfile } from "@/lib/ProfileContext";
import { usePlaces } from "@/lib/PlacesContext";

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
  add: "Add Place",
  profile: "Profile",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MainScreen() {
  const { user } = useSession();
  const { profile } = useProfile();
  const { places, setPlaces, refresh, deletePlace } = usePlaces();
  const { selectedData: friendData, mapFilter } = useFriends();
  const sheetRef = useRef<SheetHandle>(null);

  const [activeTab, setActiveTab]       = useState<ActiveTab>("places");
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [previewCoord, setPreviewCoord] = useState<PreviewCoord | null>(null);
  const [stampPlace, setStampPlace]     = useState<SavedPlace | null>(null);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [menuAnchor, setMenuAnchor]     = useState<AvatarAnchor | null>(null);

  // Tab to return to when the profile panel is closed.
  const tabBeforeProfile = useRef<ActiveTab>("places");

  // Ref so onSnap callback can read activeTab without stale closure
  const activeTabRef = useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;
  // Prevents handleSnap from clearing the preview when save itself triggers the snap
  const isSavingRef = useRef(false);

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
    if (isSavingRef.current) return;
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
      setStampPlace(optimistic);
      // Collapse sheet to pill — user stays in add tab so they can search again.
      // isSavingRef prevents handleSnap from switching tabs during this programmatic snap.
      Keyboard.dismiss();
      isSavingRef.current = true;
      sheetRef.current?.snapTo(0);
      setTimeout(() => { isSavingRef.current = false; }, 600);
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
      <PlacesMap places={places} previewCoord={previewCoord} friendOverlay={friendOverlay} />

      <Sheet
        ref={sheetRef}
        initialIndex={1}
        title={TAB_TITLES[activeTab]}
        avatarLabel={avatarLabel}
        onAvatarPress={handleAvatarPress}
        searchPlaceholder="Search city, country…"
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
        onClose={() => setMenuOpen(false)}
        onViewProfile={handleViewProfile}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
