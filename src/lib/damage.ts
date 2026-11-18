/**
 * Gen 3 damage, as pokeemerald computes it: CalculateBaseDamage (pokemon.c),
 * then the critical-hit multiplier, STAB and type chart (Cmd_damagecalc and
 * Cmd_typecalc in battle_script_commands.c) and the random 85–100% roll
 * (ApplyRandomDmgMultiplier). Every step is integer arithmetic in the
 * game's order, so results match the cartridge exactly.
 *
 * Assumed, because the screens don't ask: both Pokémon at full HP, no
 * status conditions, no stat changes, no Reflect / Light Screen, single
 * battles. Pure functions; the data comes from src/db/damage-queries.ts.
 */
import { STATS, TYPES, type PokemonType } from "@/db/schema";

import { damageClass } from "./damage-class";
import type { StatSpread } from "./stats";

export type Weather = "clear" | "sun" | "rain";

/** One side of a battle. Abilities, items and moves use pret's constants. */
export type Battler = {
  /** National Dex number (some items only work for one species). */
  pokemonId: number;
  level: number;
  type1: PokemonType;
  type2: PokemonType | null;
  stats: StatSpread;
  /** For Hidden Power. */
  ivs: StatSpread;
  /** e.g. "ABILITY_LEVITATE". */
  ability: string | null;
  /** The held item's key ("ITEM_SEA_INCENSE") and hold effect, if any. */
  item: { key: string; holdEffect: string | null } | null;
  /** Hectograms, for Low Kick. */
  weightHg: number;
};

export type BattleMove = {
  /** e.g. "MOVE_STRUGGLE". */
  key: string;
  type: PokemonType;
  /** 0 = status move, 1 = calculated. */
  power: number;
  /** e.g. "EFFECT_MULTI_HIT". */
  effect: string;
};

/** A row of the game's type chart, in the game's order (it affects rounding). */
export type TypeMatchup = {
  attackingType: PokemonType;
  defendingType: PokemonType;
  /** 0, 0.5 or 2. */
  multiplier: number;
};

export type DamageOptions = {
  weather?: Weather;
  critical?: boolean;
  /** Soul Dew does nothing in the Battle Frontier. */
  frontier?: boolean;
};

export type DamageResult =
  /** Not a damaging move. */
  | { kind: "status" }
  /** The target's type or ability stops it. */
  | { kind: "immune"; by: "type" | "ability" }
  /** Depends on things outside this calculator. */
  | { kind: "varies"; why: "one-hit-ko" | "battle" | "random" }
  | {
      kind: "damage";
      /** Damage of one hit for each of the 16 random rolls, lowest first. */
      rolls: number[];
      /** How many times it hits: [2, 5] for Rock Blast, otherwise [1, 1]. */
      hits: [number, number];
      /** Type effectiveness: 0.25, 0.5, 1, 2 or 4. */
      effectiveness: number;
    };

const TYPE_BOOST_PERCENT = 10;
/** The Sea Incense is the weaker of the two Water-boosting items. */
const SEA_INCENSE_PERCENT = 5;

const SPECIES = {
  pikachu: 25,
  cubone: 104,
  marowak: 105,
  ditto: 132,
  clamperl: 366,
  latias: 380,
  latios: 381,
};

/** Abilities that absorb a whole type. */
const ABSORBS: Record<string, PokemonType> = {
  ABILITY_VOLT_ABSORB: "electric",
  ABILITY_WATER_ABSORB: "water",
  ABILITY_FLASH_FIRE: "fire",
};

/** Low Kick: [up to this weight in hectograms, power]; heavier is 120. */
const LOW_KICK: [number, number][] = [
  [100, 20],
  [250, 40],
  [500, 60],
  [1000, 80],
  [2000, 100],
];

const div = (a: number, b: number) => Math.floor(a / b);

