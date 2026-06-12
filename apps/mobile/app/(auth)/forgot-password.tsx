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
import { sendPasswordReset } from "@/lib/auth";

const BLUE = "#0a84ff";

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
    <LinearGradient colors={["#0c1023", "#080b16", "#05070d"]} style={styles.root}>
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
              <Text style={styles.cardTitle}>Reset password</Text>

              {sent ? (
                <View style={{ gap: 12 }}>
                  <Text style={styles.body}>
                    Check your email — we sent a password reset link to{" "}
                    <Text style={styles.bodyStrong}>{email}</Text>.
                  </Text>
                  <Text style={styles.bodyDim}>
                    Tap the link in the email to set a new password. It may take
                    a minute to arrive.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.body}>
                    Enter your account email and we'll send you a link to reset
                    your password.
                  </Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>EMAIL</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      keyboardType="email-address"
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
                      <Text style={styles.submitText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity onPress={() => router.back()} style={styles.toggle}>
              <Text style={styles.toggleText}>
                Back to <Text style={styles.toggleAction}>sign in</Text>
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
  bodyStrong: { color: "#ffffff", fontWeight: "600" },
  bodyDim: { fontSize: 12, lineHeight: 18, color: "rgba(255,255,255,0.45)" },
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
  error: { fontSize: 12, color: "#ff6961", textAlign: "center" },
  submitBtn: {
    backgroundColor: BLUE,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 2,
  },
  submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  toggle: { marginTop: 28 },
  toggleText: { fontSize: 14, color: "rgba(255,255,255,0.55)" },
  toggleAction: { color: "#ffffff", fontWeight: "600" },
});
