import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { registerPushToken } from "./api";

/**
 * Push notifications (Expo).
 *
 * The app registers its Expo push token with the backend (POST /api/push-token)
 * after sign-in; the friend-request API routes fan notifications out through
 * Expo's push service.
 *
 * IMPORTANT: expo-notifications / expo-device are NATIVE modules — they only
 * exist in a build created after they were added (a fresh dev client or EAS
 * build). On an older binary, even `require`-ing them throws at evaluation
 * ("Cannot find native module 'ExpoPushTokenManager'") and crashes the whole
 * app — and Metro's inline-requires move that throw outside any surrounding
 * try/catch, so it can't be swallowed there. Instead we first ask
 * expo-modules-core (which is always present) whether the underlying native
 * modules are registered; only then do we require the JS packages. When they're
 * absent, every push path no-ops and the rest of the app (map, notes, …) runs
 * fine. Push starts working once the app is rebuilt with the modules included.
 */

type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");

// `undefined` = not resolved yet, `null` = resolved and unavailable.
let _notifications: NotificationsModule | null | undefined;
let _device: DeviceModule | null | undefined;

/** True only when the push native modules are baked into this binary.
 *  requireOptionalNativeModule returns null (never throws) when they aren't. */
function pushNativeAvailable(): boolean {
  return (
    !!requireOptionalNativeModule("ExpoPushTokenManager") &&
    !!requireOptionalNativeModule("ExpoDevice")
  );
}

function loadNotifications(): NotificationsModule | null {
  if (_notifications === undefined) {
    _notifications = pushNativeAvailable()
      ? (require("expo-notifications") as NotificationsModule)
      : null;
  }
  return _notifications;
}

function loadDevice(): DeviceModule | null {
  if (_device === undefined) {
    _device = pushNativeAvailable()
      ? (require("expo-device") as DeviceModule)
      : null;
  }
  return _device;
}

/** EAS project id, needed by getExpoPushTokenAsync in standalone builds. */
function getProjectId(): string | undefined {
  try {
    const Constants = require("expo-constants").default as {
      expoConfig?: { extra?: { eas?: { projectId?: string } } };
      easConfig?: { projectId?: string };
    };
    return (
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      undefined
    );
  } catch {
    return undefined;
  }
}

let _handlerInstalled = false;
function ensureHandler(N: NotificationsModule) {
  if (_handlerInstalled) return;
  _handlerInstalled = true;
  try {
    // Show the banner + play a sound even when the app is foregrounded.
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // ignore — handler is best-effort
  }
}

/**
 * Ask for permission, fetch this device's Expo push token, and register it with
 * the backend. Returns the token, or null when push is unavailable/declined.
 */
export async function registerForPushNotifications(
  accessToken: string,
): Promise<string | null> {
  try {
    const N = loadNotifications();
    const Device = loadDevice();
    if (!N || !Device) return null; // native modules absent in this binary
    if (!Device.isDevice) return null; // simulators can't receive push

    ensureHandler(N);

    const existing = await N.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const req = await N.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Default",
        importance: N.AndroidImportance.DEFAULT,
      });
    }

    const projectId = getProjectId();
    const { data: token } = await N.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token) return null;

    await registerPushToken(accessToken, token, Platform.OS);
    return token;
  } catch (e) {
    console.warn("registerForPushNotifications:", e);
    return null;
  }
}

type PushData = { type?: string; screen?: string } & Record<string, unknown>;

/**
 * Registers for push on sign-in and keeps the social graph fresh: refreshes when
 * a friend notification arrives in the foreground or is tapped from the
 * background. No-ops entirely when the native modules aren't in the build.
 */
export function usePushNotifications(
  accessToken: string | null,
  onFriendUpdate?: (data: PushData) => void,
): void {
  const cbRef = useRef(onFriendUpdate);
  cbRef.current = onFriendUpdate;

  useEffect(() => {
    if (!accessToken) return;

    const N = loadNotifications();
    if (!N) return; // no native module → nothing to wire up

    void registerForPushNotifications(accessToken);

    const isFriendEvent = (data: PushData) =>
      data?.type === "friend_request" || data?.type === "friend_accept";

    try {
      const received = N.addNotificationReceivedListener((n) => {
        const data = (n.request.content.data ?? {}) as PushData;
        if (isFriendEvent(data)) cbRef.current?.(data);
      });
      const responded = N.addNotificationResponseReceivedListener((r) => {
        const data = (r.notification.request.content.data ?? {}) as PushData;
        cbRef.current?.(data);
      });
      return () => {
        received.remove();
        responded.remove();
      };
    } catch {
      return undefined;
    }
  }, [accessToken]);
}
