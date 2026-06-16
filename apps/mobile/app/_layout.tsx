import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { SessionProvider } from "@/lib/SessionContext";
import { ProfileProvider } from "@/lib/ProfileContext";
import { PlacesProvider } from "@/lib/PlacesContext";
import { FriendsProvider } from "@/lib/FriendsContext";
import { supabase } from "@/lib/supabaseClient";
import "../global.css";

function parseHashParams(url: string): Record<string, string> {
  const hash = url.includes("#") ? url.split("#")[1] : "";
  return Object.fromEntries(
    hash
      .split("&")
      .filter(Boolean)
      .map((pair) => {
        const [k, v] = pair.split("=");
        return [decodeURIComponent(k ?? ""), decodeURIComponent(v ?? "")];
      })
  );
}

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    async function handleURL(url: string | null) {
      if (!url) return;
      const params = parseHashParams(url);
      if (params.type === "recovery" && params.access_token) {
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token ?? "",
        });
        if (!error) {
          setTimeout(() => router.push("/(auth)/reset-password"), 100);
        }
      }
    }

    Linking.getInitialURL().then(handleURL);
    const sub = Linking.addEventListener("url", ({ url }) => handleURL(url));
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SessionProvider>
        <ProfileProvider>
          <PlacesProvider>
            <FriendsProvider>
              <DeepLinkHandler />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
                <Stack.Screen name="s/[token]" />
              </Stack>
            </FriendsProvider>
          </PlacesProvider>
        </ProfileProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
