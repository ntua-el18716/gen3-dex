import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MoveChip } from "@/components/move-chip";
import { Sprite } from "@/components/sprite";
import { TypeDot } from "@/components/type-badge";
import type { TrainerTeam } from "@/db/league-queries";
import type { LeagueSection, LeagueTrainer } from "@/lib/league";
import { hexToRgb, mix, typeColor } from "@/theme/colors";
import { useColors, usePalette } from "@/theme/theme";

/** The Champion's card is gold, whatever their type. */
const CHAMPION_GOLD = "#E2B33C";

/**
 * One League trainer: who, where, and their team as a sprite strip. Tap to
 * see each Pokémon's level, held item and moves. Rematch teams switch with
 * the chips under the name.
 */
export function TrainerCard({
  entry,
  kind,
  number,
  pick,
}: {
  entry: LeagueTrainer;
  kind: LeagueSection["kind"];
  /** Gym or Elite Four position, shown as a big faint numeral. */
  number?: number;
  /** The team for a variant (rival battles: the one for your starter). */
  pick: (keys: string[]) => TrainerTeam | undefined;
}) {
  const colors = useColors();
  const { surface } = usePalette();
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
        mix(hexToRgb(tint), surface, 0.24),
        mix(hexToRgb(tint), surface, 0.06),
      ] as const)
    : ([colors.surface, colors.surface] as const);

  return (
    <View className="overflow-hidden rounded-[20px] border border-line">
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
        style={{ position: "absolute", inset: 0 }}
      />
      {number !== undefined && (
        <Text
          className="absolute -top-3 right-3 text-[84px] font-black text-ink opacity-[0.07]"
          pointerEvents="none"
        >
          {number}
        </Text>
      )}
      <Pressable
        onPress={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="gap-3 p-3.5"
      >
        <View className="flex-row items-center gap-3">
          {entry.type ? (
            <TypeDot type={entry.type} size={38} />
          ) : (
            <View
              className="h-[38px] w-[38px] items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  kind === "champion" ? CHAMPION_GOLD : colors.accent,
              }}
            >
              <SymbolView
                name={{
                  ios: kind === "champion" ? "crown.fill" : "person.fill",
                  android: kind === "champion" ? "workspace_premium" : "person",
                  web: kind === "champion" ? "workspace_premium" : "person",
                }}
                tintColor="#FFFFFF"
                size={20}
              />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-black text-ink" numberOfLines={1}>
              {kind === "rival" && entry.detail ? entry.detail : trainer.name}
            </Text>
            <Text
              className="text-xs font-semibold text-ink-muted"
              numberOfLines={1}
            >
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
          <View className="flex-row flex-wrap gap-1.5">
            {entry.variants.map((v, i) => (
              <Pressable
                key={v.label}
                onPress={() => setVariant(i)}
                role="tab"
                aria-selected={i === variant}
                hitSlop={4}
                className={`rounded-full px-2.5 py-1 ${i === variant ? "bg-accent" : "bg-surface/70"}`}
              >
                <Text
                  className={`text-[11px] font-bold ${i === variant ? "text-on-accent" : "text-ink-muted"}`}
                >
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {!open ? (
          <View className="flex-row flex-wrap gap-1">
            {trainer.team.map((m) => (
              <View key={m.slot} className="w-[52px] items-center">
                <Sprite id={m.pokemonId} size={48} />
                <Text className="text-[11px] font-bold text-ink-muted">
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
    <View className="flex-row gap-3 rounded-2xl bg-surface/80 p-2.5">
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
            className="flex-shrink text-base font-black text-ink"
            numberOfLines={1}
          >
            {mon.name}
          </Text>
          <Text className="text-xs font-bold text-ink-subtle">
            Lv {mon.level}
          </Text>
          <View className="ml-auto flex-row gap-1">
            <TypeDot type={mon.type1} size={20} />
            {mon.type2 && <TypeDot type={mon.type2} size={20} />}
          </View>
        </View>
        {mon.item && (
          <Text className="text-xs text-ink-muted">
            Holds <Text className="font-bold text-ink">{mon.item}</Text>
          </Text>
        )}
        <View className="flex-row flex-wrap gap-1">
          {mon.moves.map((name, i) => (
            <MoveChip
              key={`${name}-${i}`}
              name={name}
              type={mon.moveTypes[i]}
            />
          ))}
        </View>
        {mon.movesComputed && (
          <Text className="text-[10px] text-ink-subtle">
            Moves: the game&apos;s default for its level
          </Text>
        )}
      </View>
    </View>
  );
}
