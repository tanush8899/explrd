import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tracks whether a user has been offered the one-time "import places from your
 * photos" step. Stored locally per user id:
 *
 *   • Brand-new sign-ups see it right after the username step.
 *   • Existing users (already past onboarding) see it once on their next launch.
 *   • After they import or skip, the flag is set and they're never prompted again
 *     — the profile "Sync from Photos" button is how they re-run it later.
 */

const storageKey = (userId: string) => `explrd:photoOnboardingSeen:${userId}`;

export async function hasSeenPhotoOnboarding(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(userId))) === "1";
  } catch {
    // Fail closed — a storage hiccup should never block entry into the app.
    return true;
  }
}

export async function markPhotoOnboardingSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), "1");
  } catch {
    // Best effort; worst case the prompt shows once more next launch.
  }
}

export type PhotoOnboardingStatus = "loading" | "needed" | "done";

/**
 * Drives the onboarding gate. `ready` should be true only once the user is past
 * the username step (signed in, profile loaded, username set) so the photo step
 * always sequences *after* identity setup.
 */
export function usePhotoOnboardingGate(userId: string | null, ready: boolean) {
  const [status, setStatus] = useState<PhotoOnboardingStatus>("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    if (!ready || !userId) return;
    hasSeenPhotoOnboarding(userId).then((seen) => {
      if (active) setStatus(seen ? "done" : "needed");
    });
    return () => {
      active = false;
    };
  }, [ready, userId]);

  const markDone = useCallback(() => {
    if (userId) void markPhotoOnboardingSeen(userId);
    setStatus("done");
  }, [userId]);

  return { status, markDone };
}
