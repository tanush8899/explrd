import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedPlace, ExplrdStats } from "@explrd/shared";
import { fetchPublicProfile } from "./api";
import { useSession } from "./SessionContext";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Persisted entry — places/stats are re-fetched, never stored (boundaries are big). */
export type FriendEntry = {
  slug: string;
  displayName: string;
  addedAt: string;
};

export type FriendData = {
  displayName: string;
  places: SavedPlace[];
  stats: ExplrdStats;
  fetchedAt: number;
};

export type FriendMapFilter = "both" | "friend";

type FriendsCtx = {
  friends: FriendEntry[];
  selectedSlug: string | null;
  /** Live data for the selected friend (null while loading or none selected). */
  selectedData: FriendData | null;
  loadingSlug: string | null;
  mapFilter: FriendMapFilter;
  setMapFilter: (f: FriendMapFilter) => void;
  selectFriend: (slug: string | null) => void;
  addFriend: (rawInput: string) => Promise<FriendEntry>;
  removeFriend: (slug: string) => Promise<void>;
};

const FriendsContext = createContext<FriendsCtx>({
  friends: [],
  selectedSlug: null,
  selectedData: null,
  loadingSlug: null,
  mapFilter: "both",
  setMapFilter: () => {},
  selectFriend: () => {},
  addFriend: async () => { throw new Error("FriendsProvider missing"); },
  removeFriend: async () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Accepts a bare slug or a full profile URL (…/u/<slug>) and normalizes it. */
export function normalizeSlugInput(raw: string): string {
  let s = raw.trim();
  const uIdx = s.lastIndexOf("/u/");
  if (uIdx !== -1) s = s.slice(uIdx + 3);
  return s.replace(/\/+$/, "").replace(/^@/, "").trim().toLowerCase();
}

const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const storageKey = user ? `explrd:friends:${user.id}` : null;

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<FriendData | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<FriendMapFilter>("both");

  // In-memory cache of fetched friend data, keyed by slug
  const cacheRef = useRef<Map<string, FriendData>>(new Map());
  // Mirrors selectedSlug so async fetch callbacks can detect stale selections
  const selectedSlugRef = useRef<string | null>(null);
  selectedSlugRef.current = selectedSlug;

  // Load persisted friend list when the signed-in user changes
  useEffect(() => {
    setFriends([]);
    setSelectedSlug(null);
    setSelectedData(null);
    cacheRef.current.clear();
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey)
      .then((json) => {
        if (json) setFriends(JSON.parse(json) as FriendEntry[]);
      })
      .catch((e) => console.warn("FriendsContext load:", e));
  }, [storageKey]);

  const persist = useCallback(
    (list: FriendEntry[]) => {
      if (!storageKey) return;
      AsyncStorage.setItem(storageKey, JSON.stringify(list)).catch((e) =>
        console.warn("FriendsContext persist:", e),
      );
    },
    [storageKey],
  );

  const loadFriendData = useCallback(async (slug: string): Promise<FriendData> => {
    const cached = cacheRef.current.get(slug);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
    const payload = await fetchPublicProfile(slug);
    const data: FriendData = {
      displayName: payload.profile.display_name ?? slug,
      places: payload.places,
      stats: payload.stats,
      fetchedAt: Date.now(),
    };
    cacheRef.current.set(slug, data);
    return data;
  }, []);

  const selectFriend = useCallback(
    (slug: string | null) => {
      selectedSlugRef.current = slug;
      setSelectedSlug(slug);
      setSelectedData(null);
      setMapFilter("both");
      if (!slug) return;
      setLoadingSlug(slug);
      loadFriendData(slug)
        .then((data) => {
          // Ignore if the user has since selected someone else
          if (selectedSlugRef.current === slug) setSelectedData(data);
        })
        .catch((e) => console.warn("FriendsContext select:", e))
        .finally(() => setLoadingSlug((s) => (s === slug ? null : s)));
    },
    [loadFriendData],
  );

  const addFriend = useCallback(
    async (rawInput: string): Promise<FriendEntry> => {
      const slug = normalizeSlugInput(rawInput);
      if (!slug) throw new Error("Enter your friend's profile link or username.");
      if (friends.some((f) => f.slug === slug)) {
        throw new Error("You've already added this friend.");
      }
      setLoadingSlug(slug);
      try {
        const data = await loadFriendData(slug);
        const entry: FriendEntry = {
          slug,
          displayName: data.displayName,
          addedAt: new Date().toISOString(),
        };
        setFriends((prev) => {
          const next = [...prev, entry];
          persist(next);
          return next;
        });
        selectedSlugRef.current = slug;
        setSelectedSlug(slug);
        setSelectedData(data);
        setMapFilter("both");
        return entry;
      } finally {
        setLoadingSlug((s) => (s === slug ? null : s));
      }
    },
    [friends, loadFriendData, persist],
  );

  const removeFriend = useCallback(
    async (slug: string) => {
      cacheRef.current.delete(slug);
      setFriends((prev) => {
        const next = prev.filter((f) => f.slug !== slug);
        persist(next);
        return next;
      });
      setSelectedSlug((current) => {
        if (current === slug) {
          setSelectedData(null);
          return null;
        }
        return current;
      });
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      friends,
      selectedSlug,
      selectedData,
      loadingSlug,
      mapFilter,
      setMapFilter,
      selectFriend,
      addFriend,
      removeFriend,
    }),
    [friends, selectedSlug, selectedData, loadingSlug, mapFilter, selectFriend, addFriend, removeFriend],
  );

  return (
    <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
  );
}

export function useFriends() {
  return useContext(FriendsContext);
}
