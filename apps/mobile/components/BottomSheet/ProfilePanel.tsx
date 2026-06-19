import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { sanitizeUsernameInput, validateUsername } from "@explrd/shared";
import { SheetScrollContext } from "@/components/Sheet";
import { useSession } from "@/lib/SessionContext";
import { useProfile } from "@/lib/ProfileContext";
import { checkUsernameAvailable, deleteAccount, updateProfile } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { selfAvatarUrl } from "@/lib/avatar";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";
import { colors, gradients, radius, space, type as t, shadow } from "@/lib/theme";

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
  const router = useRouter();
  const { session, user } = useSession();
  const { profile, setProfile } = useProfile();
  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  const avatarUri = selfAvatarUrl(user, profile);

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avail, setAvail] = useState<AvailState>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      hapticSuccess();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }, [session?.access_token, canSave, firstName, lastName, username, setProfile]);

  const shareHandle = profile?.username ?? null;

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account, your saved places, and your friends. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!session?.access_token) return;
            hapticWarning();
            setDeleting(true);
            try {
              await deleteAccount(session.access_token);
              await signOut();
            } catch (e) {
              setDeleting(false);
              Alert.alert(
                "Couldn't delete account",
                e instanceof Error ? e.message : "Please try again.",
              );
            }
          },
        },
      ],
    );
  }, [session?.access_token]);

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
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.heroAvatarImg} />
          ) : (
            <Text style={styles.heroAvatarText}>{heroInitials}</Text>
          )}
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

      {/* Import places from the photo library */}
      <TouchableOpacity
        style={styles.syncBtn}
        onPress={() => router.push("/photo-sync" as Href)}
        activeOpacity={0.8}
      >
        <View style={styles.syncIcon}>
          <Ionicons name="images-outline" size={18} color={colors.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.syncTitle}>Sync from Photos</Text>
          <Text style={styles.syncHint}>
            Scan your photo gallery to add any new places you've visited.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </TouchableOpacity>

      {/* Danger zone — delete account */}
      <View style={styles.dangerZone}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteAccount}
          disabled={deleting}
          activeOpacity={0.8}
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={17} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.deleteHint}>
          Permanently removes your account and all of your data.
        </Text>
      </View>
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
    overflow: "hidden",
  },
  heroAvatarText: { fontSize: 26, fontWeight: "800", color: colors.goldInk },
  heroAvatarImg: { width: "100%", height: "100%", borderRadius: 36 },
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

  // Sync from Photos
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: space.xxl,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
  },
  syncIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  syncTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  syncHint: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },

  // Danger zone — delete account
  dangerZone: {
    marginTop: space.xxl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  deleteBtnText: { fontSize: 15, fontWeight: "700", color: colors.danger },
  deleteHint: {
    fontSize: 12,
    color: colors.faint,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 17,
  },
});
