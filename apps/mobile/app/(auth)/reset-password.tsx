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
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { updatePassword } from "@/lib/auth";
import { colors, gradients } from "@/lib/theme";

const BLUE = colors.blue;

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
    <LinearGradient colors={gradients.auth} style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.wordmark}>Explr</Text>
            <Text style={styles.tagline}>Track every place you've been.</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>New password</Text>

              {done ? (
                <View style={{ gap: 16 }}>
                  <Text style={styles.body}>
                    Your password has been updated. You can now sign in with
                    your new password.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.replace("/(auth)/login")}
                    style={styles.submitBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.submitText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* New password */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
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

                  {/* Confirm password */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                    <TextInput
                      value={confirm}
                      onChangeText={setConfirm}
                      placeholder="••••••••"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                      style={styles.input}
                      placeholderTextColor="#5a6070"
                    />
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={styles.submitBtn}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.submitText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
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
  body: { fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.7)" },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
  },
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
  passwordRow: { flexDirection: "row", alignItems: "center" },
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
  },
  submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
