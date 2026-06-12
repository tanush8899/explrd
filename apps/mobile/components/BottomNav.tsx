import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "@/components/Glass";

export type NavTab = "places" | "friends" | "passport";

const BLUE = "#0a84ff";

type TabConfig = {
  key: NavTab;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const TABS: TabConfig[] = [
  { key: "places", label: "My Places", icon: "location-sharp" },
  { key: "friends", label: "Friends", icon: "people" },
  { key: "passport", label: "Passport", icon: "book" },
];

type Props = {
  activeTab: NavTab;
  onTabPress: (tab: NavTab) => void;
  onAdd: () => void;
};

export default function BottomNav({ activeTab, onTabPress, onAdd }: Props) {
  return (
    <View style={styles.row}>
      {/* Liquid-glass tab pill — Flighty's floating bottom bar */}
      <GlassSurface style={styles.container} interactive>
        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => onTabPress(tab.key)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={19}
                  color={isActive ? BLUE : "#5a5f66"}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassSurface>

      {/* Circular search button — like Flighty's detached magnifier */}
      <GlassSurface style={styles.addBtn} interactive>
        <TouchableOpacity
          style={styles.addTouch}
          onPress={onAdd}
          activeOpacity={0.8}
          accessibilityLabel="Add a place"
        >
          <Ionicons name="search" size={21} color="#1c1c1e" />
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
    paddingHorizontal: 5,
    paddingVertical: 5,
    // Subtle floating shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 6,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabItemActive: {
    backgroundColor: "rgba(10,132,255,0.14)",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5a5f66",
  },
  tabLabelActive: {
    color: BLUE,
  },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 6,
  },
  addTouch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
