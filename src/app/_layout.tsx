import "../global.css";

import { Stack } from "expo-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { DatabaseProvider } from "@/db";
import { CurrentGameProvider } from "@/state/current-game";
import { AppThemeProvider, useColors } from "@/theme/theme";

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <DatabaseProvider>
        <CurrentGameProvider>
          <ThemedStack />
        </CurrentGameProvider>
      </DatabaseProvider>
    </AppThemeProvider>
  );
}

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
    />
  );
}
