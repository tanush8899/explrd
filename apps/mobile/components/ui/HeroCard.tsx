import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { gradients, radius, shadow } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  /** Two/three-stop gradient. Defaults to the signature deep-navy hero. */
  gradient?: readonly [string, string, ...string[]];
  eyebrow?: string;
  title?: string;
  /** Footer button row ("All Stats ›"). */
  footerLabel?: string;
  onFooterPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The signature dark gradient hero — Flighty's "ALL-TIME PASSPORT" card. One
 * component for every gradient stat block (My Places, Passport score, Friends VS).
 */
export default function HeroCard({
  children,
  gradient = gradients.hero,
  eyebrow,
  title,
  footerLabel,
  onFooterPress,
  style,
}: Props) {
  return (
    <View style={[styles.wrapper, style]}>
      <LinearGradient
        colors={gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* soft specular highlight along the top edge */}
        <View pointerEvents="none" style={styles.specular} />

        {(eyebrow || title) && (
          <View style={styles.headerBlock}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
          </View>
        )}

        {children}

        {footerLabel ? (
          <TouchableOpacity
            style={styles.footer}
            activeOpacity={0.7}
            onPress={onFooterPress}
          >
            <Text style={styles.footerLabel}>{footerLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.lg,
    ...shadow.hero,
  },
  card: {
    borderRadius: radius.lg,
    padding: 20,
    overflow: "hidden",
  },
  specular: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 60,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerBlock: { marginBottom: 14 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  footerLabel: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
});
