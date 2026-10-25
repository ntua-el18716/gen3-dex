/**
 * Battle Frontier rules from pokeemerald (battle_tower.c, frontier_util.c),
 * as pure functions. The importer checks these constants against pret.
 *
 * Applies to the Battle Tower, Palace and Arena, which pick trainers and
 * build their teams the same way.
 */
import type { FrontierSymbol, Stat } from "@/db/schema";

import { calculateStats, uniformSpread, type StatSpread } from "./stats";

/** FRONTIER_STAGES_PER_CHALLENGE */
export const BATTLES_PER_CHALLENGE = 7;
/** The last challenge with its own trainer range; later ones reuse it. */
export const LAST_RANGED_CHALLENGE = 7;
/** FRONTIER_MAX_LEVEL_50 */
export const LEVEL_50 = 50;
/** FRONTIER_MIN_LEVEL_OPEN: open-level opponents are never below this. */
export const MIN_OPEN_LEVEL = 60;
/** MAX_FRIENDSHIP; Pokémon that know Frustration get 0 instead. */
export const MAX_FRIENDSHIP = 255;

export type LevelMode = "50" | "open";

/**
 * Where battle `battle` (1 = the first battle of a streak) falls: its
 * challenge (0 = battles 1–7) and whether it's the challenge's 7th battle,
 * which draws from a harder trainer range.
 */
export function battlePosition(battle: number): {
  challenge: number;
  /** Challenge whose trainer range applies (challenges after 7 reuse 7). */
  rangeChallenge: number;
  battleInChallenge: number;
  lastBattle: boolean;
} {
  if (!Number.isInteger(battle) || battle < 1) {
    throw new RangeError(`Battle numbers start at 1, got ${battle}`);
  }
  const winStreak = battle - 1;
  const challenge = Math.floor(winStreak / BATTLES_PER_CHALLENGE);
  const battleInChallenge = (winStreak % BATTLES_PER_CHALLENGE) + 1;
  return {
    challenge,
    rangeChallenge: Math.min(challenge, LAST_RANGED_CHALLENGE),
    battleInChallenge,
    lastBattle: battleInChallenge === BATTLES_PER_CHALLENGE,
  };
}

/**
 * Opponents' level: 50 in Level 50 mode; in Open Level, the highest level in
 * the player's party, but at least 60 (GetFrontierEnemyMonLevel).
 */
export function opponentLevel(
  mode: LevelMode,
  highestPartyLevel = MIN_OPEN_LEVEL,
): number {
  if (mode === "50") return LEVEL_50;
  return Math.max(highestPartyLevel, MIN_OPEN_LEVEL);
}

/** Friendship of a Frontier Pokémon: 0 if it knows Frustration. */
export function frontierFriendship(moveNames: (string | null)[]): number {
  return moveNames.includes("Frustration") ? 0 : MAX_FRIENDSHIP;
}

export type BrainSchedule = {
  silverAt: number;
  goldAt: number;
  repeatEvery: number;
  streakOffset: number;
};

/**
 * Whether the Frontier Brain is fought at battle `battle`, and with which
 * team (GetFrontierBrainStatus + GetFronterBrainSymbol). `symbolsWon` is how
 * many of the facility's Symbols the player already has (0, 1 or 2). Brains
 * only appear in single battles.
 */
export function brainBattle(
  schedule: BrainSchedule,
  battle: number,
  symbolsWon: 0 | 1 | 2,
): FrontierSymbol | null {
  const streak = battle - 1 + schedule.streakOffset;
  if (symbolsWon === 0) return streak === schedule.silverAt ? "silver" : null;
  if (symbolsWon === 1) return streak === schedule.goldAt ? "gold" : null;
  if (streak === schedule.silverAt) return "silver";
  if (
    streak >= schedule.goldAt &&
    (streak - schedule.goldAt) % schedule.repeatEvery === 0
  ) {
    return "gold";
  }
  return null;
}

/**
 * A Frontier Pokémon's actual stats: every IV is the trainer's fixed IV, the
 * EVs and nature come from the set.
 */
export function frontierStats(
  set: {
    baseStats: StatSpread;
    evs: StatSpread;
    increasedStat: Stat | null;
    decreasedStat: Stat | null;
  },
  level: number,
  fixedIv: number,
): StatSpread {
  return calculateStats({
    base: set.baseStats,
    level,
    ivs: uniformSpread(fixedIv),
    evs: set.evs,
    nature: {
      increasedStat: set.increasedStat,
      decreasedStat: set.decreasedStat,
    },
  });
}
