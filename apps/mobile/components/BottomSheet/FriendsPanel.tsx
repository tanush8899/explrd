import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
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
import type {
  SavedPlace,
  ExplrdStats,
  FriendSummary,
  FriendRequestSummary,
} from "@explrd/shared";
import { SheetScrollContext } from "@/components/Sheet";
import Avatar, { initialsOf } from "@/components/Avatar";
import { useSession } from "@/lib/SessionContext";
import { useFriends, type FriendMapFilter } from "@/lib/FriendsContext";
import { searchUsers } from "@/lib/api";
import {
  hapticSelection,
  hapticSuccess,
  hapticError,
  hapticWarning,
} from "@/lib/haptics";
import { colors } from "@/lib/theme";
import { gradients } from "@/lib/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nameOf(f: FriendSummary): string {
  return f.display_name ?? f.username ?? "Explorer";
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
  const { session } = useSession();
  const {
    friends,
    incoming,
    outgoing,
    loading,
    selectedId,
    selectedData,
    loadingId,
    mapFilter,
    setMapFilter,
    selectFriend,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNote, setAddNote] = useState<string | null>(null);
  const [addBusyId, setAddBusyId] = useState<string | null>(null);
  const [busyReq, setBusyReq] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  const myStats = useMemo(() => getExplrdStats(myPlaces), [myPlaces]);

  // Relationship lookups so search rows can show "Friends" / "Pending".
  const friendIds = useMemo(() => new Set(friends.map((f) => f.user_id)), [friends]);
  const outgoingIds = useMemo(() => new Set(outgoing.map((r) => r.user_id)), [outgoing]);

  // ── Live people search (name or @username) ────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setAddError(null);
    setAddNote(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = text.trim();
    if (q.length < 2) {
      searchAbortRef.current?.abort();
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      if (!session?.access_token) return;
      searchAbortRef.current?.abort();
      searchAbortRef.current = new AbortController();
      setSearching(true);
      try {
        const res = await searchUsers(session.access_token, q, searchAbortRef.current.signal);
        setSearchResults(res);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  useEffect(
    () => () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchAbortRef.current?.abort();
    },
    [],
  );

  const handleAddUser = async (target: FriendSummary) => {
    if (addBusyId || !target.username) return;
    setAddBusyId(target.user_id);
    setAddError(null);
    setAddNote(null);
    try {
      const status = await sendRequest(target.username);
      hapticSuccess();
      setAddNote(
        status === "accepted"
          ? `You're now friends with ${firstName(nameOf(target))}! 🎉`
          : `Request sent to ${firstName(nameOf(target))} — waiting on them to accept.`,
      );
      setSearchQuery("");
      setSearchResults([]);
    } catch (e) {
      hapticError();
      setAddError(e instanceof Error ? e.message : "Couldn't send request.");
    } finally {
      setAddBusyId(null);
    }
  };

  const handleAccept = async (req: FriendRequestSummary) => {
    setBusyReq(req.request_id);
    try {
      await acceptRequest(req.request_id);
      hapticSuccess();
    } catch (e) {
      Alert.alert("Couldn't accept", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusyReq(null);
    }
  };

  const handleReject = async (req: FriendRequestSummary) => {
    setBusyReq(req.request_id);
    try {
      await rejectRequest(req.request_id);
    } catch (e) {
      Alert.alert("Couldn't decline", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusyReq(null);
    }
  };

  const confirmRemove = (friend: FriendSummary) => {
    Alert.alert("Remove Friend", `Remove ${nameOf(friend)} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          hapticWarning();
          void removeFriend(friend.user_id);
        },
      },
    ]);
  };

  const selectedFriend = friends.find((f) => f.user_id === selectedId) ?? null;

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
      {/* ── Find friends by name or @username ───────────────────────────────── */}
      <Text style={styles.sectionLabel}>ADD A FRIEND</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or @username"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {searching ? (
          <ActivityIndicator color={colors.muted} size="small" />
        ) : searchQuery.length > 0 ? (
          <TouchableOpacity
            onPress={() => handleSearchChange("")}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={18} color={colors.faint} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search results dropdown */}
      {searchQuery.trim().length >= 2 && (
        <View style={styles.searchResults}>
          {searchResults.length === 0 && !searching ? (
            <Text style={styles.searchEmpty}>No one found by that name.</Text>
          ) : (
            searchResults.map((u) => {
              const isFriend = friendIds.has(u.user_id);
              const isPending = outgoingIds.has(u.user_id);
              const busy = addBusyId === u.user_id;
              return (
                <View key={u.user_id} style={styles.resultRow}>
                  <Avatar
                    uri={u.avatar_url}
                    name={nameOf(u)}
                    idKey={u.user_id}
                    size={40}
                    textStyle={styles.resultAvatarText}
                  />
                  <View style={styles.resultMid}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {nameOf(u)}
                    </Text>
                    {u.username && (
                      <Text style={styles.resultHandle} numberOfLines={1}>
                        @{u.username}
                      </Text>
                    )}
                  </View>
                  {isFriend ? (
                    <View style={styles.resultTag}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                      <Text style={[styles.resultTagText, { color: colors.success }]}>
                        Friends
                      </Text>
                    </View>
                  ) : isPending ? (
                    <View style={styles.resultTag}>
                      <Text style={styles.resultTagText}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.resultAddBtn}
                      onPress={() => handleAddUser(u)}
                      disabled={busy}
                      activeOpacity={0.8}
                    >
                      {busy ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.resultAddText}>Add</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
      {addError && <Text style={styles.addError}>{addError}</Text>}
      {addNote && <Text style={styles.addNote}>{addNote}</Text>}

      {/* ── Incoming requests ───────────────────────────────────────────────── */}
      {incoming.length > 0 && (
        <View style={styles.requestsBlock}>
          <Text style={styles.sectionLabel}>
            FRIEND REQUESTS ({incoming.length})
          </Text>
          {incoming.map((req) => (
            <View key={req.request_id} style={styles.requestRow}>
              <Avatar
                uri={req.avatar_url}
                name={nameOf(req)}
                idKey={req.user_id}
                size={44}
                textStyle={styles.requestAvatarText}
              />
              <View style={styles.requestMid}>
                <Text style={styles.requestName} numberOfLines={1}>
                  {nameOf(req)}
                </Text>
                {req.username && (
                  <Text style={styles.requestHandle} numberOfLines={1}>
                    @{req.username}
                  </Text>
                )}
              </View>
              {busyReq === req.request_id ? (
                <ActivityIndicator color={colors.blue} style={{ marginRight: 8 }} />
              ) : (
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => handleReject(req)}
                    activeOpacity={0.7}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={20} color={colors.inkSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAccept(req)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Friend rail ─────────────────────────────────────────────────────── */}
      {(friends.length > 0 || outgoing.length > 0) && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>YOUR FRIENDS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {friends.map((friend) => {
              const isSelected = friend.user_id === selectedId;
              const isLoading = friend.user_id === loadingId;
              return (
                <TouchableOpacity
                  key={friend.user_id}
                  style={styles.railItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticSelection();
                    selectFriend(isSelected ? null : friend);
                  }}
                  onLongPress={() => confirmRemove(friend)}
                >
                  <View style={[styles.avatarRing, isSelected && styles.avatarRingActive]}>
                    {isLoading ? (
                      <View style={[styles.avatar, styles.avatarLoading]}>
                        <ActivityIndicator color="#ffffff" size="small" />
                      </View>
                    ) : (
                      <Avatar
                        uri={friend.avatar_url}
                        name={nameOf(friend)}
                        idKey={friend.user_id}
                        size={54}
                        textStyle={styles.avatarText}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.railName, isSelected && styles.railNameActive]}
                    numberOfLines={1}
                  >
                    {firstName(nameOf(friend))}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Pending outgoing — dimmed, with a tap-to-withdraw */}
            {outgoing.map((req) => (
              <TouchableOpacity
                key={req.request_id}
                style={styles.railItem}
                activeOpacity={0.8}
                onPress={() =>
                  Alert.alert(
                    "Pending request",
                    `Waiting for ${nameOf(req)} to accept. Withdraw it?`,
                    [
                      { text: "Keep waiting", style: "cancel" },
                      {
                        text: "Withdraw",
                        style: "destructive",
                        onPress: () => void removeFriend(req.user_id),
                      },
                    ],
                  )
                }
              >
                <View style={[styles.avatarRing, styles.avatarRingPending]}>
                  <View style={styles.pendingAvatar}>
                    <Text style={styles.pendingAvatarText}>{initialsOf(nameOf(req))}</Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Ionicons name="time" size={11} color="#ffffff" />
                  </View>
                </View>
                <Text style={styles.railName} numberOfLines={1}>
                  {firstName(nameOf(req))}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {loading && friends.length === 0 && incoming.length === 0 && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.blue} />
        </View>
      )}

      {!loading && friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptyDesc}>
            Add a friend by their @username above. Once they accept, you'll see
            their globe and how your travels compare.
          </Text>
        </View>
      )}

      {friends.length > 0 && !selectedFriend && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Pick a friend</Text>
          <Text style={styles.emptyDesc}>
            Tap a friend above to light up their places on the globe and see how
            your adventures compare.
          </Text>
        </View>
      )}

      {selectedFriend && !selectedData && loadingId === selectedFriend.user_id && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>
            Loading {firstName(nameOf(selectedFriend))}'s globe…
          </Text>
        </View>
      )}

      {selectedFriend && selectedData && (
        <>
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
          <TouchableOpacity
            style={styles.removeFriendBtn}
            onPress={() => confirmRemove(selectedFriend)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-remove-outline" size={17} color={colors.danger} />
            <Text style={styles.removeFriendText}>
              Remove {firstName(nameOf(selectedFriend))}
            </Text>
          </TouchableOpacity>
        </>
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
        {mapFilter === "both" && <LegendDot color={colors.ink} label="You" />}
        <LegendDot color={colors.blue} label={friendFirst} />
        {mapFilter === "both" && <LegendDot color="#8b5cf6" label="Both of you" />}
      </View>

      {/* VS card */}
      <View style={styles.vsCardWrapper}>
        <LinearGradient
          colors={gradients.hero}
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
        <Ionicons name={icon} size={18} color={colors.blue} />
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

  // Find friends — search field + results dropdown
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.fill,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
  },
  searchResults: { marginTop: 8 },
  searchEmpty: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: 12,
    textAlign: "center",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  resultAvatarText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  resultMid: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  resultHandle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  resultAddBtn: {
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  resultAddText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  resultTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultTagText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  addError: { marginTop: 8, fontSize: 12, color: colors.danger },
  addNote: { marginTop: 8, fontSize: 12, color: colors.success, fontWeight: "500" },

  // Remove friend
  removeFriendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
  },
  removeFriendText: { fontSize: 15, fontWeight: "700", color: colors.danger },

  // Requests
  requestsBlock: { marginTop: 20 },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  requestAvatarText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  requestMid: { flex: 1, marginLeft: 12 },
  requestName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  requestHandle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  requestActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    backgroundColor: colors.blue,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  acceptBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },

  // Rail
  rail: { gap: 14, paddingVertical: 8, paddingRight: 8 },
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
  avatarRingActive: { borderColor: colors.ink },
  avatarRingPending: { opacity: 0.85 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLoading: { backgroundColor: "#9aa0a6" },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  pendingAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#c3c8cf",
  },
  pendingAvatarText: { fontSize: 16, fontWeight: "700", color: colors.muted },
  pendingBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  railName: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "500",
    color: colors.muted,
    maxWidth: 64,
  },
  railNameActive: { color: colors.ink, fontWeight: "700" },

  // Empty / loading
  emptyBox: {
    marginTop: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairline,
    borderRadius: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: colors.inkSecondary },
  emptyDesc: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 19,
  },
  loadingBox: { alignItems: "center", paddingVertical: 32, gap: 10 },
  loadingText: { fontSize: 13, color: colors.muted },

  // Section
  sectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
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
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.inkSecondary },
  chipTextActive: { color: "#ffffff" },
  legendRow: { flexDirection: "row", gap: 14, marginBottom: 18 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.muted, fontWeight: "500" },

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
  vsBarTheirs: { backgroundColor: colors.blue, borderRadius: 3 },
  vsFooter: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },

  // Fact cards
  factCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
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
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  factBody: { flex: 1 },
  factTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  factBig: { fontSize: 16, fontWeight: "700", color: colors.ink },
  factSub: { fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 17 },
});
