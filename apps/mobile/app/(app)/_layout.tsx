import { Redirect, Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSession } from "@/lib/SessionContext";

export default function AppLayout() {
  const { loading, user } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#06080d" }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
