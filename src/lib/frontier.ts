/**
 * Battle Frontier rules from pokeemerald (battle_tower.c, frontier_util.c),
 * as pure functions. The importer checks these constants against pret.
 *
 * Applies to the Battle Tower, Palace and Arena, which pick trainers and
 * build their teams the same way; the Battle Factory's own rules are at the
 * end.
 */
import type { FrontierLevelMode, FrontierSymbol, Stat } from "@/db/schema";

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

export type LevelMode = FrontierLevelMode;

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

// ---------------------------------------------------------------------------
// Battle Factory (battle_factory.c)
// ---------------------------------------------------------------------------

/** Rows in sFixedIVTable; the game clamps to the last row, with an off-by-one. */
export const FACTORY_IV_ROWS = 8;
/** FillFactoryBrainParty uses the IV row two challenges ahead. */
export const FACTORY_BRAIN_IV_OFFSET = 2;

export type FactoryIvRow = {
  challenge: number;
  iv: number;
  lastBattleIv: number;
};

/**
 * GetFactoryMonFixedIV: the IV for an IV-table row and battle. Rows past the
 * end clamp to the last one, but the check is `>` instead of `>=`, so row 8
 * reads past the table; pret notes that value is above 31, which the game
 * treats as random IVs. Returns null for random.
 */
export function factoryFixedIv(
  table: FactoryIvRow[],
  row: number,
  lastBattle: boolean,
): number | null {
  if (row === FACTORY_IV_ROWS) return null;
  const r = table[Math.min(row, FACTORY_IV_ROWS - 1)];
  if (!r) throw new Error(`No Factory IV row ${row}`);
  return lastBattle ? r.lastBattleIv : r.iv;
}

/**
 * IVs of a regular Factory opponent's Pokémon. A bug in
 * FillFactoryFrontierTrainerParty picks the IV row from the player's
 * *Battle Tower Level 50* win streak (same singles/doubles mode), not the
 * Factory streak; the 7th Factory battle of a challenge uses the higher IV.
 */
export function factoryOpponentIv(
  table: FactoryIvRow[],
  towerLevel50Wins: number,
  factoryBattle: number,
): number | null {
  const row = Math.floor(towerLevel50Wins / BATTLES_PER_CHALLENGE);
  return factoryFixedIv(table, row, battlePosition(factoryBattle).lastBattle);
}

/** IVs of the Factory Head's (Noland's) Pokémon at Factory battle `battle`. */
export function factoryBrainIv(
  table: FactoryIvRow[],
  battle: number,
): number | null {
  const { challenge } = battlePosition(battle);
  return factoryFixedIv(table, challenge + FACTORY_BRAIN_IV_OFFSET, false);
}

// ---------------------------------------------------------------------------
// Battle Pike (battle_pike.c) and Battle Pyramid (battle_pyramid.c)
// ---------------------------------------------------------------------------

/** NUM_PIKE_ROOMS: the Pike streak counts rooms, 14 per challenge. */
export const PIKE_ROOMS_PER_CHALLENGE = 14;
/** TOTAL_PYRAMID_ROUNDS: the Pyramid's wild tables cycle after this many. */
export const PYRAMID_ROUNDS = 20;

/**
 * GetBattlePikeWildMonHeaderId: which wild table the Pike uses after
 * `roomsCleared` rooms (up to 20 challenges' worth → 0, 40 → 1, 60 → 2).
 */
export function pikeWildTier(roomsCleared: number): number {
  const challenges = roomsCleared / PIKE_ROOMS_PER_CHALLENGE;
  if (challenges <= 20) return 0;
  if (challenges <= 40) return 1;
  if (challenges <= 60) return 2;
  return 3;
}

/**
 * A Pike wild Pokémon's level: 50 − levelDelta in Level 50. In Open Level,
 * the highest level in the party − levelDelta, but at least 60; if the party
 * is below 60 the game skips the delta entirely and uses 60.
 */
export function pikeWildLevel(
  mode: LevelMode,
  levelDelta: number,
  highestPartyLevel = MIN_OPEN_LEVEL,
): number {
  if (mode === "50") return LEVEL_50 - levelDelta;
  if (highestPartyLevel < MIN_OPEN_LEVEL) return MIN_OPEN_LEVEL;
  return Math.max(highestPartyLevel - levelDelta, MIN_OPEN_LEVEL);
}

/** The Pyramid round (wild table) after `floorsCleared` floors: cycles through 20. */
export function pyramidRound(floorsCleared: number): number {
  return Math.floor(floorsCleared / BATTLES_PER_CHALLENGE) % PYRAMID_ROUNDS;
}

/**
 * GenerateBattlePyramidWildMon: the level range of a Pyramid wild Pokémon,
 * ±5 around the listed level (Level 50) or around the opponent level minus
 * the listed value (Open Level).
 */
export function pyramidWildLevels(
  mode: LevelMode,
  listed: number,
  highestPartyLevel = MIN_OPEN_LEVEL,
): { min: number; max: number } {
  const centre =
    mode === "50" ? listed : opponentLevel(mode, highestPartyLevel) - listed;
  return { min: centre - 5, max: centre + 5 };
}

// ---------------------------------------------------------------------------
// Battle Dome (battle_dome.c)
// ---------------------------------------------------------------------------

/** Of the 15 tournament opponents, this many come from the next range up. */
export const DOME_HARDER_OPPONENTS = 5;
export const DOME_OPPONENTS = 15;

/**
 * InitDomeTrainers: which trainer ranges (normal, not 7th-battle) the Dome's
 * opponents are drawn from. The index is the current win streak, which counts
 * tournaments won in a row (not battles / 7; capped at 999); 5 opponents use
 * the next one up. The game passes it to GetRandomScaledFrontierTrainerId as
 * a u8, so it wraps after 255; above 7 it uses range 7. Teams and IVs work
 * like the Battle Tower's (the importer checks both against battle_dome.c).
 */
export function domeRangeChallenges(streak: number): {
  regularChallenge: number;
  harderChallenge: number;
} {
  const toRange = (n: number) => Math.min(n % 256, LAST_RANGED_CHALLENGE);
  return {
    regularChallenge: toRange(streak),
    harderChallenge: toRange(streak + 1),
  };
}
