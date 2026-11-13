import "../global.css";

import { Stack } from "expo-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { DatabaseProvider } from "@/db";
import { CurrentGameProvider } from "@/state/current-game";
import { AppThemeProvider, useColors } from "@/theme/theme";

export default function RootLayout() {
  return (
    // The current game comes first: its colour is the theme's accent.
    <CurrentGameProvider>
      <AppThemeProvider>
        <DatabaseProvider>
          <ThemedStack />
        </DatabaseProvider>
      </AppThemeProvider>
    </CurrentGameProvider>
  );
}

/**
 * The tabs are one screen of this stack, so pages opened from a tab (a
 * Pokémon) slide in over the tab bar instead of inside it.
 */
function ThemedStack() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        // The header blends into the page instead of sitting on a bar.
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "800" },
        headerRight: () => <ThemeToggle />,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      {/* Each tab draws its own header (ScreenHeader). */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
