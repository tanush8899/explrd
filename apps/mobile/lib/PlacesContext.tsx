import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { SavedPlace } from "@explrd/shared";
import { fetchMyPlaces, deletePin, updatePlaceNotes } from "./api";
import { useSession } from "./SessionContext";

type PlacesCtx = {
  places: SavedPlace[];
  loading: boolean;
  setPlaces: React.Dispatch<React.SetStateAction<SavedPlace[]>>;
  refresh: () => Promise<void>;
  deletePlace: (placeId: string) => Promise<void>;
  /** Set/clear a place's private note. Updates optimistically, reconciling with
   *  the server's normalized value (trimmed/clamped/empty→null). */
  updateNotes: (placeId: string, notes: string | null) => Promise<void>;
};

const PlacesContext = createContext<PlacesCtx>({
  places: [],
  loading: true,
  setPlaces: () => {},
  refresh: async () => {},
  deletePlace: async () => {},
  updateNotes: async () => {},
});

export function PlacesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMyPlaces(session.access_token)
      .then(setPlaces)
      .catch((e) => console.warn("PlacesContext initial fetch:", e))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const refresh = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await fetchMyPlaces(session.access_token);
      setPlaces(data);
    } catch (e) {
      console.warn("PlacesContext refresh:", e);
    }
  }, [session?.access_token]);

  const deletePlace = useCallback(
    async (placeId: string) => {
      if (!session?.access_token) throw new Error("No session");
      await deletePin(session.access_token, placeId);
      setPlaces((prev) => prev.filter((p) => p.place_id !== placeId));
    },
    [session?.access_token],
  );

  const updateNotes = useCallback(
    async (placeId: string, notes: string | null) => {
      if (!session?.access_token) throw new Error("No session");
      const saved = await updatePlaceNotes(session.access_token, placeId, notes);
      setPlaces((prev) =>
        prev.map((p) => (p.place_id === placeId ? { ...p, notes: saved } : p)),
      );
    },
    [session?.access_token],
  );

  return (
    <PlacesContext.Provider
      value={{ places, loading, setPlaces, refresh, deletePlace, updateNotes }}
    >
      {children}
    </PlacesContext.Provider>
  );
}

export function usePlaces() {
  return useContext(PlacesContext);
}
