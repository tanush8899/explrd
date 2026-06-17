import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticSelection } from "@/lib/haptics";
import { colors, radius, shadow as sh } from "@/lib/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export type AvatarAnchor = { x: number; y: number; width: number; height: number };

type Props = {
  visible: boolean;
  anchor: AvatarAnchor | null;
  displayName: string;
  avatarLabel: string;
  /** Google profile picture, when available. */
  avatarUri?: string | null;
  /** @username shown under the name (replaces the old "Explorer" subtitle). */
  handle?: string | null;
  onClose: () => void;
  onViewProfile: () => void;
  onSignOut: () => void;
};

const MENU_W = 244;
const GUTTER = 12;

/**
 * Flighty-style dropdown that springs out from the avatar. Renders in a Modal so
 * it floats above the sheet, with a tap-anywhere backdrop to dismiss.
 */
export default function AvatarMenu({
  visible,
  anchor,
  displayName,
  avatarLabel,
  avatarUri,
  handle,
  onClose,
  onViewProfile,
  onSignOut,
}: Props) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 140,
      friction: 12,
    }).start();
  }, [visible, progress]);

  if (!anchor) return null;

  // Right-align the card to the avatar; drop it just below. Clamp into the screen.
  const right = Math.max(GUTTER, SCREEN_W - (anchor.x + anchor.width));
  let top = anchor.y + anchor.height + 8;
  // If there isn't room below, flip above the avatar.
  const ESTIMATED_H = 188;
  if (top + ESTIMATED_H > SCREEN_H - insets.bottom - GUTTER) {
    top = Math.max(insets.top + GUTTER, anchor.y - ESTIMATED_H - 8);
  }

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.card,
          { top, right, opacity: progress, transform: [{ scale }, { translateY }] },
        ]}
      >
        {/* Identity header */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{avatarLabel}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {handle ? (
              <Text style={styles.sub} numberOfLines={1}>
                @{handle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.divider} />

        <MenuItem
          icon="person-circle-outline"
          label="View Profile"
          onPress={() => {
            onClose();
            onViewProfile();
          }}
        />
        <MenuItem
          icon="log-out-outline"
          label="Sign Out"
          danger
          onPress={() => {
            onClose();
            onSignOut();
          }}
        />
      </Animated.View>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      activeOpacity={0.6}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.ink} />
      <Text style={[styles.itemLabel, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: MENU_W,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 6,
    ...sh.floating,
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: colors.goldInk },
  avatarImg: { width: "100%", height: "100%" },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemLabel: { fontSize: 16, fontWeight: "500", color: colors.ink, letterSpacing: -0.2 },
});
