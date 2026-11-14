import { Link } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { Card, Divider } from "@/components/ui";
import { useDb } from "@/db";
import { getFrontierBrain } from "@/db/frontier-queries";
import { FACILITIES } from "@/lib/frontier-facilities";
import { useColors } from "@/theme/theme";

/** The Battle Frontier: one row per facility, with its Frontier Brain. */
export default function FrontierScreen() {
  const db = useDb();
  const colors = useColors();
  const brains = useMemo(
    () => new Map(FACILITIES.map((f) => [f.key, getFrontierBrain(db, f.key)])),
    [db],
  );

  return (
    <ScrollView contentContainerClassName="pb-10">
      <ScreenHeader
        title="Battle Frontier"
        subtitle="Who you can face in Emerald, and with what"
      />
      <View className="px-4 pt-2">
        <Card>
          {FACILITIES.map((f, i) => {
            const brain = brains.get(f.key);
            return (
              <View key={f.key}>
                {i > 0 && <Divider className="ml-[76px]" />}
                <Link
                  href={{
                    pathname: "/frontier/[facility]",
                    params: { facility: f.key },
                  }}
                  asChild
                >
                  <Pressable
                    android_ripple={{ color: colors.sunken }}
                    className="flex-row items-center gap-3.5 px-4 py-3.5 active:bg-sunken"
                  >
                    <View
                      className="h-11 w-11 items-center justify-center rounded-tile"
                      style={{ backgroundColor: f.color }}
                    >
                      <SymbolView
                        name={
                          {
                            ios: f.icon.ios,
                            android: f.icon.android,
                            web: f.icon.android,
                          } as SymbolViewProps["name"]
                        }
                        tintColor="#FFFFFF"
                        size={24}
                      />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-headline font-semibold text-ink">
                        {f.name}
                      </Text>
                      <Text className="text-callout text-ink-muted">
                        {f.rule}
                      </Text>
                      {brain && (
                        <Text className="text-caption text-ink-subtle">
                          {brain.trainerClass} {brain.name}
                        </Text>
                      )}
                    </View>
                    <SymbolView
                      name={{
                        ios: "chevron.right",
                        android: "chevron_right",
                        web: "chevron_right",
                      }}
                      tintColor={colors["ink-subtle"]}
                      size={20}
                    />
                  </Pressable>
                </Link>
              </View>
            );
          })}
        </Card>
      </View>
    </ScrollView>
  );
}
