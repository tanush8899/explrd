import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sanitizeUsernameInput, validateUsername } from "@explrd/shared";
import { useSession } from "@/lib/SessionContext";
import { useProfile } from "@/lib/ProfileContext";
import { checkUsernameAvailable, updateProfile } from "@/lib/api";
import { colors, gradients } from "@/lib/theme";

type AvailState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "bad"; reason: string };

/**
 * Mandatory one-time identity step. Shown (in place of the app) whenever the
 * signed-in user has no username yet — covers fresh sign-ups, Google OAuth, and
 * legacy accounts created before handles existed.
 */
export default function OnboardingProfile() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { profile, refresh, setProfile } = useProfile();

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avail, setAvail] = useState<AvailState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced live availability check.
  useEffect(() => {
    const check = validateUsername(username);
    if (!check.ok) {
      setAvail(username.length === 0 ? { kind: "idle" } : { kind: "bad", reason: check.reason });
      return;
    }
    if (!session?.access_token) return;
    setAvail({ kind: "checking" });
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await checkUsernameAvailable(session.access_token, check.value, ctrl.signal);
        setAvail(r.available ? { kind: "ok" } : { kind: "bad", reason: r.reason ?? "Taken." });
      } catch (e) {
        if (!ctrl.signal.aborted) setAvail({ kind: "idle" });
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(id);
    };
  }, [username, session?.access_token]);

  // Gate on a valid format + a name. The availability check is advisory — block
  // only when it explicitly reports "taken"; the server is the final authority
  // on save (returns 409), so a flaky check can never soft-lock onboarding.
  const formatValid = validateUsername(username).ok;
  const canSubmit =
    firstName.trim().length > 0 && formatValid && avail.kind !== "bad" && !submitting;

  async function handleSubmit() {
    if (!session?.access_token || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateProfile(session.access_token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username,
      });
      setProfile(updated);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your profile.");
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
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            This is how friends will find and recognize you on explrd.
          </Text>

          <View style={styles.card}>
            <View style={styles.nameRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>FIRST NAME</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Tanush"
                  placeholderTextColor="#5a6070"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>LAST NAME</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Sanjay"
                  placeholderTextColor="#5a6070"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>USERNAME</Text>
              <View style={styles.usernameRow}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  style={[styles.input, styles.usernameInput]}
                  value={username}
                  onChangeText={(v) => setUsername(sanitizeUsernameInput(v))}
                  placeholder="tanush"
                  placeholderTextColor="#5a6070"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <View style={styles.availIcon}>
                  {avail.kind === "checking" && (
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                  )}
                  {avail.kind === "ok" && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  )}
                  {avail.kind === "bad" && (
                    <Ionicons name="close-circle" size={20} color="#ff6961" />
                  )}
                </View>
              </View>
              <Text style={[styles.hint, avail.kind === "bad" && styles.hintBad]}>
                {avail.kind === "bad"
                  ? avail.reason
                  : avail.kind === "ok"
                    ? "That username is available."
                    : "Letters, numbers, _ and . (3–20 characters)."}
              </Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[styles.submit, !canSubmit && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitText}>Continue</Text>
              )}
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
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 28,
    padding: 22,
    gap: 18,
  },
  nameRow: { flexDirection: "row", gap: 12 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
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
  usernameRow: { flexDirection: "row", alignItems: "center" },
  at: {
    fontSize: 17,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
    marginRight: 6,
  },
  usernameInput: { flex: 1, paddingRight: 44 },
  availIcon: {
    position: "absolute",
    right: 12,
    width: 22,
    alignItems: "center",
  },
  hint: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 7 },
  hintBad: { color: "#ff8a82" },
  error: { fontSize: 12, color: "#ff6961", textAlign: "center" },
  submit: {
    backgroundColor: colors.blue,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
