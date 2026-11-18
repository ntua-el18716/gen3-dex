import type { Stat } from "@/db/schema";

/** The order Pokédex apps show stats in (the games store Speed fourth). */
export const DISPLAY_STATS: readonly Stat[] = [
  "hp",
  "attack",
  "defense",
  "spAttack",
  "spDefense",
  "speed",
];

/** For tight spots: stat cells, "+Atk −Def", EV lists. */
export const STAT_SHORT: Record<Stat, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  spAttack: "SpA",
  spDefense: "SpD",
  speed: "Spe",
};

export const STAT_NAME: Record<Stat, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  spAttack: "Sp. Atk",
  spDefense: "Sp. Def",
  speed: "Speed",
};

/**
 * What a nature does to a stat. Neutral natures raise and lower the same
 * stat (or are stored as null), which is no change.
 */
export function natureTone(
  stat: Stat,
  nature: { increasedStat: Stat | null; decreasedStat: Stat | null },
): "raised" | "lowered" | null {
  if (nature.increasedStat === nature.decreasedStat) return null;
  if (nature.increasedStat === stat) return "raised";
  if (nature.decreasedStat === stat) return "lowered";
  return null;
}

/** Text colour for a stat the nature raises (red) or lowers (blue). */
export const TONE_TEXT = {
  raised: "text-red-500",
  lowered: "text-blue-500",
  none: "text-ink",
} as const;
