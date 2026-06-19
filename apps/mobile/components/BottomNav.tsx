import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "@/components/Glass";
import { hapticSelection, hapticLight } from "@/lib/haptics";
import { colors, shadow as sh } from "@/lib/theme";

export type NavTab = "places" | "friends" | "passport";

const BLUE = colors.blue;
const INACTIVE = colors.muted;

type TabConfig = {
  key: NavTab;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconActive: React.ComponentProps<typeof Ionicons>["name"];
};

const TABS: TabConfig[] = [
  { key: "places", label: "My Places", icon: "location-outline", iconActive: "location-sharp" },
  { key: "friends", label: "Friends", icon: "people-outline", iconActive: "people" },
  { key: "passport", label: "Passport", icon: "book-outline", iconActive: "book" },
];

type Props = {
  activeTab: NavTab;
  onTabPress: (tab: NavTab) => void;
  onAdd: () => void;
  /** Count of pending incoming friend requests — shows a badge on Friends. */
  friendsBadge?: number;
};

export default function BottomNav({ activeTab, onTabPress, onAdd, friendsBadge = 0 }: Props) {
  return (
    <View style={styles.row}>
      {/* Liquid-glass tab pill — Flighty's floating bottom bar */}
      <GlassSurface style={styles.container} interactive transparent>
        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge = tab.key === "friends" ? friendsBadge : 0;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  hapticSelection();
                  onTabPress(tab.key);
                }}
                style={styles.tabItem}
                activeOpacity={0.7}
              >
                <View>
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={22}
                    color={isActive ? BLUE : INACTIVE}
                  />
                  {badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassSurface>

      {/* Circular search button — like Flighty's detached magnifier */}
      <GlassSurface style={styles.addBtn} interactive transparent>
        <TouchableOpacity
          style={styles.addTouch}
          onPress={() => {
            hapticLight();
            onAdd();
          }}
          activeOpacity={0.8}
          accessibilityLabel="Add a place"
        >
          <Ionicons name="search" size={22} color={colors.ink} />
        </TouchableOpacity>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginBottom: 2,
    gap: 8,
  },
  container: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6,
    ...sh.floating,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: INACTIVE,
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: BLUE,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 12,
  },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    ...sh.floating,
  },
  addTouch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
