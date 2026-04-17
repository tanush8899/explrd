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
import ViewShot from "react-native-view-shot";
import { getExplrdStats } from "@explrd/shared";
import type { SavedPlace } from "@explrd/shared";
import { useSession } from "@/lib/SessionContext";
import PassportCard from "@/components/PassportCard";
import { generateShareLink } from "@/lib/api";

type Props = {
  places: SavedPlace[];
};

export default function SharePanel({ places }: Props) {
  const { session, user } = useSession();
  const shotRef = useRef<ViewShot>(null);
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
    return (shotRef.current as ViewShot).capture();
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
      <Text style={styles.title}>Share Your Passport</Text>

      {/* Passport card preview */}
      <View style={styles.cardWrapper}>
        <PassportCard ref={shotRef} displayName={displayName} stats={stats} />
      </View>

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Empty-state hint */}
      {places.length === 0 && (
        <Text style={styles.emptyHint}>
          Save some places first to populate your passport!
        </Text>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <ActionButton
          label="Share Passport Image"
          onPress={handleSharePassport}
          loading={capturing}
          primary
        />
        <ActionButton
          label="Save to Photos"
          onPress={handleSavePhoto}
          loading={capturing}
        />
        <ActionButton
          label="Copy & Share Link"
          onPress={handleShareLink}
          loading={linkLoading}
        />
      </View>
    </BottomSheetScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActionButton({
  label,
  onPress,
  loading,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={[styles.actionBtn, primary ? styles.actionBtnPrimary : styles.actionBtnSecondary]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? "#fff" : "#868c94"} />
      ) : (
        <Text style={[styles.actionBtnText, primary ? styles.actionBtnTextPrimary : styles.actionBtnTextSecondary]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 16, fontWeight: "600", color: "#111214", marginBottom: 16 },

  cardWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 16,
  },

  toast: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  toastText: { fontSize: 13, fontWeight: "500", color: "#166534" },

  emptyHint: {
    fontSize: 13,
    color: "#868c94",
    textAlign: "center",
    marginBottom: 12,
  },

  actions: { gap: 10 },
  actionBtn: {
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPrimary: { backgroundColor: "#111214" },
  actionBtnSecondary: {
    backgroundColor: "#f7f8f9",
    borderWidth: 1,
    borderColor: "#e4e6e8",
  },
  actionBtnText: { fontSize: 14, fontWeight: "600" },
  actionBtnTextPrimary: { color: "#ffffff" },
  actionBtnTextSecondary: { color: "#111214" },
});
