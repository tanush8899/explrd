import React, { useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getExplrdStats } from "@explrd/shared";
import type { SavedPlace, ExplrdStats } from "@explrd/shared";
import { SheetScrollContext } from "@/components/Sheet";
import { useFriends, type FriendEntry, type FriendMapFilter } from "@/lib/FriendsContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS: [string, string][] = [
  ["#f59e0b", "#ef4444"],
  ["#3b82f6", "#8b5cf6"],
  ["#10b981", "#06b6d4"],
  ["#ec4899", "#8b5cf6"],
  ["#6366f1", "#3b82f6"],
  ["#f97316", "#eab308"],
];

function gradientFor(slug: string): [string, string] {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

function placeLabel(p: SavedPlace): string {
  return p.city ?? p.name ?? p.formatted ?? p.place_id;
}

function cityCountryKey(p: SavedPlace): string {
  const city = (p.normalized_city ?? p.city ?? p.name ?? "").toLowerCase().trim();
  const country = (p.normalized_country ?? p.country ?? "").toLowerCase().trim();
  return `${city}|${country}`;
}

/** Country the user has saved the most places in, with its count. */
function topCountry(places: SavedPlace[]): { country: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const p of places) {
    const c = p.country ?? p.normalized_country;
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: { country: string; count: number } | null = null;
  for (const [country, count] of counts) {
    if (!best || count > best.count) best = { country, count };
  }
  return best;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

type Props = {
  myPlaces: SavedPlace[];
  myDisplayName: string;
};

export default function FriendsPanel({ myPlaces, myDisplayName }: Props) {
  const {
    friends,
    selectedSlug,
    selectedData,
    loadingSlug,
    mapFilter,
    setMapFilter,
    selectFriend,
    addFriend,
    removeFriend,
  } = useFriends();

  const [adding, setAdding] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  const myStats = useMemo(() => getExplrdStats(myPlaces), [myPlaces]);

  const handleAdd = async () => {
    if (addBusy) return;
    setAddBusy(true);
    setAddError(null);
    try {
      await addFriend(slugInput);
      setSlugInput("");
      setAdding(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add friend.");
    } finally {
      setAddBusy(false);
    }
  };

  const confirmRemove = (friend: FriendEntry) => {
    Alert.alert("Remove Friend", `Remove ${friend.displayName} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void removeFriend(friend.slug),
      },
    ]);
  };

  const selectedFriend = friends.find((f) => f.slug === selectedSlug) ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      onScrollEndDrag={(e) => {
        const { contentOffset, velocity } = e.nativeEvent;
        if (contentOffset.y <= 0 && (velocity?.y ?? 0) < -0.3) {
          onScrollEndDragAtTop(Math.abs(velocity?.y ?? 0));
        }
      }}
    >
      {/* ── Friend rail ─────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {friends.map((friend) => {
          const isSelected = friend.slug === selectedSlug;
          const isLoading = friend.slug === loadingSlug;
          return (
            <TouchableOpacity
              key={friend.slug}
              style={styles.railItem}
              activeOpacity={0.8}
              onPress={() => selectFriend(isSelected ? null : friend.slug)}
              onLongPress={() => confirmRemove(friend)}
            >
              <View style={[styles.avatarRing, isSelected && styles.avatarRingActive]}>
                <LinearGradient
                  colors={gradientFor(friend.slug)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.avatarText}>{initialsOf(friend.displayName)}</Text>
                  )}
                </LinearGradient>
              </View>
              <Text
                style={[styles.railName, isSelected && styles.railNameActive]}
                numberOfLines={1}
              >
                {firstName(friend.displayName)}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Add friend */}
        <TouchableOpacity
          style={styles.railItem}
          activeOpacity={0.8}
          onPress={() => {
            setAdding((v) => !v);
            setAddError(null);
          }}
        >
          <View style={[styles.avatarRing, adding && styles.avatarRingActive]}>
            <View style={styles.addCircle}>
              <Ionicons name="add" size={26} color="#3d4249" />
            </View>
          </View>
          <Text style={styles.railName}>Add</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add friend form ─────────────────────────────────────────────────── */}
      {adding && (
        <View style={styles.addBox}>
          <Text style={styles.addTitle}>Add a friend</Text>
          <Text style={styles.addHint}>
            Paste their explrd profile link or username. They can find it under
            Profile → public link.
          </Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="explrd.app/u/username"
              placeholderTextColor="#a5abb3"
              autoCapitalize="none"
              autoCorrect={false}
              value={slugInput}
              onChangeText={setSlugInput}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, addBusy && { opacity: 0.6 }]}
              onPress={handleAdd}
              disabled={addBusy}
              activeOpacity={0.8}
            >
              {addBusy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.addBtnText}>Add</Text>
              )}
            </TouchableOpacity>
          </View>
          {addError && <Text style={styles.addError}>{addError}</Text>}
        </View>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {friends.length === 0 && !adding && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptyDesc}>
            Add a friend with their explrd profile link to explore their globe
            and compare your travels.
          </Text>
        </View>
      )}

      {friends.length > 0 && !selectedFriend && !adding && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Pick a friend</Text>
          <Text style={styles.emptyDesc}>
            Tap a friend above to light up their places on the globe and see
            how your adventures compare.
          </Text>
        </View>
      )}

      {selectedFriend && !selectedData && loadingSlug === selectedFriend.slug && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={styles.loadingText}>
            Loading {firstName(selectedFriend.displayName)}'s globe…
          </Text>
        </View>
      )}

      {selectedFriend && selectedData && (
        <FriendDetail
          friendName={selectedData.displayName}
          friendPlaces={selectedData.places}
          friendStats={selectedData.stats}
          myName={myDisplayName}
          myPlaces={myPlaces}
          myStats={myStats}
          mapFilter={mapFilter}
          setMapFilter={setMapFilter}
        />
      )}
    </ScrollView>
  );
}

// ─── Friend detail ───────────────────────────────────────────────────────────

function FriendDetail({
  friendName,
  friendPlaces,
  friendStats,
  myName,
  myPlaces,
  myStats,
  mapFilter,
  setMapFilter,
}: {
  friendName: string;
  friendPlaces: SavedPlace[];
  friendStats: ExplrdStats;
  myName: string;
  myPlaces: SavedPlace[];
  myStats: ExplrdStats;
  mapFilter: FriendMapFilter;
  setMapFilter: (f: FriendMapFilter) => void;
}) {
  const friendFirst = firstName(friendName);

  const fun = useMemo(() => {
    const myKeys = new Set(myPlaces.map(cityCountryKey));
    const shared = friendPlaces.filter((p) => myKeys.has(cityCountryKey(p)));
    const myCountries = new Set(
      myPlaces.map((p) => (p.country ?? "").toLowerCase()).filter(Boolean),
    );
    const sharedCountries = new Set(
      friendPlaces
        .map((p) => p.country)
        .filter((c): c is string => !!c && myCountries.has(c.toLowerCase())),
    );
    return {
      lastPlace: friendPlaces[0] ?? null,
      myLastPlace: myPlaces[0] ?? null,
      topCountry: topCountry(friendPlaces),
      myTopCountry: topCountry(myPlaces),
      sharedPlaces: shared,
      sharedCountries: [...sharedCountries],
      friendOnlyCount: friendPlaces.filter((p) => !myKeys.has(cityCountryKey(p))).length,
    };
  }, [friendPlaces, myPlaces]);

  const ahead = friendStats.percentWorldTraveled === myStats.percentWorldTraveled
    ? null
    : friendStats.percentWorldTraveled > myStats.percentWorldTraveled
      ? friendFirst
      : "You";

  return (
    <View>
      {/* Globe filter */}
      <Text style={styles.sectionLabel}>ON THE GLOBE</Text>
      <View style={styles.filterRow}>
        <FilterChip
          label="Both of you"
          active={mapFilter === "both"}
          onPress={() => setMapFilter("both")}
        />
        <FilterChip
          label={`Just ${friendFirst}'s globe`}
          active={mapFilter === "friend"}
          onPress={() => setMapFilter("friend")}
        />
      </View>
      <View style={styles.legendRow}>
        {mapFilter === "both" && <LegendDot color="#111214" label="You" />}
        <LegendDot color="#3b82f6" label={friendFirst} />
        {mapFilter === "both" && <LegendDot color="#8b5cf6" label="Both of you" />}
      </View>

      {/* VS card */}
      <View style={styles.vsCardWrapper}>
        <LinearGradient
          colors={["#0f1829", "#1a3050"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.vsCard}
        >
          <Text style={styles.vsHeading}>WORLD EXPLORED</Text>
          <View style={styles.vsColumns}>
            <View style={styles.vsCol}>
              <Text style={styles.vsName} numberOfLines={1}>{firstName(myName)}</Text>
              <Text style={styles.vsPercent}>{myStats.percentWorldTraveled}%</Text>
            </View>
            <View style={styles.vsDivider}>
              <Text style={styles.vsVsText}>VS</Text>
            </View>
            <View style={styles.vsCol}>
              <Text style={styles.vsName} numberOfLines={1}>{friendFirst}</Text>
              <Text style={[styles.vsPercent, { color: "#7cb1ff" }]}>
                {friendStats.percentWorldTraveled}%
              </Text>
            </View>
          </View>

          <VsBar label="CITIES" mine={myStats.uniqueCities} theirs={friendStats.uniqueCities} />
          <VsBar label="COUNTRIES" mine={myStats.uniqueCountries} theirs={friendStats.uniqueCountries} />
          <VsBar label="CONTINENTS" mine={myStats.uniqueContinents} theirs={friendStats.uniqueContinents} />

          {ahead && (
            <Text style={styles.vsFooter}>
              {ahead === "You"
                ? `You're ahead — but ${friendFirst} is catching up! 🏃`
                : `${friendFirst} is ahead — time to book a trip! ✈️`}
            </Text>
          )}
        </LinearGradient>
      </View>

      {/* Fun fact cards */}
      <Text style={styles.sectionLabel}>FUN FACTS</Text>

      {fun.lastPlace && (
        <FactCard
          icon="footsteps"
          title={`${friendFirst}'s latest stamp`}
          big={placeLabel(fun.lastPlace)}
          sub={[fun.lastPlace.state, fun.lastPlace.country].filter(Boolean).join(", ")}
        />
      )}

      {fun.topCountry && (
        <FactCard
          icon="trophy"
          title={`${friendFirst}'s most explored country`}
          big={fun.topCountry.country}
          sub={`${fun.topCountry.count} ${fun.topCountry.count === 1 ? "place" : "places"} stamped${
            fun.myTopCountry ? ` — yours is ${fun.myTopCountry.country}` : ""
          }`}
        />
      )}

      <FactCard
        icon="git-compare"
        title="Been there together"
        big={
          fun.sharedPlaces.length === 0
            ? "No overlap yet!"
            : `${fun.sharedPlaces.length} shared ${fun.sharedPlaces.length === 1 ? "city" : "cities"}`
        }
        sub={
          fun.sharedPlaces.length === 0
            ? `You and ${friendFirst} have explored completely different corners of the world.`
            : fun.sharedPlaces.slice(0, 5).map(placeLabel).join(" • ")
        }
      />

      {fun.sharedCountries.length > 0 && (
        <FactCard
          icon="earth"
          title="Countries you've both touched"
          big={`${fun.sharedCountries.length} ${fun.sharedCountries.length === 1 ? "country" : "countries"}`}
          sub={fun.sharedCountries.slice(0, 6).join(" • ")}
        />
      )}

      {fun.friendOnlyCount > 0 && (
        <FactCard
          icon="bulb"
          title="Trip inspiration"
          big={`${fun.friendOnlyCount} new ${fun.friendOnlyCount === 1 ? "idea" : "ideas"}`}
          sub={`${friendFirst} has been to ${fun.friendOnlyCount} ${
            fun.friendOnlyCount === 1 ? "place" : "places"
          } you haven't — ask them where to go next!`}
        />
      )}
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function VsBar({ label, mine, theirs }: { label: string; mine: number; theirs: number }) {
  const total = Math.max(mine + theirs, 1);
  return (
    <View style={styles.vsBarBlock}>
      <View style={styles.vsBarLabels}>
        <Text style={styles.vsBarValue}>{mine}</Text>
        <Text style={styles.vsBarLabel}>{label}</Text>
        <Text style={[styles.vsBarValue, { color: "#7cb1ff" }]}>{theirs}</Text>
      </View>
      <View style={styles.vsBarTrack}>
        <View style={[styles.vsBarMine, { flex: mine / total || 0.02 }]} />
        <View style={styles.vsBarGap} />
        <View style={[styles.vsBarTheirs, { flex: theirs / total || 0.02 }]} />
      </View>
    </View>
  );
}

function FactCard({
  icon,
  title,
  big,
  sub,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  big: string;
  sub?: string;
}) {
  return (
    <View style={styles.factCard}>
      <View style={styles.factIconWrap}>
        <Ionicons name={icon} size={18} color="#3b82f6" />
      </View>
      <View style={styles.factBody}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text style={styles.factBig} numberOfLines={2}>{big}</Text>
        {sub ? <Text style={styles.factSub} numberOfLines={3}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 100 },

  // Rail
  rail: { gap: 14, paddingBottom: 16, paddingRight: 8 },
  railItem: { alignItems: "center", width: 64 },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRingActive: { borderColor: "#111214" },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  addCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#c3c8cf",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f8f9",
  },
  railName: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "500",
    color: "#868c94",
    maxWidth: 64,
  },
  railNameActive: { color: "#111214", fontWeight: "700" },

  // Add form
  addBox: {
    backgroundColor: "#f7f8f9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#ebebf0",
  },
  addTitle: { fontSize: 15, fontWeight: "700", color: "#111214", marginBottom: 4 },
  addHint: { fontSize: 12, color: "#868c94", lineHeight: 17, marginBottom: 12 },
  addRow: { flexDirection: "row", gap: 8 },
  addInput: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e6e8",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111214",
  },
  addBtn: {
    backgroundColor: "#111214",
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  addBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  addError: { marginTop: 10, fontSize: 12, color: "#ef4444" },

  // Empty / loading
  emptyBox: {
    marginTop: 8,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#e4e6e8",
    borderRadius: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: "#3d4249" },
  emptyDesc: {
    fontSize: 13,
    color: "#868c94",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 19,
  },
  loadingBox: { alignItems: "center", paddingVertical: 32, gap: 10 },
  loadingText: { fontSize: 13, color: "#868c94" },

  // Section
  sectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#868c94",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Filter chips + legend
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f2f2f7",
    borderWidth: 1,
    borderColor: "#ebebf0",
  },
  chipActive: { backgroundColor: "#111214", borderColor: "#111214" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#3d4249" },
  chipTextActive: { color: "#ffffff" },
  legendRow: { flexDirection: "row", gap: 14, marginBottom: 18 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#868c94", fontWeight: "500" },

  // VS card
  vsCardWrapper: { borderRadius: 20, overflow: "hidden", marginBottom: 22 },
  vsCard: { borderRadius: 20, padding: 20 },
  vsHeading: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
    marginBottom: 10,
  },
  vsColumns: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  vsCol: { flex: 1, alignItems: "center" },
  vsName: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.7)", marginBottom: 2 },
  vsPercent: { fontSize: 30, fontWeight: "800", color: "#ffffff" },
  vsDivider: { paddingHorizontal: 10 },
  vsVsText: { fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.35)" },
  vsBarBlock: { marginBottom: 10 },
  vsBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  vsBarValue: { fontSize: 13, fontWeight: "700", color: "#ffffff", minWidth: 24 },
  vsBarLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.5,
  },
  vsBarTrack: { flexDirection: "row", height: 5, borderRadius: 3, overflow: "hidden" },
  vsBarMine: { backgroundColor: "#ffffff", borderRadius: 3 },
  vsBarGap: { width: 3 },
  vsBarTheirs: { backgroundColor: "#3b82f6", borderRadius: 3 },
  vsFooter: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },

  // Fact cards
  factCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f0f1f2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  factIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  factBody: { flex: 1 },
  factTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#868c94",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  factBig: { fontSize: 16, fontWeight: "700", color: "#111214" },
  factSub: { fontSize: 12, color: "#868c94", marginTop: 3, lineHeight: 17 },
});
