import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MoveChip } from "@/components/move-chip";
import { Sprite } from "@/components/sprite";
import { Card, Label, Segmented, TABULAR } from "@/components/ui";
import type { FrontierSetDetail } from "@/db/frontier-queries";
import type { Stat } from "@/db/schema";
import { frontierStats } from "@/lib/frontier";

const STAT_LABELS: [Stat, string][] = [
  ["hp", "HP"],
  ["attack", "Atk"],
  ["defense", "Def"],
  ["spAttack", "SpA"],
  ["spDefense", "SpD"],
  ["speed", "Spe"],
];
const LABEL = Object.fromEntries(STAT_LABELS) as Record<Stat, string>;

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
  const options = ivs.length > 0 ? ivs : [0, 31];
  const [iv, setIv] = useState(options[options.length - 1]!);
  const shown = options.includes(iv) ? iv : options[options.length - 1]!;
  const stats = frontierStats(set, level, shown);
  const evs = STAT_LABELS.filter(([s]) => set.evs[s] > 0)
    .map(([s, l]) => `${set.evs[s]} ${l}`)
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
              ? `  +${LABEL[set.increasedStat]}  −${LABEL[set.decreasedStat]}`
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
        <View className="flex-row gap-1">
          {STAT_LABELS.map(([s, l]) => {
            const up = set.increasedStat === s;
            const down = set.decreasedStat === s;
            return (
              <View
                key={s}
                className="flex-1 items-center rounded-lg bg-sunken py-1.5"
              >
                <Text className="text-micro font-medium text-ink-muted">
                  {l}
                </Text>
                <Text
                  className={`text-body font-bold ${
                    up ? "text-red-500" : down ? "text-blue-500" : "text-ink"
                  }`}
                  style={TABULAR}
                >
                  {stats[s]}
                </Text>
              </View>
            );
          })}
        </View>
        {evs ? (
          <Text className="text-caption text-ink-subtle">EVs: {evs}</Text>
        ) : null}
      </View>
    </Card>
  );
}
