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
import { sendPasswordReset } from "@/lib/auth";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
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
              Reset password
            </Text>

            {sent ? (
              <View className="gap-3">
                <Text className="text-sm text-muted leading-5">
                  Check your email — we sent a password reset link to{" "}
                  <Text className="text-ink font-medium">{email}</Text>.
                </Text>
                <Text className="text-xs text-muted">
                  Tap the link in the email to set a new password. It may take a
                  minute to arrive.
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-sm text-muted leading-5">
                  Enter your account email and we'll send you a link to reset
                  your password.
                </Text>

                <View className="gap-2">
                  <Text className="text-xs font-medium text-muted uppercase tracking-wide">
                    Email
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
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
                      Send reset link
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity onPress={() => router.back()} className="mt-6">
            <Text className="text-sm text-muted">
              Back to{" "}
              <Text className="text-ink font-medium">sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
