import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SessionProvider } from "@/lib/SessionContext";
import "../global.css";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
