import { describe, expect, it } from "vitest";

import {
  afterIntimidate,
  applyStage,
  battleSpeed,
  calculateDamage,
  FRESH_SIDE,
  hiddenPower,
  summarize,
  withConditions,
  type BattleMove,
  type Battler,
  type DamageResult,
  type TypeMatchup,
} from "./damage";
import { uniformSpread } from "./stats";

/** The rows these tests need, in the game's order. */
const CHART: TypeMatchup[] = [
  { attackingType: "normal", defendingType: "rock", multiplier: 0.5 },
  { attackingType: "fire", defendingType: "water", multiplier: 0.5 },
  { attackingType: "fire", defendingType: "grass", multiplier: 2 },
  { attackingType: "water", defendingType: "fire", multiplier: 2 },
  { attackingType: "electric", defendingType: "water", multiplier: 2 },
  { attackingType: "electric", defendingType: "ground", multiplier: 0 },
  { attackingType: "ground", defendingType: "flying", multiplier: 0 },
  { attackingType: "ground", defendingType: "fire", multiplier: 2 },
  { attackingType: "ground", defendingType: "rock", multiplier: 2 },
  { attackingType: "ground", defendingType: "grass", multiplier: 0.5 },
  { attackingType: "fighting", defendingType: "ghost", multiplier: 0 },
  { attackingType: "normal", defendingType: "ghost", multiplier: 0 },
  { attackingType: "psychic", defendingType: "dark", multiplier: 0 },
];

