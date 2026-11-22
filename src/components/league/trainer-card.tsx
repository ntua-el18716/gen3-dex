import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MoveChip } from "@/components/move-chip";
import { ItemLink } from "@/components/reference/item-link";
import { Sprite } from "@/components/sprite";
import { TrainerPic } from "@/components/trainer-pic";
import { TypeDot } from "@/components/type-badge";
import { Segmented, TABULAR } from "@/components/ui";
import type { TrainerTeam } from "@/db/league-queries";
import type { LeagueSection, LeagueTrainer } from "@/lib/league";
import { hexToRgb, mix, typeColor } from "@/theme/colors";
import { useCurrentGame } from "@/state/current-game";
import { useColors, usePalette } from "@/theme/theme";

/** The Champion's card is gold, whatever their type. */
const CHAMPION_GOLD = "#E2B33C";

/**
 * One League trainer: who, where, and their team as a sprite strip. Tap to
 * see each Pokémon's level, held item and moves. Rematch teams switch with
 * the control under the name.
 */
export function TrainerCard({
  entry,
  kind,
  pick,
}: {
  entry: LeagueTrainer;
  kind: LeagueSection["kind"];
  /** The team for a variant (rival battles: the one for your starter). */
  pick: (keys: string[]) => TrainerTeam | undefined;
}) {
  const colors = useColors();
  const { surface } = usePalette();
  const { game } = useCurrentGame();
  const [variant, setVariant] = useState(0);
  const [open, setOpen] = useState(false);
  const trainer = pick(entry.variants[variant]?.keys ?? []);
  if (!trainer) return null;

  const tint =
    kind === "champion"
      ? CHAMPION_GOLD
      : entry.type
        ? typeColor(entry.type)
        : null;
  const gradient = tint
    ? ([
        mix(hexToRgb(tint), surface, 0.2),
        mix(hexToRgb(tint), surface, 0.04),
      ] as const)
    : ([colors.surface, colors.surface] as const);

  return (
    <View className="overflow-hidden rounded-card">
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <Pressable
        onPress={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="gap-3.5 p-4"
      >
        <View className="flex-row items-center gap-3">
          {/* The trainer as the game draws them, with their speciality. */}
          <View className="h-20 w-20 items-center justify-center">
            <View
              className="absolute h-16 w-16 rounded-full"
              style={{
                backgroundColor: tint
                  ? mix(hexToRgb(tint), surface, 0.3)
                  : colors.sunken,
              }}
            />
            <TrainerPic game={game} trainerKey={trainer.key} size={80} />
            <View className="absolute bottom-0 right-0">
              {entry.type ? (
                <TypeDot type={entry.type} size={24} />
              ) : (
                <View
                  className="h-6 w-6 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      kind === "champion" ? CHAMPION_GOLD : colors.accent,
                  }}
                >
                  <SymbolView
                    name={{
                      ios: kind === "champion" ? "crown.fill" : "person.fill",
                      android:
                        kind === "champion" ? "workspace_premium" : "person",
                      web: kind === "champion" ? "workspace_premium" : "person",
                    }}
                    tintColor="#FFFFFF"
                    size={14}
                  />
                </View>
              )}
            </View>
          </View>
          <View className="flex-1">
            <Text
              className="text-headline font-bold text-ink"
              numberOfLines={1}
            >
              {kind === "rival" && entry.detail ? entry.detail : trainer.name}
            </Text>
            <Text className="text-callout text-ink-muted" numberOfLines={2}>
              {[entry.place, kind === "rival" ? null : entry.detail]
                .filter(Boolean)
                .join(" · ")}
              {trainer.isDouble ? " · Double battle" : ""}
            </Text>
          </View>
          <SymbolView
            name={{
              ios: open ? "chevron.up" : "chevron.down",
              android: open ? "expand_less" : "expand_more",
              web: open ? "expand_less" : "expand_more",
            }}
            tintColor={colors["ink-subtle"]}
            size={22}
          />
        </View>

        {entry.variants.length > 1 && (
          <Segmented
            options={entry.variants.map((v, i) => ({
              value: i,
              label: v.label,
            }))}
            value={variant}
            onChange={setVariant}
            small
          />
        )}

        {!open ? (
          <View className="flex-row flex-wrap gap-1">
            {trainer.team.map((m) => (
              <View key={m.slot} className="w-[52px] items-center gap-0.5">
                <Sprite id={m.pokemonId} size={48} />
                <Text
                  className="text-micro font-medium text-ink-muted"
                  style={TABULAR}
                >
                  Lv {m.level}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="gap-2">
            {trainer.team.map((m) => (
              <TeamMember key={m.slot} mon={m} />
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
}

/** A team member in full: sprite, types, level, item, moves. */
function TeamMember({ mon }: { mon: TrainerTeam["team"][number] }) {
  return (
    <View className="flex-row gap-3 rounded-tile bg-surface/80 p-3">
      <Link
        href={{ pathname: "/pokemon/[id]", params: { id: mon.pokemonId } }}
        asChild
      >
        <Pressable className="items-center active:opacity-70" hitSlop={4}>
          <Sprite id={mon.pokemonId} size={64} />
        </Pressable>
      </Link>
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-shrink text-body font-bold text-ink"
            numberOfLines={1}
          >
            {mon.name}
          </Text>
          <Text className="text-caption font-medium text-ink-muted">
            Lv {mon.level}
          </Text>
          <View className="ml-auto flex-row gap-1">
            <TypeDot type={mon.type1} size={20} />
            {mon.type2 && <TypeDot type={mon.type2} size={20} />}
          </View>
        </View>
        {mon.item && (
          <Text className="text-caption text-ink-muted">
            Holds <ItemLink id={mon.itemId} name={mon.item} />
          </Text>
        )}
        <View className="flex-row flex-wrap gap-1">
          {mon.moves.map((name, i) => (
            <MoveChip
              key={`${name}-${i}`}
              id={mon.moveIds[i]}
              name={name}
              type={mon.moveTypes[i]}
            />
          ))}
        </View>
        {mon.movesComputed && (
          <Text className="text-micro text-ink-subtle">
            The game&apos;s default moves for this level
          </Text>
        )}
      </View>
    </View>
  );
}
