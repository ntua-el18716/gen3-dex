import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { useDb } from "@/db";
import { getFrontierBrain } from "@/db/frontier-queries";
import { FACILITIES } from "@/lib/frontier-facilities";
import { hexToRgb, mix } from "@/theme/colors";
import { useColors, usePalette } from "@/theme/theme";

/** The Battle Frontier: one card per facility, with its Frontier Brain. */
export default function FrontierScreen() {
  const db = useDb();
  const colors = useColors();
  const { surface } = usePalette();
  const brains = useMemo(
    () => new Map(FACILITIES.map((f) => [f.key, getFrontierBrain(db, f.key)])),
    [db],
  );

  return (
    <ScrollView contentContainerClassName="pb-10">
      <ScreenHeader
        title="Battle Frontier"
        subtitle="Emerald · who you'll face, and with what"
      />
      <View className="gap-2.5 px-3">
        {FACILITIES.map((f) => {
          const brain = brains.get(f.key);
          return (
            <Link
              key={f.key}
              href={{
                pathname: "/frontier/[facility]",
                params: { facility: f.key },
              }}
              asChild
            >
              <Pressable
                android_ripple={{ color: colors.sunken, foreground: true }}
                className="overflow-hidden rounded-[20px] border border-line active:opacity-80"
              >
                <LinearGradient
                  colors={[
                    mix(hexToRgb(f.color), surface, 0.22),
                    mix(hexToRgb(f.color), surface, 0.04),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ position: "absolute", inset: 0 }}
                />
                <View className="flex-row items-center gap-3.5 p-3.5">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl"
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
                      size={26}
                    />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-lg font-black text-ink">
                      {f.name}
                    </Text>
                    <Text className="text-xs text-ink-muted">{f.rule}</Text>
                    {brain && (
                      <Text
                        className="mt-0.5 text-[11px] font-bold"
                        style={{ color: f.color }}
                      >
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
                    size={22}
                  />
                </View>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}