const mon = (over: Partial<Battler> = {}): Battler => ({
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
const move = (over: Partial<BattleMove> = {}): BattleMove => ({
  key: "MOVE_TEST",
  type: "ground",
  power: 100,
  effect: "EFFECT_HIT",
  ...over,
});
const strong = mon({ stats: { ...uniformSpread(100), attack: 150 } });

function rolls(result: DamageResult): number[] {
  if (result.kind !== "damage")
    throw new Error(`Expected damage: ${result.kind}`);
  return result.rolls;
}
const max = (result: DamageResult) => rolls(result).at(-1)!;

describe("calculateDamage", () => {
  it("follows the formula with integer division", () => {
    // 150 Atk × 100 power × (2·50/5 + 2 = 22) = 330,000; / 100 Def = 3,300;
    // / 50 = 66; + 2 = 68. Rolls are 85%–100% of that, rounded down.
    const r = rolls(calculateDamage(strong, mon(), move(), CHART));
    expect(r).toHaveLength(16);
    expect(r[0]).toBe(57);
    expect(r[15]).toBe(68);
    expect(r).toEqual([...r].sort((a, b) => a - b));
  });

  it("uses Sp. Atk and Sp. Def for special types (Gen 3: by type)", () => {
    const special = mon({ stats: { ...uniformSpread(100), spAttack: 150 } });
    expect(
      max(calculateDamage(special, mon(), move({ type: "dark" }), CHART)),
    ).toBe(68);
    // Shadow Ball is physical: the Sp. Atk doesn't help.
    expect(
      max(calculateDamage(special, mon(), move({ type: "ghost" }), CHART)),
    ).toBe(46);
  });

  it("adds STAB, then type effectiveness, each rounded down", () => {
    const stab = { ...strong, type1: "ground" as const };
    expect(max(calculateDamage(stab, mon(), move(), CHART))).toBe(102);
    const fire = mon({ type1: "fire" });
    const fireRock = mon({ type1: "fire", type2: "rock" });
    const grass = mon({ type1: "grass" });
    expect(calculateDamage(strong, fire, move(), CHART)).toMatchObject({
      effectiveness: 2,
    });
    expect(max(calculateDamage(strong, fire, move(), CHART))).toBe(136);
    expect(max(calculateDamage(strong, fireRock, move(), CHART))).toBe(272);
    expect(max(calculateDamage(strong, grass, move(), CHART))).toBe(34);
    // 2× and ½× cancel out.
    expect(
      calculateDamage(
        strong,
        mon({ type1: "fire", type2: "grass" }),
        move(),
        CHART,
      ),
    ).toMatchObject({ effectiveness: 1 });
  });

  it("doubles on a critical hit", () => {
    expect(
      max(calculateDamage(strong, mon(), move(), CHART, { critical: true })),
    ).toBe(136);
  });

  it("never does less than 1", () => {
    const weak = mon({ level: 1, stats: uniformSpread(5) });
    const wall = mon({ type1: "rock", stats: uniformSpread(400) });
    const r = rolls(
      calculateDamage(weak, wall, move({ type: "normal", power: 10 }), CHART),
    );
    expect(r[0]).toBe(1);
  });

  describe("immunities", () => {
    it("from types", () => {
      expect(
        calculateDamage(strong, mon({ type2: "flying" }), move(), CHART),
      ).toEqual({
        kind: "immune",
        by: "type",
      });
    });
    it("from Levitate, the absorbing abilities and Wonder Guard", () => {
      const immune = { kind: "immune", by: "ability" };
      expect(
        calculateDamage(
          strong,
          mon({ ability: "ABILITY_LEVITATE" }),
          move(),
          CHART,
        ),
      ).toEqual(immune);
      for (const [ability, type] of [
        ["ABILITY_VOLT_ABSORB", "electric"],
        ["ABILITY_WATER_ABSORB", "water"],
        ["ABILITY_FLASH_FIRE", "fire"],
      ] as const)
        expect(
          calculateDamage(strong, mon({ ability }), move({ type }), CHART),
        ).toEqual(immune);
      const shedinja = mon({ type1: "fire", ability: "ABILITY_WONDER_GUARD" });
      expect(
        calculateDamage(strong, shedinja, move({ type: "normal" }), CHART),
      ).toEqual(immune);
      expect(calculateDamage(strong, shedinja, move(), CHART).kind).toBe(
        "damage",
      );
    });
  });

  describe("abilities and items", () => {
    const base = max(calculateDamage(strong, mon(), move(), CHART));
    const withAttacker = (over: Partial<Battler>, m = move()) =>
      max(calculateDamage({ ...strong, ...over }, mon(), m, CHART));
    it("Huge Power and Pure Power double Attack", () => {
      expect(withAttacker({ ability: "ABILITY_HUGE_POWER" })).toBe(134);
      expect(withAttacker({ ability: "ABILITY_PURE_POWER" })).toBe(134);
    });
    it("Choice Band and Hustle give 1.5× Attack", () => {
      const band = {
        key: "ITEM_CHOICE_BAND",
        holdEffect: "HOLD_EFFECT_CHOICE_BAND",
      };
      expect(withAttacker({ item: band })).toBe(101);
      expect(withAttacker({ ability: "ABILITY_HUSTLE" })).toBe(101);
    });
    it("type items boost their type by 10% (Sea Incense 5%)", () => {
      const sand = {
        key: "ITEM_SOFT_SAND",
        holdEffect: "HOLD_EFFECT_GROUND_POWER",
      };
      expect(withAttacker({ item: sand })).toBe(74);
      // Only its own type (a Normal move here, with STAB either way).
      expect(withAttacker({ item: sand }, move({ type: "normal" }))).toBe(
        withAttacker({}, move({ type: "normal" })),
      );
      expect(base).toBe(68);
      const water = move({ type: "water" });
      const sp = { stats: { ...uniformSpread(100), spAttack: 200 } };
      const held = (key: string) => ({
        key,
        holdEffect: "HOLD_EFFECT_WATER_POWER",
      });
      expect(withAttacker(sp, water)).toBe(90);
      expect(
        withAttacker({ ...sp, item: held("ITEM_MYSTIC_WATER") }, water),
      ).toBe(98);
      expect(
        withAttacker({ ...sp, item: held("ITEM_SEA_INCENSE") }, water),
      ).toBe(94);
    });
    it("species items only work for their species", () => {
      const club = {
        key: "ITEM_THICK_CLUB",
        holdEffect: "HOLD_EFFECT_THICK_CLUB",
      };
      expect(withAttacker({ item: club })).toBe(base);
      expect(withAttacker({ item: club, pokemonId: 105 })).toBe(134);
    });
    it("Soul Dew works outside the Frontier only", () => {
      const latios = mon({
        pokemonId: 381,
        stats: { ...uniformSpread(100), spAttack: 150 },
        item: { key: "ITEM_SOUL_DEW", holdEffect: "HOLD_EFFECT_SOUL_DEW" },
      });
      const dark = move({ type: "dark" });
      expect(max(calculateDamage(latios, mon(), dark, CHART))).toBe(101);
      expect(
        max(calculateDamage(latios, mon(), dark, CHART, { frontier: true })),
      ).toBe(68);
    });
    it("Thick Fat halves Fire and Ice", () => {
      const fat = mon({ ability: "ABILITY_THICK_FAT" });
      const sp = mon({ stats: { ...uniformSpread(100), spAttack: 150 } });
      expect(max(calculateDamage(sp, fat, move({ type: "ice" }), CHART))).toBe(
        35,
      );
      expect(max(calculateDamage(sp, fat, move({ type: "dark" }), CHART))).toBe(
        68,
      );
    });
  });

  it("applies sun and rain to Fire and Water", () => {
    const sp = mon({ stats: { ...uniformSpread(100), spAttack: 150 } });
    const hit = (type: "fire" | "water", weather: "sun" | "rain") =>
      max(calculateDamage(sp, mon(), move({ type }), CHART, { weather }));
    expect(hit("fire", "sun")).toBe(101);
    expect(hit("water", "sun")).toBe(35);
    expect(hit("water", "rain")).toBe(101);
    expect(hit("fire", "rain")).toBe(35);
  });

  describe("special moves", () => {
    it("status moves do nothing", () => {
      expect(calculateDamage(strong, mon(), move({ power: 0 }), CHART)).toEqual(
        {
          kind: "status",
        },
      );
    });
    it("fixed damage ignores stats but not immunities", () => {
      const toss = move({
        type: "fighting",
        power: 1,
        effect: "EFFECT_LEVEL_DAMAGE",
      });
      expect(rolls(calculateDamage(strong, mon(), toss, CHART))).toEqual(
        Array(16).fill(50),
      );
      expect(
        calculateDamage(strong, mon({ type1: "ghost" }), toss, CHART),
      ).toEqual({
        kind: "immune",
        by: "type",
      });
      const rage = move({
        type: "dragon",
        power: 1,
        effect: "EFFECT_DRAGON_RAGE",
      });
      expect(max(calculateDamage(strong, mon(), rage, CHART))).toBe(40);
      const fang = move({
        type: "normal",
        power: 1,
        effect: "EFFECT_SUPER_FANG",
      });
      expect(max(calculateDamage(strong, mon(), fang, CHART))).toBe(75);
      const wave = move({
        type: "psychic",
        power: 1,
        effect: "EFFECT_PSYWAVE",
      });
      const r = rolls(calculateDamage(strong, mon(), wave, CHART));
      expect([r[0], r[15]]).toEqual([25, 75]);
    });
    it("Return and Frustration are 102 power at their best", () => {
      const ret = move({ type: "normal", power: 1, effect: "EFFECT_RETURN" });
      const plain = move({ type: "normal", power: 102 });
      expect(calculateDamage(strong, mon(), ret, CHART)).toEqual(
        calculateDamage(strong, mon(), plain, CHART),
      );
    });
    it("Low Kick goes by the target's weight", () => {
      const kick = move({
        type: "fighting",
        power: 1,
        effect: "EFFECT_LOW_KICK",
      });
      const power = (weightHg: number) =>
        max(calculateDamage(strong, mon({ weightHg }), kick, CHART));
      const plain = (p: number) =>
        max(
          calculateDamage(
            strong,
            mon(),
            move({ type: "fighting", power: p }),
            CHART,
          ),
        );
      expect(power(99)).toBe(plain(20));
      expect(power(100)).toBe(plain(40));
      expect(power(1999)).toBe(plain(100));
      expect(power(2000)).toBe(plain(120));
    });
    it("Explosion halves the target's Defense", () => {
      const boom = move({
        type: "normal",
        power: 250,
        effect: "EFFECT_EXPLOSION",
      });
      // (150 × 250 × 22 / 50 Def / 50 + 2) × 1.5 STAB
      expect(max(calculateDamage(strong, mon(), boom, CHART))).toBe(498);
    });
    it("multi-hit moves report one hit and how many times", () => {
      const blast = move({
        type: "rock",
        power: 25,
        effect: "EFFECT_MULTI_HIT",
      });
      expect(calculateDamage(strong, mon(), blast, CHART)).toMatchObject({
        hits: [2, 5],
      });
      const kick = move({
        type: "fighting",
        power: 30,
        effect: "EFFECT_DOUBLE_HIT",
      });
      expect(calculateDamage(strong, mon(), kick, CHART)).toMatchObject({
        hits: [2, 2],
      });
    });
    it("Weather Ball changes with the weather", () => {
      const ball = move({
        type: "normal",
        power: 50,
        effect: "EFFECT_WEATHER_BALL",
      });
      const sp = mon({ stats: { ...uniformSpread(100), spAttack: 150 } });
      // Fire, 100 power, boosted by the sun: (66 × 1.5) + 2
      expect(
        max(calculateDamage(sp, mon(), ball, CHART, { weather: "sun" })),
      ).toBe(101);
      expect(
        calculateDamage(sp, mon({ type1: "grass" }), ball, CHART, {
          weather: "sun",
        }),
      ).toMatchObject({ effectiveness: 2 });
    });
    it("Future Sight is typeless and never varies", () => {
      const sight = move({
        type: "psychic",
        power: 80,
        effect: "EFFECT_FUTURE_SIGHT",
      });
      const psychic = mon({
        type1: "psychic",
        stats: { ...uniformSpread(100), spAttack: 150 },
      });
      const r = rolls(
        calculateDamage(psychic, mon({ type1: "dark" }), sight, CHART),
      );
      // 150 × 80 × 22 / 100 / 50 + 2, no STAB, hits Dark types.
      expect(new Set(r)).toEqual(new Set([54]));
    });
    it("Struggle has no STAB and hits Ghosts", () => {
      const struggle = move({
        key: "MOVE_STRUGGLE",
        type: "normal",
        power: 50,
        effect: "EFFECT_RECOIL",
      });
      expect(
        max(calculateDamage(strong, mon({ type1: "ghost" }), struggle, CHART)),
      ).toBe(35);
    });
    it("says so when it can't know", () => {
      const why = (effect: string) =>
        calculateDamage(strong, mon(), move({ power: 1, effect }), CHART);
      expect(why("EFFECT_OHKO")).toEqual({ kind: "varies", why: "one-hit-ko" });
      expect(why("EFFECT_COUNTER")).toEqual({ kind: "varies", why: "battle" });
      expect(why("EFFECT_MAGNITUDE")).toEqual({
        kind: "varies",
        why: "random",
      });
    });
  });
});

describe("hiddenPower", () => {
  const ivs = (
    hp: number,
    attack: number,
    defense: number,
    speed: number,
    spAttack: number,
    spDefense: number,
  ) => ({ hp, attack, defense, speed, spAttack, spDefense });
  it("matches the well-known spreads", () => {
    expect(hiddenPower(uniformSpread(31))).toEqual({ type: "dark", power: 70 });
    expect(hiddenPower(ivs(31, 30, 30, 31, 31, 31))).toEqual({
      type: "ice",
      power: 70,
    });
    expect(hiddenPower(ivs(31, 30, 31, 30, 30, 31))).toEqual({
      type: "fire",
      power: 70,
    });
    expect(hiddenPower(ivs(31, 31, 31, 31, 30, 31))).toEqual({
      type: "electric",
      power: 70,
    });
    expect(hiddenPower(ivs(31, 30, 31, 31, 30, 31))).toEqual({
      type: "grass",
      power: 70,
    });
    expect(hiddenPower(uniformSpread(0))).toEqual({
      type: "fighting",
      power: 30,
    });
  });
  it("is what Frontier Pokémon get from one fixed IV", () => {
    // IV 3 = binary 11: every bit set, like 31.
    expect(hiddenPower(uniformSpread(3))).toEqual({ type: "dark", power: 70 });
    // IV 6 = binary 110: type bits clear, power bits set.
    expect(hiddenPower(uniformSpread(6))).toEqual({
      type: "fighting",
      power: 70,
    });
  });
});

describe("summarize", () => {
  const result = (rolls: number[], hits: [number, number] = [1, 1]) =>
    ({ kind: "damage", rolls, hits, effectiveness: 1 }) as const;
  const sixteen = Array.from({ length: 16 }, (_, i) => 85 + i); // 85…100

  it("gives shares of HP and uses to knock out", () => {
    expect(summarize(result(sixteen), 200)).toEqual({
      min: 85,
      max: 100,
      minShare: 0.425,
      maxShare: 0.5,
      fewestUses: 2,
      mostUses: 3,
      koChance: 0,
    });
  });
  it("counts the rolls that knock out in one hit", () => {
    expect(summarize(result(sixteen), 85).koChance).toBe(1);
    expect(summarize(result(sixteen), 93).koChance).toBe(0.5);
    expect(summarize(result(sixteen), 101).koChance).toBe(0);
  });
  it("adds up multi-hit moves", () => {
    const double = summarize(result(sixteen, [2, 2]), 186);
    expect([double.min, double.max]).toEqual([170, 200]);
    // 16 × 16 pairs; those totalling 186 or more.
    expect(double.koChance).toBeCloseTo(120 / 256);
    const blast = summarize(result(sixteen, [2, 5]), 300);
    expect([blast.min, blast.max, blast.koChance]).toEqual([170, 500, null]);
  });
});

describe("battle conditions", () => {
  it("scales stats by stage like gStatStageRatios", () => {
    expect([-6, -1, 0, 1, 2, 6].map((s) => applyStage(100, s))).toEqual([
      25, 66, 100, 150, 200, 400,
    ]);
    expect(applyStage(100, 9)).toBe(400);
  });

  it("applies Attack and Defense stages", () => {
    const plus2 = { ...strong, stages: { attack: 2 } };
    // 300 Atk: 300 × 100 × 22 / 100 / 50 + 2 = 134
    expect(max(calculateDamage(plus2, mon(), move(), CHART))).toBe(134);
    const wall = mon({ stages: { defense: 1 } });
    // 100 Def → 150: 330,000 / 150 / 50 + 2 = 46
    expect(max(calculateDamage(strong, wall, move(), CHART))).toBe(46);
  });

  it("ignores bad stages for the attacker on a critical hit", () => {
    const crit = { critical: true };
    const minus = { ...strong, stages: { attack: -2 } };
    const walled = mon({ stages: { defense: 2 } });
    const plain = max(calculateDamage(strong, mon(), move(), CHART, crit));
    expect(max(calculateDamage(minus, mon(), move(), CHART, crit))).toBe(plain);
    expect(max(calculateDamage(strong, walled, move(), CHART, crit))).toBe(
      plain,
    );
    // Good stages still count.
    const plus = { ...strong, stages: { attack: 2 } };
    expect(
      max(calculateDamage(plus, mon(), move(), CHART, crit)),
    ).toBeGreaterThan(plain);
  });

  it("halves physical damage when burned, unless the attacker has Guts", () => {
    const burned = { ...strong, status: "burn" as const };
    // (330,000 / 100 / 50 = 66) / 2 = 33, + 2
    expect(max(calculateDamage(burned, mon(), move(), CHART))).toBe(35);
    const guts = { ...burned, ability: "ABILITY_GUTS" };
    // Guts: 1.5× Attack and no burn penalty: 225 Atk → 99 + 2
    expect(max(calculateDamage(guts, mon(), move(), CHART))).toBe(101);
    // Burn doesn't touch special moves.
    const sp = mon({
      stats: { ...uniformSpread(100), spAttack: 150 },
      status: "burn",
    });
    expect(max(calculateDamage(sp, mon(), move({ type: "dark" }), CHART))).toBe(
      68,
    );
  });

  it("Marvel Scale raises Defense with a status condition", () => {
    const scale = mon({ ability: "ABILITY_MARVEL_SCALE" });
    expect(max(calculateDamage(strong, scale, move(), CHART))).toBe(68);
    const poisoned = { ...scale, status: "poison" as const };
    expect(max(calculateDamage(strong, poisoned, move(), CHART))).toBe(46);
  });

  it("Reflect and Light Screen halve damage, but not critical hits", () => {
    expect(
      max(calculateDamage(strong, mon(), move(), CHART, { reflect: true })),
    ).toBe(35);
    const sp = mon({ stats: { ...uniformSpread(100), spAttack: 150 } });
    const dark = move({ type: "dark" });
    expect(
      max(calculateDamage(sp, mon(), dark, CHART, { lightScreen: true })),
    ).toBe(35);
    // Reflect does nothing to special moves.
    expect(
      max(calculateDamage(sp, mon(), dark, CHART, { reflect: true })),
    ).toBe(68);
    expect(
      max(
        calculateDamage(strong, mon(), move(), CHART, {
          reflect: true,
          critical: true,
        }),
      ),
    ).toBe(136);
  });

  it("Facade doubles with burn, poison or paralysis", () => {
    const facade = move({ type: "normal", power: 70, effect: "EFFECT_FACADE" });
    const base = max(calculateDamage(strong, mon(), facade, CHART));
    const para = { ...strong, status: "paralysis" as const };
    expect(max(calculateDamage(para, mon(), facade, CHART))).toBe(2 * base);
    const asleep = { ...strong, status: "sleep" as const };
    expect(max(calculateDamage(asleep, mon(), facade, CHART))).toBe(base);
  });

  it("pinch abilities boost their type at a third of HP", () => {
    const blaze = mon({
      type1: "fire",
      ability: "ABILITY_BLAZE",
      stats: { ...uniformSpread(100), hp: 150, spAttack: 150 },
    });
    const ember = move({ type: "fire" });
    const full = max(calculateDamage(blaze, mon(), ember, CHART));
    expect(
      max(calculateDamage({ ...blaze, currentHp: 51 }, mon(), ember, CHART)),
    ).toBe(full);
    expect(
      max(calculateDamage({ ...blaze, currentHp: 50 }, mon(), ember, CHART)),
    ).toBeGreaterThan(full);
  });

  it("Flail, Reversal, Eruption and Super Fang follow the HP left", () => {
    const flail = move({ type: "normal", power: 1, effect: "EFFECT_FLAIL" });
    const at = (hp: number, p: number) =>
      expect(
        max(calculateDamage({ ...strong, currentHp: hp }, mon(), flail, CHART)),
      ).toBe(
        max(
          calculateDamage(
            strong,
            mon(),
            move({ type: "normal", power: p }),
            CHART,
          ),
        ),
      );
    // 100 max HP: HP left in 48ths → 200 / 150 / 100 / 80 / 40 / 20.
    at(2, 200);
    at(8, 150);
    at(18, 100);
    at(33, 80);
    at(66, 40);
    at(100, 20);
    const spout = move({
      type: "water",
      power: 150,
      effect: "EFFECT_ERUPTION",
    });
    const sp = mon({
      stats: { ...uniformSpread(100), hp: 150, spAttack: 150 },
    });
    const plain = (p: number) =>
      max(calculateDamage(sp, mon(), move({ type: "water", power: p }), CHART));
    expect(
      max(calculateDamage({ ...sp, currentHp: 75 }, mon(), spout, CHART)),
    ).toBe(plain(75));
    expect(
      max(calculateDamage({ ...sp, currentHp: 1 }, mon(), spout, CHART)),
    ).toBe(plain(1));
    const fang = move({
      type: "normal",
      power: 1,
      effect: "EFFECT_SUPER_FANG",
    });
    expect(
      max(calculateDamage(strong, mon({ currentHp: 61 }), fang, CHART)),
    ).toBe(30);
  });

  it("Intimidate lowers Attack unless an ability stops it", () => {
    const gyarados = mon({ ability: "ABILITY_INTIMIDATE" });
    expect(afterIntimidate(gyarados, strong).stages).toEqual({ attack: -1 });
    expect(afterIntimidate(mon(), strong)).toBe(strong);
    const metagross = mon({ ability: "ABILITY_CLEAR_BODY" });
    expect(afterIntimidate(gyarados, metagross)).toBe(metagross);
    const floored = mon({ stages: { attack: -6 } });
    expect(afterIntimidate(gyarados, floored).stages?.attack).toBe(-6);
  });

  it("works out battle Speed like the game", () => {
    const fast = mon({ stats: { ...uniformSpread(100), speed: 101 } });
    expect(battleSpeed(fast)).toBe(101);
    expect(battleSpeed({ ...fast, stages: { speed: 1 } })).toBe(151);
    expect(battleSpeed({ ...fast, status: "paralysis" })).toBe(25);
    const swim = { ...fast, ability: "ABILITY_SWIFT_SWIM" };
    expect(battleSpeed(swim, "rain")).toBe(202);
    expect(battleSpeed(swim, "sun")).toBe(101);
    const brace = {
      ...fast,
      item: { key: "ITEM_MACHO_BRACE", holdEffect: "HOLD_EFFECT_MACHO_BRACE" },
    };
    expect(battleSpeed(brace)).toBe(50);
  });
});

describe("summarize from part HP", () => {
  it("measures against the HP left", () => {
    const rolls = Array.from({ length: 16 }, (_, i) => 85 + i);
    const s = summarize(
      { kind: "damage", rolls, hits: [1, 1], effectiveness: 1 },
      90,
    );
    expect(s.koChance).toBe(11 / 16);
  });
});

describe("withConditions", () => {
  it("puts a battler in a side's conditions", () => {
    const b = withConditions(mon(), {
      ...FRESH_SIDE,
      hpPercent: 33,
      status: "poison",
      stages: { speed: 2 },
    });
    expect(b).toMatchObject({
      currentHp: 49,
      status: "poison",
      stages: { speed: 2 },
    });
    expect(
      withConditions(mon(), { ...FRESH_SIDE, hpPercent: 0 }).currentHp,
    ).toBe(1);
    expect(withConditions(mon(), FRESH_SIDE).currentHp).toBe(150);
  });
});
