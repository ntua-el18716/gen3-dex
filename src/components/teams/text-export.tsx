import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Platform, Pressable, ScrollView, Share, Text } from "react-native";

import { Card, MONO } from "@/components/ui";
import { useColors } from "@/theme/theme";

/** Selectable text with a Share button (used for teams and backups). */
export function TextExport({
  title,
  text,
  note,
}: {
  title: string;
  text: string;
  note: string;
}) {
  const colors = useColors();
  // The share sheet offers Copy as well. Browsers without one can select
  // the text instead.
  const canShare = Platform.OS !== "web" || "share" in navigator;
  return (
    <ScrollView contentContainerClassName="gap-4 px-4 pb-12 pt-2">
      <Stack.Screen options={{ title }} />
      <Text className="px-1 text-callout text-ink-muted">{note}</Text>
      {canShare && (
        <Pressable
          onPress={() => void Share.share({ message: text })}
          role="button"
          className="h-12 flex-row items-center justify-center gap-2 rounded-tile bg-accent active:opacity-60"
        >
          <SymbolView
            name={{
              ios: "square.and.arrow.up",
              android: "share",
              web: "share",
            }}
            tintColor={colors["on-accent"]}
            size={20}
          />
          <Text className="text-body font-semibold text-on-accent">Share</Text>
        </Pressable>
      )}
      <Card className="p-4">
        <Text selectable className="text-callout text-ink" style={MONO}>
          {text}
        </Text>
      </Card>
    </ScrollView>
  );
}
