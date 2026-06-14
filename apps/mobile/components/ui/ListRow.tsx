import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type Props = {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Right-aligned text (e.g. a date or value). */
  meta?: string;
  trailing?: React.ReactNode;
  /** Show a chevron at the end (ignored when `trailing` is set). */
  chevron?: boolean;
  onPress?: () => void;
  /** Hairline separator on top — used to stack rows in a card. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A single content row: optional leading element, title/subtitle, meta, trailing. */
export default function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  chevron,
  onPress,
  divider,
  style,
}: Props) {
  const Container: React.ComponentType<any> = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={[styles.row, divider && styles.divider, style]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      {leading}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {trailing}
      {!trailing && chevron ? (
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      ) : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink, letterSpacing: -0.2 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 1 },
  meta: { fontSize: 13, color: colors.muted, fontWeight: "500" },
});
