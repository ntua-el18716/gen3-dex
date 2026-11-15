import { describe, expect, it } from "vitest";

import {
  narrowBySeen,
  battlePosition,
  brainBattle,
  domeRangeChallenges,
  factoryBrainIv,
  factoryOpponentIv,
  frontierFriendship,
  opponentLevel,
  pikeWildLevel,
  pikeWildTier,
  pyramidRound,
  pyramidWildLevels,
  type FactoryIvRow,
} from "./frontier";

describe("battlePosition", () => {
  it("splits a streak into challenges of 7", () => {
    expect(battlePosition(1)).toEqual({
      challenge: 0,
      rangeChallenge: 0,
      battleInChallenge: 1,
      lastBattle: false,
    });
    expect(battlePosition(7)).toMatchObject({ challenge: 0, lastBattle: true });
    expect(battlePosition(8)).toMatchObject({
      challenge: 1,
      battleInChallenge: 1,
      lastBattle: false,
    });
  });

  it("reuses the 8th challenge's range from then on", () => {
    expect(battlePosition(57)).toMatchObject({
      challenge: 8,
      rangeChallenge: 7,
    });
    expect(battlePosition(500).rangeChallenge).toBe(7);
  });

  it("rejects battle 0", () => {
    expect(() => battlePosition(0)).toThrow(RangeError);
  });
});

describe("opponentLevel", () => {
  it("is 50, or the player's highest level but at least 60", () => {
    expect(opponentLevel("50", 100)).toBe(50);
    expect(opponentLevel("open", 45)).toBe(60);
    expect(opponentLevel("open", 100)).toBe(100);
  });
});

describe("frontierFriendship", () => {
  it("is 0 only with Frustration", () => {
    expect(frontierFriendship(["Return", null, null, null])).toBe(255);
    expect(frontierFriendship(["Frustration", "Toxic", null, null])).toBe(0);
  });
});

describe("brainBattle", () => {
  // Battle Tower: Anabel at battle 35 (Silver) and 70 (Gold), then every 35.
  const tower = { silverAt: 35, goldAt: 70, repeatEvery: 35, streakOffset: 1 };
  const battleOf = (symbols: 0 | 1 | 2) =>
    Array.from({ length: 200 }, (_, i) => i + 1).filter(
      (n) => brainBattle(tower, n, symbols) !== null,
    );

  it("waits for the Silver Symbol battle first", () => {
    expect(battleOf(0)).toEqual([35]);
    expect(brainBattle(tower, 35, 0)).toBe("silver");
  });

  it("then only the Gold Symbol battle", () => {
    expect(battleOf(1)).toEqual([70]);
  });

  it("with both Symbols: silver once, then gold repeating", () => {
    expect(battleOf(2)).toEqual([35, 70, 105, 140, 175]);
    expect(brainBattle(tower, 105, 2)).toBe("gold");
  });
});

describe("Battle Factory IVs", () => {
  // sFixedIVTable
  const table: FactoryIvRow[] = [
    [3, 6],
    [6, 9],
    [9, 12],
    [12, 15],
    [15, 18],
    [21, 31],
    [31, 31],
    [31, 31],
  ].map(([iv, lastBattleIv], challenge) => ({
    challenge,
    iv: iv!,
    lastBattleIv: lastBattleIv!,
  }));

  it("reads the row from the Battle Tower Level 50 streak, not the Factory's", () => {
    // 20 Tower wins → row 2, whatever the Factory battle.
    expect(factoryOpponentIv(table, 20, 1)).toBe(9);
    expect(factoryOpponentIv(table, 20, 50)).toBe(9);
    // No Tower wins: the weakest row, even deep into a Factory streak.
    expect(factoryOpponentIv(table, 0, 40)).toBe(3);
  });

  it("uses the higher IV in the 7th battle of a Factory challenge", () => {
    expect(factoryOpponentIv(table, 20, 7)).toBe(12);
    expect(factoryOpponentIv(table, 20, 14)).toBe(12);
  });

  it("gives random IVs at row 8 (the out-of-bounds read), 31 after", () => {
    expect(factoryOpponentIv(table, 56, 1)).toBeNull();
    expect(factoryOpponentIv(table, 62, 1)).toBeNull();
    expect(factoryOpponentIv(table, 63, 1)).toBe(31);
  });

  it("gives the Factory Head the row two challenges ahead", () => {
    expect(factoryBrainIv(table, 21)).toBe(15); // Silver: challenge 2 → row 4
    expect(factoryBrainIv(table, 42)).toBe(31); // Gold: challenge 5 → row 7
  });
});

