import { Pressable, Text } from "react-native";

import {
  THEME_PREFERENCES,
  useThemePreference,
  type ThemePreference,
} from "@/theme/theme";

const LABELS: Record<ThemePreference, string> = {
  system: "◐ Auto",
  light: "☀ Light",
  dark: "☾ Dark",
};

/** Header button that cycles Auto → Light → Dark. */
export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference();
  const next =
    THEME_PREFERENCES[
      (THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length
    ]!;
  return (
    <Pressable
      onPress={() => setPreference(next)}
      aria-label={`Theme: ${preference}. Switch to ${next}.`}
      role="button"
      hitSlop={8}
      className="rounded-full bg-sunken px-3 py-1.5 active:opacity-70"
    >
      <Text className="text-xs font-bold text-ink-muted">
        {LABELS[preference]}
      </Text>
    </Pressable>
  );
}
