import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MoveChip } from "@/components/move-chip";
import { Sprite } from "@/components/sprite";
import { StatCells } from "@/components/stat-cells";
import { Card, Label, Segmented, TABULAR } from "@/components/ui";
import type { FrontierSetDetail } from "@/db/frontier-queries";
import { frontierStats } from "@/lib/frontier";
import { DISPLAY_STATS, STAT_SHORT } from "@/lib/stat-labels";
import { useColors } from "@/theme/theme";

/**
 * One Frontier set: moves, item, nature, EVs, and its real stats at the
 * battle's level for each IV it can have (every IV is the trainer's fixed
 * value). `ivs` empty = random IVs: shows the 0–31 range.
 */
export function SetCard({
  set,
  level,
  ivs,
  accent,
}: {
  /** A Frontier set, or anything shaped like one (a Brain's Pokémon). */
  set: Omit<FrontierSetDetail, "id" | "openLevelOnly"> & { id?: number };
  level: number;
  ivs: number[];
  /** The facility's colour. */
  accent: string;
}) {
  const colors = useColors();
  const options = ivs.length > 0 ? ivs : [0, 31];
  const [iv, setIv] = useState(options[options.length - 1]!);
  const shown = options.includes(iv) ? iv : options[options.length - 1]!;
  const stats = frontierStats(set, level, shown);
  const evs = DISPLAY_STATS.filter((s) => set.evs[s] > 0)
    .map((s) => `${set.evs[s]} ${STAT_SHORT[s]}`)
    .join(", ");

  return (
    <Card className="gap-3.5 p-4">
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center rounded-tile"
          style={{ backgroundColor: `${accent}1F` }}
        >
          <Link
            href={{ pathname: "/pokemon/[id]", params: { id: set.pokemonId } }}
            asChild
          >
            <Pressable
              className="active:opacity-70"
              aria-label={`${set.species}'s page`}
            >
              <Sprite id={set.pokemonId} size={64} game="emerald" />
            </Pressable>
          </Link>
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-headline font-bold text-ink">
              {set.species}
            </Text>
            {set.id !== undefined && (
              <Text className="text-caption text-ink-subtle" style={TABULAR}>
                Set {set.id}
              </Text>
            )}
          </View>
          <Text className="text-callout text-ink-muted">
            {set.item ? (
              <>
                Holds <Text className="font-semibold text-ink">{set.item}</Text>
              </>
            ) : (
              "No item"
            )}
          </Text>
          <Text className="text-callout text-ink-muted">
            <Text className="font-semibold text-ink">{set.nature}</Text>
            {set.increasedStat && set.decreasedStat
              ? `  +${STAT_SHORT[set.increasedStat]}  −${STAT_SHORT[set.decreasedStat]}`
              : "  no stat change"}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {set.moves.map((m, i) => (
          <MoveChip key={`${m}-${i}`} name={m} type={set.moveTypes[i]} wide />
        ))}
      </View>

      <View className="gap-2">
        <View className="min-h-7 flex-row items-center justify-between">
          <Label>
            Stats at Lv {level}
            {ivs.length === 0
              ? ", random IVs"
              : options.length === 1
                ? `, every IV ${shown}`
                : ""}
          </Label>
          {options.length > 1 && (
            <Segmented
              options={options.map((v) => ({ value: v, label: `IV ${v}` }))}
              value={shown}
              onChange={setIv}
              small
            />
          )}
        </View>
        <StatCells stats={stats} nature={set} />
        {evs ? (
          <Text className="text-caption text-ink-subtle">EVs: {evs}</Text>
        ) : null}
      </View>

      {/* Only real sets have an id; a Brain's Pokémon doesn't. */}
      {set.id !== undefined && (
        <Link
          href={{
            pathname: "/matchup",
            params: { set: set.id, level, iv: shown },
          }}
          asChild
        >
          <Pressable
            role="button"
            className="h-11 flex-row items-center justify-center gap-2 rounded-tile bg-sunken active:opacity-60"
          >
            <SymbolView
              name={{ ios: "bolt.fill", android: "bolt", web: "bolt" }}
              tintColor={colors.ink}
              size={18}
            />
            <Text className="text-callout font-semibold text-ink">
              Damage against your team
            </Text>
          </Pressable>
        </Link>
      )}
    </Card>
  );
}
