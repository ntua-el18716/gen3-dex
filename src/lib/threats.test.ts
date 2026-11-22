import { describe, expect, it } from "vitest";

import type { BattleMove, Battler, TypeMatchup } from "./damage";
import { uniformSpread } from "./stats";
import { assessThreats, type ThreatFoe, type ThreatSide } from "./threats";

const CHART: TypeMatchup[] = [
  { attackingType: "ground", defendingType: "flying", multiplier: 0 },
  { attackingType: "ground", defendingType: "fire", multiplier: 2 },
  { attackingType: "water", defendingType: "fire", multiplier: 2 },
];

const battler = (over: Partial<Battler> = {}): Battler => ({
  pokemonId: 1,
  level: 50,
  type1: "normal",
  type2: null,
  stats: { ...uniformSpread(100), hp: 150 },
  ivs: uniformSpread(31),
  ability: null,
  item: null,
  weightHg: 500,
  ...over,
});
const move = (name: string, over: Partial<BattleMove> = {}) => ({
  key: `MOVE_${name.toUpperCase()}`,
  name,
  type: "normal" as const,
  power: 80,
  effect: "EFFECT_HIT",
  ...over,
});
const foe = (setId: number, over: Partial<ThreatFoe> = {}): ThreatFoe => ({
  setId,
  battler: battler(),
  moves: [move("Tackle", { power: 40 })],
  abilities: [],
  ...over,
});

// A fire type with average stats, Speed 100.
const me: ThreatSide = {
  battler: battler({ type1: "fire" }),
  moves: [move("Body Slam", { power: 85 })],
};

describe("assessThreats", () => {
  it("ranks a faster one-hit KO as deadly and puts it first", () => {
    const quake = move("Earthquake", { type: "ground", power: 100 });
    const strongFast = battler({
      stats: { ...uniformSpread(100), hp: 150, attack: 300, speed: 120 },
    });
    const strongSlow = battler({
      stats: { ...uniformSpread(100), hp: 150, attack: 300, speed: 80 },
    });
    const threats = assessThreats(
      me,
      [
        foe(1),
        foe(2, { battler: strongSlow, moves: [quake] }),
        foe(3, { battler: strongFast, moves: [quake] }),
      ],
      CHART,
    );
    expect(threats.map((t) => [t.setId, t.level, t.order])).toEqual([
      [3, "deadly", "they"],
      [2, "dangerous", "you"],
      // Same Speed as yours: a tie.
      [1, "fine", "tie"],
    ]);
    expect(threats[0]!.theirBest).toMatchObject({ move: "Earthquake" });
    expect(threats[0]!.theirBest!.maxShare).toBeGreaterThanOrEqual(1);
  });

  it("counts half your HP before you move as dangerous", () => {
    const fast = battler({
      stats: { ...uniformSpread(100), hp: 150, attack: 150, speed: 120 },
    });
    const [t] = assessThreats(
      me,
      [foe(1, { battler: fast, moves: [move("Return", { power: 102 })] })],
      CHART,
    );
    expect(t!.theirBest!.maxShare).toBeGreaterThanOrEqual(0.5);
    expect(t!.theirBest!.maxShare).toBeLessThan(1);
    expect(t!.level).toBe("dangerous");
  });

  it("assumes the worse ability for you", () => {
    // With Huge Power it doubles its Attack; it might have either.
    const [t] = assessThreats(
      me,
      [foe(1, { abilities: ["ABILITY_THICK_FAT", "ABILITY_HUGE_POWER"] })],
      CHART,
    );
    const [plain] = assessThreats(
      me,
      [foe(1, { abilities: ["ABILITY_THICK_FAT"] })],
      CHART,
    );
    expect(t!.theirBest!.maxShare).toBeGreaterThan(plain!.theirBest!.maxShare);
  });

  it("applies Intimidate both ways when asked", () => {
    const intimidating: ThreatSide = {
      ...me,
      battler: { ...me.battler, ability: "ABILITY_INTIMIDATE" },
    };
    const [on] = assessThreats(intimidating, [foe(1)], CHART);
    const [off] = assessThreats(intimidating, [foe(1)], CHART, {
      intimidate: false,
    });
    expect(on!.theirBest!.maxShare).toBeLessThan(off!.theirBest!.maxShare);
  });

  it("flags one-hit KO moves unless the type is immune", () => {
    const fissure = move("Fissure", {
      type: "ground",
      power: 1,
      effect: "EFFECT_OHKO",
    });
    const [t] = assessThreats(me, [foe(1, { moves: [fissure] })], CHART);
    expect(t).toMatchObject({
      ohkoMove: "Fissure",
      level: "dangerous",
      theirBest: null,
    });
    const flyer: ThreatSide = {
      ...me,
      battler: { ...me.battler, type1: "flying" },
    };
    const [safe] = assessThreats(flyer, [foe(1, { moves: [fissure] })], CHART);
    expect(safe).toMatchObject({ ohkoMove: null, level: "fine" });
  });

  it("reports your best answer and speed ties", () => {
    const water: ThreatSide = {
      ...me,
      moves: [
        move("Tackle", { power: 40 }),
        move("Surf", { type: "water", power: 95 }),
      ],
    };
    const fireFoe = battler({ type1: "fire" });
    const [t] = assessThreats(water, [foe(1, { battler: fireFoe })], CHART);
    expect(t!.yourBest!.move).toBe("Surf");
    expect(t!.order).toBe("tie");
  });
});
