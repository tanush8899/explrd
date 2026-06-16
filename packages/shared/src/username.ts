/**
 * Username (handle) rules — shared by the API route and the mobile client so the
 * two can never drift. Instagram-flavoured: lowercase letters / numbers / single
 * dots / underscores, must start with a letter, 3–20 chars.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// A handful of words we never want someone to claim.
const RESERVED = new Set([
  "admin",
  "explrd",
  "explr",
  "support",
  "help",
  "about",
  "settings",
  "profile",
  "friends",
  "me",
  "you",
  "user",
  "root",
  "api",
  "u",
]);

export type UsernameCheck =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/**
 * Normalize + validate a raw username input. Returns the canonical (lowercased,
 * trimmed, leading-@-stripped) handle when valid, or a human-readable reason.
 */
export function validateUsername(raw: string): UsernameCheck {
  const value = raw.trim().replace(/^@+/, "").toLowerCase();

  if (value.length === 0) return { ok: false, reason: "Pick a username." };
  if (value.length < USERNAME_MIN)
    return { ok: false, reason: `At least ${USERNAME_MIN} characters.` };
  if (value.length > USERNAME_MAX)
    return { ok: false, reason: `At most ${USERNAME_MAX} characters.` };
  if (!/^[a-z]/.test(value))
    return { ok: false, reason: "Must start with a letter." };
  if (!/^[a-z0-9_.]+$/.test(value))
    return { ok: false, reason: "Only letters, numbers, _ and ." };
  if (/\.\./.test(value))
    return { ok: false, reason: "No consecutive dots." };
  if (/[._]$/.test(value))
    return { ok: false, reason: "Can't end with a dot or underscore." };
  if (RESERVED.has(value))
    return { ok: false, reason: "That username is reserved." };

  return { ok: true, value };
}

/** Strip a leading @ and lowercase — for live keystroke filtering in inputs. */
export function sanitizeUsernameInput(raw: string): string {
  return raw.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, USERNAME_MAX);
}
