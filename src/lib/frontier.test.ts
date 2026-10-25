import { describe, expect, it } from "vitest";

import {
  battlePosition,
  brainBattle,
  factoryBrainIv,
  factoryOpponentIv,
  frontierFriendship,
  opponentLevel,
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