/** Hidden Power's type and power, from the user's IVs (Cmd_hiddenpowercalc). */
export function hiddenPower(ivs: StatSpread): {
  type: PokemonType;
  power: number;
} {
  // The game's stat order: HP, Attack, Defense, Speed, Sp. Atk, Sp. Def.
  let typeBits = 0;
  let powerBits = 0;
  STATS.forEach((stat, i) => {
    typeBits |= (ivs[stat] & 1) << i;
    powerBits |= ((ivs[stat] & 2) >> 1) << i;
  });
  // Types 1–16 of the game's list, skipping Normal and "???".
  let type = div(15 * typeBits, 63) + 1;
  if (type >= TYPES.indexOf("???")) type++;
  return { type: TYPES[type]!, power: div(40 * powerBits, 63) + 30 };
}

/**
 * Type effectiveness and the damage after it, applied row by row like
 * Cmd_typecalc (each matching row rounds down, to at least 1).
 */
function applyTypeChart(
  damage: number,
  moveType: PokemonType,
  defender: Battler,
  chart: readonly TypeMatchup[],
) {
  let effectiveness = 1;
  const apply = (multiplier: number) => {
    effectiveness *= multiplier;
    damage = div(damage * (multiplier * 10), 10);
    if (damage === 0 && multiplier !== 0) damage = 1;
  };
  for (const row of chart) {
    if (row.attackingType !== moveType) continue;
    if (row.defendingType === defender.type1) apply(row.multiplier);
    if (
      row.defendingType === defender.type2 &&
      defender.type2 !== defender.type1
    )
      apply(row.multiplier);
  }
  return { damage, effectiveness };
}

