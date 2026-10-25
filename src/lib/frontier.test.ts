import { describe, expect, it } from "vitest";

import {
  battlePosition,
  brainBattle,
  frontierFriendship,
  opponentLevel,
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
