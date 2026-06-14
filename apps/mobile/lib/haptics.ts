import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Thin, safe wrappers over expo-haptics.
 *
 * Haptics are an iOS-first delight; on Android / web we no-op rather than risk
 * inconsistent buzzes. Every call is fire-and-forget — failures (e.g. simulator)
 * are swallowed so a missing taptic engine never throws into render/gesture code.
 */

const enabled = Platform.OS === "ios";

function safe(run: () => Promise<void>) {
  if (!enabled) return;
  run().catch(() => {});
}

/** Light selection tick — sheet snap, tab change, chip select. */
export function tap() {
  safe(() => Haptics.selectionAsync());
}

/** Impact thud — buttons, pin drop. */
export function impact(strength: "light" | "medium" | "heavy" = "light") {
  const style =
    strength === "heavy"
      ? Haptics.ImpactFeedbackStyle.Heavy
      : strength === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  safe(() => Haptics.impactAsync(style));
}

/** Success notification — place saved / stamped. */
export function success() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Warning notification — destructive confirm / errors. */
export function warn() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export default { tap, impact, success, warn };
