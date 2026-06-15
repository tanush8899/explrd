import React from "react";
import { View, StyleSheet, type ViewProps } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

type Props = ViewProps & {
  /** Apply the default 16px inner padding. */
  padded?: boolean;
  /** Inset (flatter) variant — grey fill, no shadow. Used for nested tiles. */
  inset?: boolean;
};

/**
 * The one true white card. Every elevated surface in a panel should be a Card so
 * radius / border / shadow stay identical across screens (Flighty's consistency).
 */
export default function Card({ padded = true, inset = false, style, children, ...rest }: Props) {
  return (
    <View
      style={[
        inset ? styles.inset : styles.card,
        padded && styles.padded,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow.card,
  },
  inset: {
    backgroundColor: colors.fill,
    borderRadius: radius.md,
  },
  padded: {
    padding: 16,
  },
});
