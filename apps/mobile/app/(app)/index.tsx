import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSession } from "@/lib/SessionContext";
import { signOut } from "@/lib/auth";

/**
 * Main screen placeholder — replaced in Chunk 2 with the full
 * map + bottom sheet layout once auth is proven on device.
 */
export default function MainScreen() {
  const { user } = useSession();

  return (
    <View className="flex-1 items-center justify-center bg-card gap-4 px-8">
      <Text className="text-2xl font-bold text-ink">Explr</Text>
      <Text className="text-sm text-muted text-center">
        Signed in as {user?.email ?? "unknown"}
      </Text>
      <Text className="text-xs text-muted text-center mt-2">
        ✓ Auth is working. Chunk 2 will add the map + place tracking.
      </Text>
      <TouchableOpacity
        onPress={signOut}
        className="mt-6 border border-gray-200 rounded-2xl px-6 py-3"
      >
        <Text className="text-sm text-ink font-medium">Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}
