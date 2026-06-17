import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@explrd/shared";

/**
 * The signed-in user's Google profile picture, if we have one. Prefers the live
 * auth metadata (available instantly on the client) and falls back to whatever
 * the profile row stored server-side.
 */
export function selfAvatarUrl(
  user: User | null | undefined,
  profile: UserProfile | null | undefined,
): string | null {
  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const fromMeta = meta?.avatar_url ?? meta?.picture;
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  return profile?.avatar_url ?? null;
}
