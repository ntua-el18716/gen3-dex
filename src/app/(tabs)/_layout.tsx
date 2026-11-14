import { Tabs } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ColorValue } from "react-native";

import { useColors } from "@/theme/theme";

/**
 * The bottom tab bar. Every file in this (tabs) folder is a tab; the
 * parentheses keep "(tabs)" out of the URL, so the Pokédex is still "/".
 */
export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors["ink-subtle"],
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pokédex",
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name={{
                ios: "book.fill",
                android: "menu_book",
                web: "menu_book",
              }}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="league"
        options={{
          title: "League",
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name={{
                ios: "medal.fill",
                android: "military_tech",
                web: "military_tech",
              }}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="frontier"
        options={{
          title: "Frontier",
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name={{
                ios: "trophy.fill",
                android: "emoji_events",
                web: "emoji_events",
              }}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

/** SF Symbols on iOS, Material Symbols on Android and web. */
function TabIcon({
  name,
  color,
  size,
}: {
  name: SymbolViewProps["name"];
  color: ColorValue;
  size: number;
}) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}
