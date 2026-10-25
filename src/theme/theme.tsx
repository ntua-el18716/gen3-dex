import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useColorScheme, vars } from "nativewind";
import { useEffect, useMemo, type ReactNode } from "react";
import { View } from "react-native";

import palette from "./palette.json";

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
  // Follows the system setting (app.json: userInterfaceStyle "automatic").
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
    <ThemeProvider value={navigationTheme}>
      <View style={THEME_VARS[scheme]} className="flex-1 bg-canvas">
        {children}
      </View>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
