import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  StyleSheet,
} from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as Clipboard from "expo-clipboard";
import { type ViewShotRef } from "react-native-view-shot";
import { getExplrdStats } from "@explrd/shared";
import type { SavedPlace } from "@explrd/shared";
import { useSession } from "@/lib/SessionContext";
import PassportCard from "@/components/PassportCard";
import { Icon } from "@/components/Glass";
import { generateShareLink } from "@/lib/api";

const BLUE = "#0a84ff";

type Props = {
  places: SavedPlace[];
};

export default function SharePanel({ places }: Props) {
  const { session, user } = useSession();
  const shotRef = useRef<ViewShotRef>(null);
  const [capturing, setCapturing] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const stats = getExplrdStats(places);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Explorer";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const captureCard = async (): Promise<string> => {
    if (!shotRef.current) throw new Error("Card not ready");
    return shotRef.current.capture();
  };

  // ── Share as image ──────────────────────────────────────────────────────────
  const handleSharePassport = async () => {
    setCapturing(true);
    try {
      const uri = await captureCard();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png" });
      } else {
        await Share.share({ url: uri });
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "";
      if (!msg.includes("cancelled") && !msg.includes("dismiss")) {
        Alert.alert("Error", "Could not share passport image.");
      }
    } finally {
      setCapturing(false);
    }
  };

  // ── Save to Photos ──────────────────────────────────────────────────────────
  const handleSavePhoto = async () => {
    setCapturing(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to save your passport card."
        );
        return;
      }
      const uri = await captureCard();
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast("Saved to Photos!");
    } catch {
      Alert.alert("Error", "Could not save to Photos.");
    } finally {
      setCapturing(false);
    }
  };

  // ── Share link ──────────────────────────────────────────────────────────────
  const handleShareLink = async () => {
    if (!session?.access_token) return;
    setLinkLoading(true);
    try {
      const { token } = await generateShareLink(session.access_token);
      const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
      const shareUrl = `${base}/s/${token}`;
      await Clipboard.setStringAsync(shareUrl);
      showToast("Link copied to clipboard!");
      await Share.share({
        message: `Check out my Explr passport: ${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      Alert.alert("Error", "Could not generate share link.");
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      {/* Passport card preview */}
      <View style={styles.cardWrapper}>
        <PassportCard ref={shotRef} displayName={displayName} stats={stats} />
      </View>

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Icon name="checkmark.circle.fill" fallback="✓" size={16} color="#30d158" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Empty-state hint */}
      {places.length === 0 && (
        <Text style={styles.emptyHint}>
          Save some places first to populate your passport!
        </Text>
      )}

      {/* Action buttons — Flighty blue pills */}
      <View style={styles.actions}>
        <ActionButton
          label="Share Passport"
          icon="square.and.arrow.up"
          fallbackIcon="↑"
          onPress={handleSharePassport}
          loading={capturing}
          primary
        />
        <View style={styles.secondaryRow}>
          <ActionButton
            label="Save to Photos"
            icon="square.and.arrow.down"
            fallbackIcon="↓"
            onPress={handleSavePhoto}
            loading={capturing}
            compact
          />
          <ActionButton
            label="Copy Link"
            icon="link"
            fallbackIcon="🔗"
            onPress={handleShareLink}
            loading={linkLoading}
            compact
          />
        </View>
      </View>
    </BottomSheetScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  fallbackIcon,
  onPress,
  loading,
  primary = false,
  compact = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  fallbackIcon: string;
  onPress: () => void;
  loading: boolean;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      style={[
        styles.actionBtn,
        primary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
        compact && styles.actionBtnCompact,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? "#fff" : "#3c3f44"} />
      ) : (
        <>
          <Icon
            name={icon}
            fallback={fallbackIcon}
            size={16}
            color={primary ? "#ffffff" : "#3c3f44"}
          />
          <Text
            style={[
              styles.actionBtnText,
              primary ? styles.actionBtnTextPrimary : styles.actionBtnTextSecondary,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 140 },

  cardWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#1a1040",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: 20,
  },

  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(48,209,88,0.10)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
  },
  toastText: { fontSize: 13, fontWeight: "600", color: "#1f7a36" },

  emptyHint: {
    fontSize: 13,
    color: "#85898f",
    textAlign: "center",
    marginBottom: 12,
  },

  actions: { gap: 10 },
  secondaryRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnCompact: { flex: 1, paddingVertical: 14 },
  actionBtnPrimary: {
    backgroundColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  actionBtnSecondary: {
    backgroundColor: "#eff1f3",
  },
  actionBtnText: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  actionBtnTextPrimary: { color: "#ffffff" },
  actionBtnTextSecondary: { color: "#3c3f44" },
});
