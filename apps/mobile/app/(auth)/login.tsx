"use client";

import { useEffect, useState } from "react";
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
import { useSession } from "@/lib/SessionContext";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogleNative,
} from "@/lib/auth";

type Mode = "login" | "signup";

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading } = useSession();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect once authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace("/(app)");
    }
  }, [user, loading]);

  async function handleEmailSubmit() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogleNative();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <ActivityIndicator size="large" color="#111214" />
      </View>
    );
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
          {/* Logo / wordmark */}
          <Text className="text-3xl font-bold text-ink tracking-tight mb-2">
            Explr
          </Text>
          <Text className="text-sm text-muted mb-10">
            Track every place you've been.
          </Text>

          {/* Card */}
          <View className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-6 gap-4">
            <Text className="text-lg font-semibold text-ink">
              {mode === "login" ? "Welcome back" : "Create account"}
            </Text>

            {/* Google button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={googleLoading || submitting}
              className="flex-row items-center justify-center gap-3 border border-gray-200 rounded-2xl py-3.5 px-4"
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#111214" />
              ) : (
                <>
                  {/* Google "G" in brand colours */}
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#4285F4" }}>G</Text>
                  <Text className="text-sm font-medium text-ink">
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center gap-3">
              <View className="flex-1 h-px bg-gray-100" />
              <Text className="text-xs text-muted">or</Text>
              <View className="flex-1 h-px bg-gray-100" />
            </View>

            {/* Email */}
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
                returnKeyType="next"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-ink bg-surface"
                placeholderTextColor="#868c94"
              />
            </View>

            {/* Password */}
            <View className="gap-2">
              <Text className="text-xs font-medium text-muted uppercase tracking-wide">
                Password
              </Text>
              <View className="flex-row items-center border border-gray-200 rounded-xl bg-surface">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleEmailSubmit}
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

            {/* Error */}
            {error ? (
              <Text className="text-xs text-red-500 text-center">{error}</Text>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleEmailSubmit}
              disabled={submitting || googleLoading}
              className="bg-ink rounded-2xl py-3.5 items-center mt-1"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-sm font-semibold">
                  {mode === "login" ? "Sign in" : "Create account"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Mode toggle */}
          <TouchableOpacity
            onPress={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setError(null);
            }}
            className="mt-6"
          >
            <Text className="text-sm text-muted">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <Text className="text-ink font-medium">
                {mode === "login" ? "Sign up" : "Sign in"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
