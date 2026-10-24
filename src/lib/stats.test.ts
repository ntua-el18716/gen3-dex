import { describe, expect, it } from "vitest";

import { damageClass } from "./damage-class";
import { calculateStats, hpStat, otherStat, uniformSpread } from "./stats";

describe("stat formulas", () => {
  // Bulbapedia's worked example (the formula is unchanged since Gen 3):
  // Garchomp Lv 78, Adamant, HP IV 24 / EV 74, Attack IV 12 / EV 190.
  it("matches the HP worked example", () => {
    expect(hpStat(108, 24, 74, 78)).toBe(289);
  });

  it("matches the Attack worked example with a boosting nature", () => {
    expect(otherStat(130, 12, 190, 78, 1)).toBe(278);
  });

  it("applies a hindering nature with integer arithmetic", () => {
    // raw = ⌊(2·100 + 31 + 0)·50/100⌋ + 5 = 120; 120 · 0.9 = 108
    expect(otherStat(100, 31, 0, 50, -1)).toBe(108);
  });

  it("gives Shedinja 1 HP at any level", () => {
    expect(hpStat(1, 31, 252, 100)).toBe(1);
  });

  it("computes a Battle Frontier Metagross at Lv 50", () => {
    // FRONTIER_MON_METAGROSS_1: Adamant, 170 Atk / 170 Spe / 170 Sp. Def, all IVs 31.
    const stats = calculateStats({
      base: {
        hp: 80,
        attack: 135,
        defense: 130,
        speed: 70,
        spAttack: 95,
        spDefense: 90,
      },
      level: 50,
      ivs: uniformSpread(31),
      evs: {
        hp: 0,
        attack: 170,
        defense: 0,
        speed: 170,
        spAttack: 0,
        spDefense: 170,
      },
      nature: { increasedStat: "attack", decreasedStat: "spAttack" },
    });
    expect(stats).toEqual({
      hp: 155,
      attack: 193,
      defense: 150,
      speed: 111,
      spAttack: 103,
      spDefense: 131,
    });
  });

  it("treats natures that raise and lower the same stat as neutral", () => {
    const base = {
      hp: 50,
      attack: 50,
      defense: 50,
      speed: 50,
      spAttack: 50,
      spDefense: 50,
    };
    const neutral = calculateStats({
      base,
      level: 50,
      ivs: uniformSpread(0),
      evs: uniformSpread(0),
      nature: { increasedStat: null, decreasedStat: null },
    });
    const hardy = calculateStats({
      base,
      level: 50,
      ivs: uniformSpread(0),
      evs: uniformSpread(0),
      nature: { increasedStat: "attack", decreasedStat: "attack" },
    });
    expect(hardy).toEqual(neutral);
  });
});

describe("Gen 3 damage class", () => {
  it("depends on the type, not the move", () => {
    expect(damageClass({ type: "ghost", power: 80 })).toBe("physical"); // Shadow Ball
    expect(damageClass({ type: "dark", power: 80 })).toBe("special"); // Crunch
    expect(damageClass({ type: "electric", power: 0 })).toBe("status"); // Thunder Wave
  });
});
