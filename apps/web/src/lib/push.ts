import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Expo push notifications.
 *
 * Mobile devices register their Expo push token (POST /api/push-token); we store
 * them in `push_tokens` and fan out here via Expo's push service. Everything is
 * best-effort — a failed notification must never break the request that triggered
 * it (sending a friend request, accepting one, …), so all errors are swallowed.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  /** Arbitrary data delivered to the app (used to deep-link to the friends tab). */
  data?: Record<string, unknown>;
};

type TokenRow = { token: string };

function isExpoToken(t: unknown): t is string {
  return (
    typeof t === "string" &&
    (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
  );
}

/** Send a notification to every device registered to any of `userIds`. */
export async function sendPushToUsers(
  supabase: SupabaseClient,
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return;

    const { data, error } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", ids);
    if (error) return; // table not created yet, or transient — skip silently

    const tokens = ((data ?? []) as TokenRow[]).map((r) => r.token).filter(isExpoToken);
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      sound: "default" as const,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    // Expo accepts up to 100 messages per request.
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      }).catch(() => {});
    }
  } catch {
    // Never let notification delivery break the caller.
  }
}

/** Look up a user's display label for notification copy ("Alex sent you…"). */
export async function displayLabelFor(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, first_name, username")
      .eq("user_id", userId)
      .maybeSingle<{ display_name: string | null; first_name: string | null; username: string | null }>();
    return (
      data?.display_name ||
      data?.first_name ||
      (data?.username ? `@${data.username}` : "") ||
      "Someone"
    );
  } catch {
    return "Someone";
  }
}
