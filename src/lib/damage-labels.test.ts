import { describe, expect, it } from "vitest";

import { FRESH_SIDE, type DamageSummary } from "./damage";
import {
  describeSide,
  effectivenessLabel,
  stageLabel,
  koText,
  noDamageText,
  shareRange,
} from "./damage-labels";

const summary = (over: Partial<DamageSummary>): DamageSummary => ({
  min: 40,
  max: 50,
  minShare: 0.4,
  maxShare: 0.5,
  fewestUses: 2,
  mostUses: 3,
  koChance: 0,
  ...over,
});

describe("damage labels", () => {
  it("shows the share of HP as a range", () => {
    expect(shareRange(summary({}))).toBe("40–50%");
    expect(shareRange(summary({ minShare: 0.425, maxShare: 0.429 }))).toBe(
      "42%",
    );
    expect(shareRange(summary({ minShare: 1.9, maxShare: 2.25 }))).toBe(
      "190–225%",
    );
  });

  it("says how soon the move knocks out", () => {
    expect(koText(summary({ koChance: 1 }))).toBe("Knocks out in one turn");
    expect(koText(summary({ koChance: 0.5 }))).toBe(
      "50% to knock out in one turn",
    );
    expect(koText(summary({ koChance: 0.001 }))).toBe(
      "1% to knock out in one turn",
    );
    expect(koText(summary({ koChance: 0.999 }))).toBe(
      "99% to knock out in one turn",
    );
    expect(koText(summary({ koChance: null }))).toBe(
      "Can knock out in one turn",
    );
    expect(koText(summary({}))).toBe("Knocks out in 2–3 turns");
    expect(koText(summary({ mostUses: 2 }))).toBe("Knocks out in 2 turns");
  });

  it("labels effectiveness only when it isn't neutral", () => {
    expect([4, 2, 1, 0.5, 0.25].map(effectivenessLabel)).toEqual([
      "4×",
      "2×",
      null,
      "½×",
      "¼×",
    ]);
  });

  it("explains moves without a damage range", () => {
    expect(noDamageText({ kind: "status" })).toBe("Status move");
    expect(noDamageText({ kind: "immune", by: "type" })).toBe(
      "Doesn’t affect its type",
    );
    expect(noDamageText({ kind: "immune", by: "ability" })).toBe(
      "Blocked by its ability",
    );
    expect(noDamageText({ kind: "varies", why: "one-hit-ko" })).toBe(
      "Knocks out if it lands",
    );
  });
});

describe("battle condition labels", () => {
  it("signs stages", () => {
    expect([2, 0, -1].map(stageLabel)).toEqual(["+2", "0", "−1"]);
  });
  it("sums up a side in one line", () => {
    expect(describeSide(FRESH_SIDE)).toBe("Full HP, healthy, no stat changes");
    expect(
      describeSide({
        ...FRESH_SIDE,
        hpPercent: 50,
        status: "burn",
        stages: { attack: 2, speed: -1, defense: 0 },
        reflect: true,
      }),
    ).toBe("50% HP · Burned · Atk +2 · Spe −1 · Reflect");
  });
});
