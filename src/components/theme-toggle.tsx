import type { SymbolViewProps } from "expo-symbols";

import {
  THEME_PREFERENCES,
  useThemePreference,
  type ThemePreference,
} from "@/theme/theme";

import { IconButton } from "./ui";

const ICONS: Record<ThemePreference, SymbolViewProps["name"]> = {
  system: {
    ios: "circle.lefthalf.filled",
    android: "contrast",
    web: "contrast",
  },
  light: { ios: "sun.max.fill", android: "light_mode", web: "light_mode" },
  dark: { ios: "moon.fill", android: "dark_mode", web: "dark_mode" },
};

/** Header button that cycles Auto → Light → Dark. */
export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference();
  const next =
    THEME_PREFERENCES[
      (THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length
    ]!;
  return (
    <IconButton
      name={ICONS[preference]}
      label={`Theme: ${preference}. Switch to ${next}.`}
      onPress={() => setPreference(next)}
    />
  );
}
