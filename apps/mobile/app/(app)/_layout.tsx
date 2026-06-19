import React, { useEffect, useRef, useState } from "react";
import { Animated, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useSession } from "@/lib/SessionContext";
import { useProfile } from "@/lib/ProfileContext";
import { usePlaces } from "@/lib/PlacesContext";
import { usePhotoOnboardingGate } from "@/lib/photoOnboarding";
import SplashScreen from "@/components/SplashScreen";
import OnboardingProfile from "@/components/OnboardingProfile";
import PhotoSyncView from "@/components/photos/PhotoSyncView";

// Minimum visible time from mount so entrance animations always complete.
const MIN_SPLASH_MS = 1400;

export default function AppLayout() {
  const { loading: sessionLoading, user } = useSession();
  const { loading: profileLoading, needsUsername } = useProfile();
  const { loading: placesLoading } = usePlaces();

  // One-time "import places from your photos" step, sequenced after the username
  // step. Only evaluated once the user is signed in with a username set.
  const photoGate = usePhotoOnboardingGate(
    user?.id ?? null,
    !!user && !profileLoading && !needsUsername,
  );

  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const mountedAt = useRef(Date.now());

  // Wait until session, profile, and the initial places fetch are done before
  // fading. Past the username step, also wait on the photo-onboarding decision so
  // the app never flashes underneath before the import screen takes over.
  const photoGateResolved = needsUsername || photoGate.status !== "loading";
  const allReady =
    !sessionLoading && !profileLoading && !placesLoading && photoGateResolved;

  useEffect(() => {
    if (!allReady) return;

    const elapsed = Date.now() - mountedAt.current;
    const holdMs  = Math.max(0, MIN_SPLASH_MS - elapsed);

    const id = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 520,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, holdMs);

    return () => clearTimeout(id);
  }, [allReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }}>
      {/* Real content renders underneath while the splash is still visible.
          The map and sheet get time to hydrate before they are revealed. */}
      {!sessionLoading && (
        !user ? (
          <Redirect href="/(auth)/login" />
        ) : profileLoading ? null : needsUsername ? (
          <OnboardingProfile />
        ) : photoGate.status === "needed" ? (
          <PhotoSyncView mode="onboarding" onClose={photoGate.markDone} />
        ) : photoGate.status === "loading" ? null : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="photo-sync" options={{ presentation: "modal" }} />
          </Stack>
        )
      )}

      {showSplash && <SplashScreen opacity={splashOpacity} />}
    </View>
  );
}
