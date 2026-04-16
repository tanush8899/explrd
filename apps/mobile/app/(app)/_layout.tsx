import { Redirect, Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSession } from "@/lib/SessionContext";

export default function AppLayout() {
  const { loading, user } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafbfc" }}>
        <ActivityIndicator size="large" color="#111214" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
