import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  SavedPlace,
  ExplrdStats,
  FriendSummary,
  FriendRequestSummary,
} from "@explrd/shared";
import {
  fetchFriends,
  fetchPublicProfile,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend as apiRemoveFriend,
} from "./api";
import { useSession } from "./SessionContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FriendData = {
  displayName: string;
  places: SavedPlace[];
  stats: ExplrdStats;
  fetchedAt: number;
};

export type FriendMapFilter = "both" | "friend";

type FriendsCtx = {
  friends: FriendSummary[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
  loading: boolean;

  selectedId: string | null;
  /** Live globe data for the selected friend (null while loading or none selected). */
  selectedData: FriendData | null;
  loadingId: string | null;

  mapFilter: FriendMapFilter;
  setMapFilter: (f: FriendMapFilter) => void;

  refresh: () => Promise<void>;
  selectFriend: (friend: FriendSummary | null) => void;
  /** Send a friend request by @handle. Returns "accepted" if it merged a reverse request. */
  sendRequest: (username: string) => Promise<"pending" | "accepted">;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  /** Un-friend, or withdraw an outgoing request — both keyed by the other user's id. */
  removeFriend: (userId: string) => Promise<void>;
};

const noop = async () => {};

const FriendsContext = createContext<FriendsCtx>({
  friends: [],
  incoming: [],
  outgoing: [],
  loading: true,
  selectedId: null,
  selectedData: null,
  loadingId: null,
  mapFilter: "both",
  setMapFilter: () => {},
  refresh: noop,
  selectFriend: () => {},
  sendRequest: async () => "pending",
  acceptRequest: noop,
  rejectRequest: noop,
  removeFriend: noop,
});

const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { session, user } = useSession();
  const token = session?.access_token ?? null;

  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestSummary[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<FriendData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<FriendMapFilter>("both");

  // In-memory cache of fetched friend globes, keyed by username.
  const cacheRef = useRef<Map<string, FriendData>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // ── Load the social graph ─────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!token) {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
      return;
    }
    try {
      const payload = await fetchFriends(token);
      setFriends(payload.friends);
      setIncoming(payload.incoming);
      setOutgoing(payload.outgoing);
    } catch (e) {
      console.warn("FriendsContext refresh:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reset + reload whenever the signed-in user changes.
  useEffect(() => {
    setFriends([]);
    setIncoming([]);
    setOutgoing([]);
    setSelectedId(null);
    setSelectedData(null);
    cacheRef.current.clear();
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [user, refresh]);

  // ── Friend globe loading ──────────────────────────────────────────────────
  const loadFriendData = useCallback(
    async (username: string, fallbackName: string): Promise<FriendData> => {
      const cached = cacheRef.current.get(username);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
      const payload = await fetchPublicProfile(username);
      const data: FriendData = {
        displayName: payload.profile.display_name ?? fallbackName,
        places: payload.places,
        stats: payload.stats,
        fetchedAt: Date.now(),
      };
      cacheRef.current.set(username, data);
      return data;
    },
    [],
  );

  const selectFriend = useCallback(
    (friend: FriendSummary | null) => {
      const id = friend?.user_id ?? null;
      selectedIdRef.current = id;
      setSelectedId(id);
      setSelectedData(null);
      setMapFilter("both");
      if (!friend || !friend.username) return;
      setLoadingId(id);
      loadFriendData(friend.username, friend.display_name ?? friend.username)
        .then((data) => {
          if (selectedIdRef.current === id) setSelectedData(data);
        })
        .catch((e) => console.warn("FriendsContext select:", e))
        .finally(() => setLoadingId((cur) => (cur === id ? null : cur)));
    },
    [loadFriendData],
  );

  // ── Mutations (optimistic-ish: act, then refresh the graph) ───────────────
  const sendRequest = useCallback(
    async (username: string): Promise<"pending" | "accepted"> => {
      if (!token) throw new Error("Not signed in.");
      const res = await sendFriendRequest(token, username);
      await refresh();
      return res.status;
    },
    [token, refresh],
  );

  const acceptRequest = useCallback(
    async (requestId: string) => {
      if (!token) return;
      await respondToFriendRequest(token, requestId, "accept");
      await refresh();
    },
    [token, refresh],
  );

  const rejectRequest = useCallback(
    async (requestId: string) => {
      if (!token) return;
      await respondToFriendRequest(token, requestId, "reject");
      await refresh();
    },
    [token, refresh],
  );

  const removeFriend = useCallback(
    async (userId: string) => {
      if (!token) return;
      await apiRemoveFriend(token, userId);
      if (selectedIdRef.current === userId) {
        setSelectedId(null);
        setSelectedData(null);
      }
      await refresh();
    },
    [token, refresh],
  );

  const value = useMemo<FriendsCtx>(
    () => ({
      friends,
      incoming,
      outgoing,
      loading,
      selectedId,
      selectedData,
      loadingId,
      mapFilter,
      setMapFilter,
      refresh,
      selectFriend,
      sendRequest,
      acceptRequest,
      rejectRequest,
      removeFriend,
    }),
    [
      friends,
      incoming,
      outgoing,
      loading,
      selectedId,
      selectedData,
      loadingId,
      mapFilter,
      refresh,
      selectFriend,
      sendRequest,
      acceptRequest,
      rejectRequest,
      removeFriend,
    ],
  );

  return (
    <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
  );
}

export function useFriends() {
  return useContext(FriendsContext);
}