/** What one use of `move` does to `defender`. */
export function calculateDamage(
  attacker: Battler,
  defender: Battler,
  move: BattleMove,
  chart: readonly TypeMatchup[],
  { weather = "clear", critical = false, frontier = false }: DamageOptions = {},
): DamageResult {
  if (move.power === 0) return { kind: "status" };

  let { type, power } = move;
  let hits: [number, number] = [1, 1];
  /** Damage that ignores stats: Seismic Toss, Dragon Rage… */
  let fixed: [number, number] | null = null;

  switch (move.effect) {
    case "EFFECT_OHKO":
      return { kind: "varies", why: "one-hit-ko" };
    case "EFFECT_COUNTER":
    case "EFFECT_MIRROR_COAT":
    case "EFFECT_BIDE":
    case "EFFECT_ENDEAVOR":
      return { kind: "varies", why: "battle" };
    case "EFFECT_MAGNITUDE":
    case "EFFECT_PRESENT":
    case "EFFECT_BEAT_UP":
    case "EFFECT_TRIPLE_KICK":
      return { kind: "varies", why: "random" };
    case "EFFECT_LEVEL_DAMAGE":
      fixed = [attacker.level, attacker.level];
      break;
    case "EFFECT_DRAGON_RAGE":
      fixed = [40, 40];
      break;
    case "EFFECT_SONICBOOM":
      fixed = [20, 20];
      break;
    case "EFFECT_SUPER_FANG": {
      // Half the target's HP, which is full here.
      const half = Math.max(1, div(defender.stats.hp, 2));
      fixed = [half, half];
      break;
    }
    case "EFFECT_PSYWAVE":
      // Level × 50–150%, in steps of 10%.
      fixed = [div(attacker.level * 50, 100), div(attacker.level * 150, 100)];
      break;
    case "EFFECT_HIDDEN_POWER":
      ({ type, power } = hiddenPower(attacker.ivs));
      break;
    case "EFFECT_RETURN":
    case "EFFECT_FRUSTRATION":
      // 10 × friendship / 25 at the friendship that suits the move (255 for
      // Return, 0 for Frustration, which is what Frontier Pokémon have).
      power = div(10 * 255, 25);
      break;
    case "EFFECT_LOW_KICK":
      power = LOW_KICK.find(([max]) => defender.weightHg < max)?.[1] ?? 120;
      break;
    case "EFFECT_FLAIL":
      power = 20; // at full HP
      break;
    case "EFFECT_WEATHER_BALL":
      if (weather !== "clear") {
        type = weather === "sun" ? "fire" : "water";
        power *= 2;
      }
      break;
    case "EFFECT_MULTI_HIT":
      hits = [2, 5];
      break;
    case "EFFECT_DOUBLE_HIT":
    case "EFFECT_TWINEEDLE":
      hits = [2, 2];
      break;
  }

  // Immunities from abilities come before any damage.
  if (defender.ability === "ABILITY_LEVITATE" && type === "ground")
    return { kind: "immune", by: "ability" };
  if (defender.ability && ABSORBS[defender.ability] === type)
    return { kind: "immune", by: "ability" };

  if (fixed) {
    // Fixed damage still can't hit a type that's immune to the move.
    const { effectiveness } = applyTypeChart(1, type, defender, chart);
    if (effectiveness === 0) return { kind: "immune", by: "type" };
    if (defender.ability === "ABILITY_WONDER_GUARD")
      return { kind: "immune", by: "ability" };
    const [low, high] = fixed;
    // 16 rolls like every other move, spread evenly over the range.
    const rolls = Array.from({ length: 16 }, (_, i) =>
      Math.max(1, low + div((high - low) * i, 15)),
    );
    return { kind: "damage", rolls, hits, effectiveness: 1 };
  }

  // --- CalculateBaseDamage --------------------------------------------------
  let attack = attacker.stats.attack;
  let defense = defender.stats.defense;
  let spAttack = attacker.stats.spAttack;
  let spDefense = defender.stats.spDefense;
  const physical = damageClass({ type, power }) === "physical";
  const atkEffect = attacker.item?.holdEffect ?? null;
  const defEffect = defender.item?.holdEffect ?? null;

  if (
    attacker.ability === "ABILITY_HUGE_POWER" ||
    attacker.ability === "ABILITY_PURE_POWER"
  )
    attack *= 2;

  // Type-boosting items: HOLD_EFFECT_FIRE_POWER for Charcoal, and so on.
  const boosted =
    type === "???" ? null : `HOLD_EFFECT_${type.toUpperCase()}_POWER`;
  if (atkEffect !== null && atkEffect === boosted) {
    const percent =
      attacker.item?.key === "ITEM_SEA_INCENSE"
        ? SEA_INCENSE_PERCENT
        : TYPE_BOOST_PERCENT;
    if (physical) attack = div(attack * (percent + 100), 100);
    else spAttack = div(spAttack * (percent + 100), 100);
  }

  if (atkEffect === "HOLD_EFFECT_CHOICE_BAND") attack = div(150 * attack, 100);
  const lati = (b: Battler) =>
    b.pokemonId === SPECIES.latias || b.pokemonId === SPECIES.latios;
  if (atkEffect === "HOLD_EFFECT_SOUL_DEW" && !frontier && lati(attacker))
    spAttack = div(150 * spAttack, 100);
  if (defEffect === "HOLD_EFFECT_SOUL_DEW" && !frontier && lati(defender))
    spDefense = div(150 * spDefense, 100);
  if (
    atkEffect === "HOLD_EFFECT_DEEP_SEA_TOOTH" &&
    attacker.pokemonId === SPECIES.clamperl
  )
    spAttack *= 2;
  if (
    defEffect === "HOLD_EFFECT_DEEP_SEA_SCALE" &&
    defender.pokemonId === SPECIES.clamperl
  )
    spDefense *= 2;
  if (
    atkEffect === "HOLD_EFFECT_LIGHT_BALL" &&
    attacker.pokemonId === SPECIES.pikachu
  )
    spAttack *= 2;
  if (
    defEffect === "HOLD_EFFECT_METAL_POWDER" &&
    defender.pokemonId === SPECIES.ditto
  )
    defense *= 2;
  if (
    atkEffect === "HOLD_EFFECT_THICK_CLUB" &&
    (attacker.pokemonId === SPECIES.cubone ||
      attacker.pokemonId === SPECIES.marowak)
  )
    attack *= 2;

  if (
    defender.ability === "ABILITY_THICK_FAT" &&
    (type === "fire" || type === "ice")
  )
    spAttack = div(spAttack, 2);
  if (attacker.ability === "ABILITY_HUSTLE") attack = div(150 * attack, 100);

  // Self-Destruct and Explosion halve the target's Defense.
  if (move.effect === "EFFECT_EXPLOSION") defense = div(defense, 2);

  const levelFactor = div(2 * attacker.level, 5) + 2;
  let damage: number;
  if (type === "???") {
    damage = 0;
  } else if (physical) {
    damage = div(div(attack * power * levelFactor, defense), 50);
    if (damage === 0) damage = 1;
  } else {
    damage = div(div(spAttack * power * levelFactor, spDefense), 50);
    if (weather === "rain") {
      if (type === "fire") damage = div(damage, 2);
      if (type === "water") damage = div(15 * damage, 10);
      if (move.effect === "EFFECT_SOLAR_BEAM") damage = div(damage, 2);
    }
    if (weather === "sun") {
      if (type === "fire") damage = div(15 * damage, 10);
      if (type === "water") damage = div(damage, 2);
    }
  }
  damage += 2;

  // --- Cmd_damagecalc, Cmd_typecalc -----------------------------------------
  // Future Sight and Doom Desire are stored when used: no critical hit, no
  // STAB, no type chart and no random roll.
  if (move.effect === "EFFECT_FUTURE_SIGHT") {
    return {
      kind: "damage",
      rolls: Array.from({ length: 16 }, () => damage),
      hits,
      effectiveness: 1,
    };
  }

  if (critical) damage *= 2;

  let effectiveness = 1;
  // Struggle has no type: no STAB and no type chart.
  if (move.key !== "MOVE_STRUGGLE") {
    if (type === attacker.type1 || type === attacker.type2)
      damage = div(damage * 15, 10);
    ({ damage, effectiveness } = applyTypeChart(damage, type, defender, chart));
    if (effectiveness === 0) return { kind: "immune", by: "type" };
    if (defender.ability === "ABILITY_WONDER_GUARD" && effectiveness <= 1)
      return { kind: "immune", by: "ability" };
  }

  // --- ApplyRandomDmgMultiplier: 85% to 100% --------------------------------
  const rolls = Array.from({ length: 16 }, (_, i) =>
    Math.max(1, div(damage * (85 + i), 100)),
  );
  return { kind: "damage", rolls, hits, effectiveness };
}

