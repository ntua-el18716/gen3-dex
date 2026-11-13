import { describe, expect, it } from "vitest";

import { BALL_MULTIPLIER, captureChance } from "./catch-rate";

describe("captureChance", () => {
  it("follows the game's integer steps (Charizard, rate 45, full HP)", () => {
    // odds = 45 × 10/10 × 1/3 = 15; Sqrt(Sqrt(1114112)) = Sqrt(1055) = 32;
    // shake = 1048560 / 32 = 32767; chance = (32767 / 65536)^4.
    expect(captureChance(45)).toBeCloseTo((32767 / 65536) ** 4, 10);
    // Not the "rate / 255" shortcut (5.9%) other apps show.
    expect(captureChance(45)).toBeCloseTo(0.0625, 3);
  });

  it("gets the hardest case right (rate 3, full HP)", () => {
    // odds = 1; Sqrt(Sqrt(16711680)) = Sqrt(4087) = 63; shake = 16643.
    expect(captureChance(3)).toBeCloseTo((16643 / 65536) ** 4, 10);
  });

  it("rises with lower HP, better balls and status", () => {
    const full = captureChance(45);
    expect(captureChance(45, { hp: 1 })).toBeGreaterThan(full);
    expect(captureChance(45, { ball: BALL_MULTIPLIER.ultra })).toBeGreaterThan(
      full,
    );
    expect(captureChance(45, { status: "sleep" })).toBeGreaterThan(
      captureChance(45, { status: "paralysis" }),
    );
  });

  it("always catches once odds pass 254", () => {
    expect(captureChance(255, { ball: BALL_MULTIPLIER.ultra, hp: 1 })).toBe(1);
  });
});
