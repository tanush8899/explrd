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
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@/lib/SessionContext";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogleNative,
} from "@/lib/auth";

type Mode = "login" | "signup";

const BLUE = "#0a84ff";

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
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#0c1023", "#080b16", "#05070d"]}
      style={styles.root}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo / wordmark */}
            <Text style={styles.wordmark}>Explr</Text>
            <Text style={styles.tagline}>Track every place you've been.</Text>

            {/* Glass card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {mode === "login" ? "Welcome back" : "Create account"}
              </Text>

              {/* Google button */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={googleLoading || submitting}
                style={styles.googleBtn}
                activeOpacity={0.85}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#111214" />
                ) : (
                  <>
                    <Text style={styles.googleG}>G</Text>
                    <Text style={styles.googleLabel}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  style={styles.input}
                  placeholderTextColor="#5a6070"
                />
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>PASSWORD</Text>
                  {mode === "login" && (
                    <TouchableOpacity
                      onPress={() => router.push("/(auth)/forgot-password")}
                    >
                      <Text style={styles.forgotLink}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleEmailSubmit}
                    style={[styles.input, styles.passwordInput]}
                    placeholderTextColor="#5a6070"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.showBtn}
                  >
                    <Text style={styles.showBtnText}>
                      {showPassword ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Submit */}
              <TouchableOpacity
                onPress={handleEmailSubmit}
                disabled={submitting || googleLoading}
                style={styles.submitBtn}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === "login" ? "Sign In" : "Create Account"}
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
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {mode === "login"
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <Text style={styles.toggleAction}>
                  {mode === "login" ? "Sign up" : "Sign in"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06080d",
  },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  wordmark: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: "#ffffff",
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 40,
  },

  // Frosted dark card
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#ffffff",
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 14,
  },
  googleG: { fontSize: 16, fontWeight: "700", color: "#4285F4" },
  googleLabel: { fontSize: 15, fontWeight: "600", color: "#111214" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.10)" },
  dividerText: { fontSize: 12, color: "rgba(255,255,255,0.4)" },

  fieldGroup: { gap: 8 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
  },
  forgotLink: { fontSize: 12, color: BLUE },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#ffffff",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: { flex: 1, paddingRight: 64 },
  showBtn: {
    position: "absolute",
    right: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  showBtnText: { fontSize: 12, color: "rgba(255,255,255,0.5)" },

  error: { fontSize: 12, color: "#ff6961", textAlign: "center" },

  submitBtn: {
    backgroundColor: BLUE,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 2,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },

  toggle: { marginTop: 28 },
  toggleText: { fontSize: 14, color: "rgba(255,255,255,0.55)" },
  toggleAction: { color: "#ffffff", fontWeight: "600" },
});
