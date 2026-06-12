import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type NavTab = "places" | "friends" | "passport";

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
    <View style={styles.container}>
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
                size={20}
                color={isActive ? "#ffffff" : "#868c94"}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
        <Text style={styles.addBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    // Inset from the sheet edges so it floats as a pill inside the sheet
    marginHorizontal: 10,
    marginBottom: 2,
    // White pill matching the sheet card background
    backgroundColor: "#ffffff",
    // 44 pt matches the sheet's continuous-curve corner radius
    borderRadius: 44,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ebebf0",
    // Subtle floating shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 6,
  },
  tabs: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  tabItemActive: {
    backgroundColor: "#111214",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#868c94",
  },
  tabLabelActive: {
    color: "#ffffff",
  },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  addBtnText: {
    fontSize: 26,
    fontWeight: "300",
    color: "#111214",
    lineHeight: 30,
    marginTop: -2,
  },
});
