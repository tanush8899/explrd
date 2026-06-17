import * as Haptics from "expo-haptics";

/**
 * Thin, fire-and-forget wrappers around expo-haptics. Each is best-effort: if
 * the platform can't produce feedback (older device, simulator) the promise
 * rejection is swallowed so callers can sprinkle these in without try/catch.
 */

/** Light tap — navigation, selection, opening a menu. */
export function hapticSelection() {
  Haptics.selectionAsync().catch(() => {});
}

/** Soft bump — pressing a primary action / button. */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Firmer bump — a more consequential tap. */
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success buzz — a place saved, a friend added. */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning buzz — a destructive confirmation (remove friend, delete). */
export function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error buzz — an action failed. */
export function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
