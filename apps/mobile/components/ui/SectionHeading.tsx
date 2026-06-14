import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, type as t } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  /** Optional trailing action ("See all" etc.) */
  actionLabel?: string;
  onAction?: () => void;
  /** Tighter top margin when it's the first thing in a section. */
  first?: boolean;
};

export default function SectionHeading({ children, actionLabel, onAction, first }: Props) {
  return (
    <View style={[styles.row, first && styles.first]}>
      <Text style={styles.title}>{children}</Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} activeOpacity={0.6}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  first: { marginTop: 4 },
  title: {
    ...t.title,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  action: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.blue,
    letterSpacing: -0.2,
  },
});
