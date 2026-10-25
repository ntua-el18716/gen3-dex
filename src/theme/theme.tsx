import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { colorScheme, useColorScheme, vars } from "nativewind";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";

import { readPreference, writePreference } from "@/lib/preferences";

import palette from "./palette.json";

/** "system" follows the device setting (app.json: userInterfaceStyle "automatic"). */
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const PREFERENCE_KEY = "theme";

function savedPreference(): ThemePreference {
  const value = readPreference(PREFERENCE_KEY);
  return THEME_PREFERENCES.find((p) => p === value) ?? "system";
}

// Applied before the first render, so a saved choice doesn't flash.
const initialPreference = savedPreference();
colorScheme.set(initialPreference);

const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} | null>(null);

export function useThemePreference() {
  const value = use(ThemePreferenceContext);
  if (!value) {
    throw new Error(
      "useThemePreference must be used inside <AppThemeProvider>",
    );
  }
  return value;
}

/**
 * The app's colours, as semantic tokens (canvas, surface, ink…) with a light
 * and a dark value each. Tailwind classes like `bg-surface` read them through
 * CSS variables (see tailwind.config.js), so components never need `dark:`
 * variants; the few props that need a real colour use useColors().
 */
export type ColorToken = keyof (typeof palette)["light"];
type Scheme = keyof typeof palette;

const toRgb = ([r, g, b]: number[]) => `rgb(${r}, ${g}, ${b})`;

const THEME_VARS = {
  light: vars(cssVariables("light")),
  dark: vars(cssVariables("dark")),
};

function cssVariables(scheme: Scheme) {
  return Object.fromEntries(
    Object.entries(palette[scheme]).map(([token, rgb]) => [
      `--${token}`,
      rgb.join(" "),
    ]),
  );
}

function useScheme(): Scheme {
  // The system setting, or the user's choice once colorScheme.set() is called.
  return useColorScheme().colorScheme === "dark" ? "dark" : "light";
}

/** Real colour strings for props that can't take a className. */
export function useColors(): Record<ColorToken, string> {
  const scheme = useScheme();
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(palette[scheme]).map(([t, rgb]) => [t, toRgb(rgb)]),
      ) as Record<ColorToken, string>,
    [scheme],
  );
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useScheme();
  const colors = useColors();

  const [preference, setPreferenceState] = useState(initialPreference);
  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writePreference(PREFERENCE_KEY, next);
  }, []);
  // Switch NativeWind's scheme after React has committed, not mid-update.
  useEffect(() => {
    colorScheme.set(preference);
  }, [preference]);
  const preferenceValue = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  // The window behind the app (visible under Android's navigation bar).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.canvas);
  }, [colors.canvas]);

  // React Navigation draws the header and screen backgrounds itself.
  const navigationTheme = useMemo(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.canvas,
        card: colors.surface,
        text: colors.ink,
        border: colors.line,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemePreferenceContext value={preferenceValue}>
      <ThemeProvider value={navigationTheme}>
        <View style={THEME_VARS[scheme]} className="flex-1 bg-canvas">
          {children}
        </View>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </ThemePreferenceContext>
  );
}
