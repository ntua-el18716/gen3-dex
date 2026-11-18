import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeToggle } from "./theme-toggle";

/**
 * A tab's large title with the theme switch beside it. Tabs hide the
 * navigator's header, so this also keeps clear of the status bar.
 */
export function ScreenHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Extra buttons, shown before the theme switch. */
  actions?: ReactNode;
  /** Shown under the title, e.g. search and filters. */
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="gap-4 px-4 pb-3" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-display font-bold tracking-tight text-ink">
            {title}
          </Text>
          {subtitle && (
            <Text className="text-callout text-ink-muted">{subtitle}</Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          {actions}
          <ThemeToggle />
        </View>
      </View>
      {children}
    </View>
  );
}