export type DamageSummary = {
  /** Total damage of one use, lowest and highest. */
  min: number;
  max: number;
  /** As a share of the target's HP (can exceed 1). */
  minShare: number;
  maxShare: number;
  /** Uses needed to knock out: fewest (best rolls) and most (worst rolls). */
  fewestUses: number;
  mostUses: number;
  /**
   * Chance one use knocks out from full HP, 0–1. Exact for single hits;
   * for multi-hit moves it's 1 or 0 only when the outcome is certain,
   * otherwise null.
   */
  koChance: number | null;
};

/** A result against a target with `hp` HP, as numbers a screen can show. */
export function summarize(
  result: Extract<DamageResult, { kind: "damage" }>,
  hp: number,
): DamageSummary {
  const low = result.rolls[0]!;
  const high = result.rolls[result.rolls.length - 1]!;
  const min = low * result.hits[0];
  const max = high * result.hits[1];
  let koChance: number | null;
  if (min >= hp) koChance = 1;
  else if (max < hp) koChance = 0;
  else if (result.hits[0] === result.hits[1])
    // Only exact for a single hit; two hits roll separately, so count pairs.
    koChance =
      result.hits[0] === 1
        ? result.rolls.filter((r) => r >= hp).length / result.rolls.length
        : result.rolls
            .flatMap((a) => result.rolls.map((b) => a + b))
            .filter((total) => total >= hp).length /
          result.rolls.length ** 2;
  else koChance = null;
  return {
    min,
    max,
    minShare: min / hp,
    maxShare: max / hp,
    fewestUses: Math.ceil(hp / max),
    mostUses: Math.ceil(hp / min),
    koChance,
  };
}
