import { Text, View } from "react-native";

import type { Stat } from "@/db/schema";
import {
  DISPLAY_STATS,
  natureTone,
  STAT_SHORT,
  TONE_TEXT,
} from "@/lib/stat-labels";
import type { StatSpread } from "@/lib/stats";

import { TABULAR } from "./ui";

/**
 * A Pokémon's six stats in a row, each under its short label; the stat its
 * nature raises is red, the one it lowers blue.
 */
export function StatCells({
  stats,
  nature,
  strip = false,
}: {
  stats: StatSpread;
  nature: { increasedStat: Stat | null; decreasedStat: Stat | null };
  /** One translucent strip (on tinted cards) instead of six tiles. */
  strip?: boolean;
}) {
  return (
    <View
      className={
        strip ? "flex-row rounded-tile bg-surface/70 py-2" : "flex-row gap-1"
      }
    >
      {DISPLAY_STATS.map((stat) => (
        <View
          key={stat}
          className={
            strip
              ? "flex-1 items-center"
              : "flex-1 items-center rounded-lg bg-sunken py-1.5"
          }
        >
          <Text className="text-micro font-medium text-ink-muted">
            {STAT_SHORT[stat]}
          </Text>
          <Text
            className={`text-body font-bold ${TONE_TEXT[natureTone(stat, nature) ?? "none"]}`}
            style={TABULAR}
          >
            {stats[stat]}
          </Text>
        </View>
      ))}
    </View>
  );
}