describe("Battle Pike", () => {
  it("changes tier after 20, 40 and 60 challenges of 14 rooms", () => {
    expect(pikeWildTier(280)).toBe(0);
    expect(pikeWildTier(281)).toBe(1);
    expect(pikeWildTier(560)).toBe(1);
    expect(pikeWildTier(840)).toBe(2);
    expect(pikeWildTier(841)).toBe(3);
  });

  it("computes wild levels, skipping the delta below level 60", () => {
    expect(pikeWildLevel("50", 4)).toBe(46);
    expect(pikeWildLevel("open", 4, 100)).toBe(96);
    expect(pikeWildLevel("open", 4, 62)).toBe(60);
    expect(pikeWildLevel("open", 4, 55)).toBe(60);
  });
});

describe("Battle Pyramid", () => {
  it("cycles through 20 rounds of 7 floors", () => {
    expect(pyramidRound(0)).toBe(0);
    expect(pyramidRound(7)).toBe(1);
    expect(pyramidRound(139)).toBe(19);
    expect(pyramidRound(140)).toBe(0);
  });

  it("gives levels ±5 around the listed level, or below the opponent level", () => {
    expect(pyramidWildLevels("50", 35)).toEqual({ min: 30, max: 40 });
    expect(pyramidWildLevels("open", 15, 100)).toEqual({ min: 80, max: 90 });
    expect(pyramidWildLevels("open", 15, 50)).toEqual({ min: 40, max: 50 });
  });
});

describe("Battle Dome", () => {
  it("indexes trainer ranges by championships, 5 opponents one range up", () => {
    expect(domeRangeChallenges(0)).toEqual({
      regularChallenge: 0,
      harderChallenge: 1,
    });
    expect(domeRangeChallenges(6)).toEqual({
      regularChallenge: 6,
      harderChallenge: 7,
    });
    expect(domeRangeChallenges(50)).toEqual({
      regularChallenge: 7,
      harderChallenge: 7,
    });
  });

  it("wraps after 255 championships (the game passes a u8)", () => {
    expect(domeRangeChallenges(255)).toEqual({
      regularChallenge: 7,
      harderChallenge: 0,
    });
    expect(domeRangeChallenges(256).regularChallenge).toBe(0);
  });
});

describe("narrowBySeen", () => {
  // Trainer 1: Abra, Onix. Trainer 2: Abra (another set), Onix, Jynx.
  // Trainer 3: Jynx only.
  const set = (id: number, pokemonId: number, trainerIds: number[]) => ({
    id,
    pokemonId,
    trainerIds,
    possibleIvs: [3, 6, 9],
  });
  const sets = [
    set(10, 63, [1]),
    set(11, 63, [2]),
    set(20, 95, [1, 2]),
    set(30, 124, [2, 3]),
  ];
  const ivOf = (t: number) => ({ 1: 3, 2: 6, 3: 9 })[t];

  it("changes nothing until something is seen", () => {
    expect(narrowBySeen(sets, [], ivOf)).toEqual({
      trainerIds: [1, 2, 3],
      sets,
    });
  });

  it("keeps the trainers with a set for every seen species", () => {
    const abra = narrowBySeen(sets, [63], ivOf);
    expect(abra.trainerIds).toEqual([1, 2]);
    // Jynx stays possible, but only from trainer 2, so only with IV 6.
    expect(abra.sets.find((s) => s.id === 30)).toMatchObject({
      trainerIds: [2],
      possibleIvs: [6],
    });
    expect(abra.sets.map((s) => s.id)).toEqual([10, 11, 20, 30]);

    const both = narrowBySeen(sets, [63, 124], ivOf);
    expect(both.trainerIds).toEqual([2]);
    // Trainer 1's Abra set is ruled out.
    expect(both.sets.map((s) => s.id)).toEqual([11, 20, 30]);
    expect(both.sets.every((s) => s.possibleIvs.join() === "6")).toBe(true);
  });

  it("is empty when no trainer has them all", () => {
    expect(narrowBySeen(sets, [63, 124, 95, 1], ivOf)).toEqual({
      trainerIds: [],
      sets: [],
    });
  });
});
