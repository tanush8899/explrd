import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { sanitizeUsernameInput, validateUsername } from "@explrd/shared";
import { SheetScrollContext } from "@/components/Sheet";
import { useSession } from "@/lib/SessionContext";
import { useProfile } from "@/lib/ProfileContext";
import { checkUsernameAvailable, updateProfile } from "@/lib/api";
import { colors, gradients, radius, space, type as t, shadow } from "@/lib/theme";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

type AvailState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "bad"; reason: string };

type Props = {
  displayName?: string;
  avatarLabel?: string;
};

/**
 * Profile editing, rendered inside the main bottom sheet. Identity is first name,
 * last name, and a unique @username (live availability check). Everyone is public,
 * so there's no visibility toggle — just a shareable handle.
 */
export default function ProfilePanel({ displayName: fallbackName, avatarLabel }: Props) {
  const { session } = useSession();
  const { profile, setProfile } = useProfile();
  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avail, setAvail] = useState<AvailState>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep local fields in sync if the profile loads/changes underneath us.
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setUsername(profile.username ?? "");
  }, [profile]);

  const usernameChanged = username !== (profile?.username ?? "");

  // Live availability check — only when the handle actually changed.
  useEffect(() => {
    if (!usernameChanged) {
      setAvail({ kind: "idle" });
      return;
    }
    const check = validateUsername(username);
    if (!check.ok) {
      setAvail({ kind: "bad", reason: check.reason });
      return;
    }
    if (!session?.access_token) return;
    setAvail({ kind: "checking" });
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await checkUsernameAvailable(session.access_token, check.value, ctrl.signal);
        setAvail(r.available ? { kind: "ok" } : { kind: "bad", reason: r.reason ?? "Taken." });
      } catch {
        if (!ctrl.signal.aborted) setAvail({ kind: "idle" });
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(id);
    };
  }, [username, usernameChanged, session?.access_token]);

  const heroName =
    [firstName, lastName].map((s) => s.trim()).filter(Boolean).join(" ") ||
    fallbackName ||
    "Explorer";
  const heroInitials = avatarLabel ?? heroName.slice(0, 2).toUpperCase();

  // Advisory availability — block only on a known-bad handle; server is final.
  const usernameOk = validateUsername(username).ok && avail.kind !== "bad";
  const canSave = firstName.trim().length > 0 && usernameOk && !saving;

  const handleSave = useCallback(async () => {
    if (!session?.access_token || !canSave) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile(session.access_token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }, [session?.access_token, canSave, firstName, lastName, username, setProfile]);

  const shareHandle = profile?.username ?? null;
  const profileLink = shareHandle ? `${API_BASE}/u/${shareHandle}` : null;

  const handleCopy = useCallback(async () => {
    if (!profileLink) return;
    await Clipboard.setStringAsync(profileLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [profileLink]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      onScrollEndDrag={(e) => {
        const { contentOffset, velocity } = e.nativeEvent;
        if (contentOffset.y <= 0 && (velocity?.y ?? 0) < -0.3) {
          onScrollEndDragAtTop(Math.abs(velocity?.y ?? 0));
        }
      }}
    >
      {/* ── Hero: how friends see you ───────────────────────────────────────── */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>{heroInitials}</Text>
        </View>
        <Text style={styles.heroName} numberOfLines={1}>
          {heroName}
        </Text>
        {shareHandle ? (
          <Text style={styles.heroHandle}>@{shareHandle}</Text>
        ) : null}
      </LinearGradient>

      {/* Name */}
      <View style={styles.nameRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
      </View>

      {/* Username */}
      <Text style={styles.fieldLabel}>Username</Text>
      <View style={styles.usernameRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={[styles.input, styles.usernameInput]}
          value={username}
          onChangeText={(v) => setUsername(sanitizeUsernameInput(v))}
          placeholder="username"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <View style={styles.availIcon}>
          {avail.kind === "checking" && <ActivityIndicator size="small" color={colors.muted} />}
          {avail.kind === "ok" && (
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          )}
          {avail.kind === "bad" && (
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          )}
        </View>
      </View>
      <Text style={[styles.fieldHint, avail.kind === "bad" && { color: colors.danger }]}>
        {avail.kind === "bad"
          ? avail.reason
          : avail.kind === "ok"
            ? "That username is available."
            : "This is the handle friends use to find you."}
      </Text>

      {/* Save */}
      {error && <Text style={styles.errorText}>{error}</Text>}
      <TouchableOpacity
        style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
        onPress={handleSave}
        disabled={!canSave}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.saveBtnText}>{saved ? "Saved ✓" : "Save Changes"}</Text>
        )}
      </TouchableOpacity>

      {/* Share handle */}
      {shareHandle && (
        <View style={styles.shareCard}>
          <View style={styles.shareTop}>
            <Ionicons name="person-add" size={16} color={colors.blue} />
            <Text style={styles.shareTitle}>Add me on explrd</Text>
          </View>
          <Text style={styles.shareHandleText}>@{shareHandle}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
            <Ionicons
              name={copied ? "checkmark-circle" : "copy-outline"}
              size={16}
              color={copied ? colors.success : colors.blue}
            />
            <Text style={[styles.copyBtnText, copied && { color: colors.success }]}>
              {copied ? "Copied!" : "Copy profile link"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.shareHint}>
            Friends can add you by searching this username in the Friends tab.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.xxl,
  },

  // Hero
  hero: {
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: "center",
    marginBottom: space.xxl,
    ...shadow.hero,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  heroAvatarText: { fontSize: 26, fontWeight: "800", color: colors.goldInk },
  heroName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onDark,
    letterSpacing: -0.5,
  },
  heroHandle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.onDarkSecondary,
    marginTop: 4,
  },

  // Fields
  nameRow: { flexDirection: "row", gap: 12 },
  fieldLabel: {
    ...t.eyebrow,
    marginBottom: 6,
    marginTop: space.lg,
  },
  input: {
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  usernameRow: { flexDirection: "row", alignItems: "center" },
  at: { fontSize: 16, fontWeight: "700", color: colors.muted, marginRight: 6 },
  usernameInput: { flex: 1, paddingRight: 44 },
  availIcon: { position: "absolute", right: 12, width: 22, alignItems: "center" },
  fieldHint: { fontSize: 12, color: colors.faint, marginTop: 6, lineHeight: 17 },

  errorText: { color: colors.danger, fontSize: 13, marginTop: 10 },

  // Save
  saveBtn: {
    marginTop: space.xl,
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },

  // Share handle
  shareCard: {
    marginTop: space.xl,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.18)",
  },
  shareTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  shareTitle: { fontSize: 13, fontWeight: "700", color: colors.bluePress },
  shareHandleText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.blue,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,122,255,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 8,
  },
  copyBtnText: { fontSize: 13, fontWeight: "600", color: colors.blue },
  shareHint: { fontSize: 11, color: "#6b8ac4", lineHeight: 16 },
});
