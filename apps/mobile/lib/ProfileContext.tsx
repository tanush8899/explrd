import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UserProfile } from "@explrd/shared";
import { fetchProfile } from "./api";
import { useSession } from "./SessionContext";

type ProfileCtx = {
  profile: UserProfile | null;
  loading: boolean;
  /** True once we've loaded and the user still has no username (→ onboarding). */
  needsUsername: boolean;
  refresh: () => Promise<void>;
  /** Optimistically replace the cached profile after a save. */
  setProfile: (p: UserProfile) => void;
};

const ProfileContext = createContext<ProfileCtx>({
  profile: null,
  loading: true,
  needsUsername: false,
  refresh: async () => {},
  setProfile: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session, user } = useSession();
  const token = session?.access_token ?? null;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const p = await fetchProfile(token);
      setProfile(p);
    } catch (e) {
      console.warn("ProfileContext load:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reload whenever the signed-in user changes (and clear on sign-out).
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [user, load]);

  const needsUsername = !loading && !!user && !profile?.username;

  const value = useMemo<ProfileCtx>(
    () => ({ profile, loading, needsUsername, refresh: load, setProfile }),
    [profile, loading, needsUsername, load],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
