import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MoveChip } from "@/components/move-chip";
import { Sprite } from "@/components/sprite";
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
    .join(" · ");

  return (
    <View className="gap-3 rounded-[20px] border border-line bg-surface p-3.5">
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${accent}22` }}
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
            <Text className="text-lg font-black text-ink">{set.species}</Text>
            {set.id !== undefined && (
              <Text className="text-[11px] font-bold text-ink-subtle">
                set {set.id}
              </Text>
            )}
          </View>
          <Text className="text-xs text-ink-muted">
            {set.item ? (
              <>
                Holds <Text className="font-bold text-ink">{set.item}</Text>
              </>
            ) : (
              "No item"
            )}
          </Text>
          <Text className="text-xs text-ink-muted">
            <Text className="font-bold text-ink">{set.nature}</Text>
            {set.increasedStat && set.decreasedStat
              ? `  +${LABEL[set.increasedStat]} −${LABEL[set.decreasedStat]}`
              : "  neutral"}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {set.moves.map((m, i) => (
          <MoveChip key={`${m}-${i}`} name={m} type={set.moveTypes[i]} wide />
        ))}
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[10px] font-extrabold uppercase tracking-widest text-ink-subtle">
            Lv {level} stats {ivs.length === 0 ? "(random IVs)" : ""}
          </Text>
          {options.length > 1 && (
            <View className="flex-row gap-1">
              {options.map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setIv(v)}
                  role="tab"
                  aria-selected={v === shown}
                  hitSlop={4}
                  className="rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: v === shown ? accent : "transparent",
                  }}
                >
                  <Text
                    className={`text-[11px] font-bold ${v === shown ? "text-white" : "text-ink-muted"}`}
                  >
                    IV {v}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {options.length === 1 && (
            <Text className="text-[11px] font-bold text-ink-muted">
              IV {shown}
            </Text>
          )}
        </View>
        <View className="flex-row overflow-hidden rounded-xl border border-line">
          {STAT_LABELS.map(([s, l], i) => {
            const up = set.increasedStat === s;
            const down = set.decreasedStat === s;
            return (
              <View
                key={s}
                className={`flex-1 items-center py-1.5 ${i > 0 ? "border-l border-line" : ""}`}
              >
                <Text className="text-[10px] font-bold text-ink-subtle">
                  {l}
                </Text>
                <Text
                  className={`text-base font-black ${
                    up ? "text-red-500" : down ? "text-blue-500" : "text-ink"
                  }`}
                >
                  {stats[s]}
                </Text>
              </View>
            );
          })}
        </View>
        {evs ? (
          <Text className="text-[11px] text-ink-muted">EVs {evs}</Text>
        ) : null}
      </View>
    </View>
  );
}
