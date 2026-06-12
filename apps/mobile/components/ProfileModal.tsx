import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/SessionContext";
import { signOut } from "@/lib/auth";
import { fetchProfile, updateProfile } from "@/lib/api";
import type { UserProfile } from "@explrd/shared";

const { height: SCREEN } = Dimensions.get("window");
const SHEET_H = Math.round(SCREEN * 0.88);
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function normalizeSlug(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ProfileModal({ visible, onClose }: Props) {
  const { session } = useSession();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Animation
  const translateY = useRef(new Animated.Value(SHEET_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_H,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load profile when modal opens
  useEffect(() => {
    if (!visible || !session?.access_token) return;
    setLoading(true);
    setError(null);
    fetchProfile(session.access_token)
      .then((p) => {
        setProfile(p);
        setDisplayName(p.display_name ?? "");
        setSlug(p.public_slug ?? "");
        setIsPublic(p.is_public);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load profile"))
      .finally(() => setLoading(false));
  }, [visible, session?.access_token]);

  const friendLink = profile?.public_slug && isPublic
    ? `${API_BASE}/u/${profile.public_slug}`
    : null;

  const handleSave = useCallback(async () => {
    if (!session?.access_token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(session.access_token, {
        display_name: displayName.trim(),
        public_slug: normalizeSlug(slug),
        is_public: isPublic,
      });
      setProfile(updated);
      setSlug(updated.public_slug ?? "");
      setIsPublic(updated.is_public);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }, [session?.access_token, saving, displayName, slug, isPublic]);

  const handleCopy = useCallback(async () => {
    if (!friendLink) return;
    await Clipboard.setStringAsync(friendLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [friendLink]);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          onClose();
          void signOut();
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dim backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY }], paddingBottom: insets.bottom + 8 },
        ]}
        pointerEvents="box-none"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} activeOpacity={0.7}>
              <View style={styles.closeCircle}>
                <Text style={styles.closeX}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator color="#3b82f6" />
              </View>
            )}

            {!loading && (
              <>
                {/* Display name */}
                <Text style={styles.fieldLabel}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor="#a5abb3"
                  returnKeyType="done"
                />

                {/* Username / slug */}
                <Text style={styles.fieldLabel}>Username</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputPrefix}>explrd.app/u/</Text>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={slug}
                    onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="your-username"
                    placeholderTextColor="#a5abb3"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>
                <Text style={styles.fieldHint}>
                  Letters, numbers and hyphens only. This is the link friends use to
                  add you.
                </Text>

                {/* Public toggle */}
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Public profile</Text>
                    <Text style={styles.toggleHint}>
                      Lets friends find your places by your username.
                    </Text>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    trackColor={{ true: "#111214", false: "#e4e6e8" }}
                    thumbColor="#ffffff"
                  />
                </View>

                {/* Save */}
                {error && <Text style={styles.errorText}>{error}</Text>}
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>

                {/* Friend link */}
                {friendLink && (
                  <View style={styles.linkCard}>
                    <View style={styles.linkCardTop}>
                      <Ionicons name="link" size={16} color="#3b82f6" />
                      <Text style={styles.linkCardTitle}>Your Friend Link</Text>
                    </View>
                    <Text style={styles.linkCardUrl} numberOfLines={1}>{friendLink}</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={handleCopy}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={copied ? "checkmark-circle" : "copy-outline"}
                        size={16}
                        color={copied ? "#10b981" : "#3b82f6"}
                      />
                      <Text style={[styles.copyBtnText, copied && { color: "#10b981" }]}>
                        {copied ? "Copied!" : "Copy link"}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.linkCardHint}>
                      Share this link so friends can add you in the Friends tab.
                    </Text>
                  </View>
                )}

                {!friendLink && !loading && (
                  <View style={styles.noLinkCard}>
                    <Ionicons name="person-add-outline" size={22} color="#868c94" style={{ marginBottom: 6 }} />
                    <Text style={styles.noLinkTitle}>Share your globe with friends</Text>
                    <Text style={styles.noLinkHint}>
                      Set a username and turn on Public Profile above, then save — you'll
                      get a shareable link so others can add you.
                    </Text>
                  </View>
                )}

                {/* Sign out */}
                <TouchableOpacity
                  style={styles.signOutBtn}
                  onPress={handleSignOut}
                  activeOpacity={0.8}
                >
                  <Ionicons name="log-out-outline" size={17} color="#ef4444" />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  handleRow: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: "#d1d1d6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
    minHeight: 44,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111214",
    letterSpacing: -0.4,
  },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e5e5ea",
    alignItems: "center",
    justifyContent: "center",
  },
  closeX: { fontSize: 13, color: "#3c3c43", fontWeight: "700" },

  body: { padding: 20, paddingBottom: 40 },
  centered: { paddingVertical: 48, alignItems: "center" },

  // Form fields
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#868c94",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#f7f8f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e6e8",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111214",
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  inputPrefix: {
    fontSize: 14,
    color: "#a5abb3",
    paddingRight: 2,
    paddingLeft: 2,
  },
  inputFlex: { flex: 1 },
  fieldHint: {
    fontSize: 12,
    color: "#a5abb3",
    marginTop: 5,
    lineHeight: 17,
  },

  // Toggle row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f1f2",
  },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: "#111214" },
  toggleHint: { fontSize: 12, color: "#868c94", marginTop: 2 },

  errorText: { color: "#ef4444", fontSize: 13, marginTop: 10 },

  // Save button
  saveBtn: {
    marginTop: 18,
    backgroundColor: "#111214",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },

  // Friend link card
  linkCard: {
    marginTop: 20,
    backgroundColor: "#eef4ff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#c7dbff",
  },
  linkCardTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  linkCardTitle: { fontSize: 13, fontWeight: "700", color: "#1d4ed8" },
  linkCardUrl: { fontSize: 13, color: "#2563eb", marginBottom: 10 },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 8,
  },
  copyBtnText: { fontSize: 13, fontWeight: "600", color: "#3b82f6" },
  linkCardHint: { fontSize: 11, color: "#6b8ac4", lineHeight: 16 },

  // No link nudge
  noLinkCard: {
    marginTop: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    borderRadius: 16,
  },
  noLinkTitle: { fontSize: 14, fontWeight: "600", color: "#3d4249", marginBottom: 6 },
  noLinkHint: {
    fontSize: 12,
    color: "#868c94",
    textAlign: "center",
    lineHeight: 18,
  },

  // Sign out
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginTop: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    backgroundColor: "#fff5f5",
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#ef4444" },
});
