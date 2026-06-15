import React, { useState } from "react";
import {
  LayoutChangeEvent,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "@/components/Glass";
import { colors, shadow as sh, motion } from "@/lib/theme";
import { tap } from "@/lib/haptics";

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
};

export default function BottomNav({ activeTab, onTabPress, onAdd }: Props) {
  const [tabsW, setTabsW] = useState(0);
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  const x = useSharedValue(0);

  const segW = tabsW > 0 ? tabsW / TABS.length : 0;

  React.useEffect(() => {
    if (segW > 0) x.value = withSpring(activeIndex * segW, motion.gentle);
  }, [activeIndex, segW, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: segW,
  }));

  const onTabsLayout = (e: LayoutChangeEvent) => setTabsW(e.nativeEvent.layout.width);

  return (
    <View style={styles.row}>
      {/* Liquid-glass tab pill with a sliding active highlight */}
      <GlassSurface style={styles.container} interactive>
        <View style={styles.tabs} onLayout={onTabsLayout}>
          {segW > 0 && (
            <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none" />
          )}
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  if (!isActive) tap();
                  onTabPress(tab.key);
                }}
                style={styles.tabItem}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={22}
                  color={isActive ? BLUE : INACTIVE}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassSurface>

      {/* Circular search button — Flighty's detached magnifier */}
      <GlassSurface style={styles.addBtn} interactive>
        <TouchableOpacity
          style={styles.addTouch}
          onPress={() => {
            tap();
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
  indicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: colors.blueSoft,
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
