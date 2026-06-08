import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { updatePassword } from "@/lib/auth";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-card"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text className="text-3xl font-bold text-ink tracking-tight mb-2">
            Explr
          </Text>
          <Text className="text-sm text-muted mb-10">
            Track every place you've been.
          </Text>

          <View className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-6 gap-4">
            <Text className="text-lg font-semibold text-ink">
              New password
            </Text>

            {done ? (
              <View className="gap-4">
                <Text className="text-sm text-muted leading-5">
                  Your password has been updated. You can now sign in with your
                  new password.
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace("/(auth)/login")}
                  className="bg-ink rounded-2xl py-3.5 items-center"
                >
                  <Text className="text-white text-sm font-semibold">
                    Back to sign in
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* New password */}
                <View className="gap-2">
                  <Text className="text-xs font-medium text-muted uppercase tracking-wide">
                    New password
                  </Text>
                  <View className="flex-row items-center border border-gray-200 rounded-xl bg-surface">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      className="flex-1 px-4 py-3 text-sm text-ink"
                      placeholderTextColor="#868c94"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      className="px-4 py-3"
                    >
                      <Text className="text-xs text-muted">
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm password */}
                <View className="gap-2">
                  <Text className="text-xs font-medium text-muted uppercase tracking-wide">
                    Confirm password
                  </Text>
                  <TextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-ink bg-surface"
                    placeholderTextColor="#868c94"
                  />
                </View>

                {error ? (
                  <Text className="text-xs text-red-500 text-center">
                    {error}
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting}
                  className="bg-ink rounded-2xl py-3.5 items-center mt-1"
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">
                      Update password
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
