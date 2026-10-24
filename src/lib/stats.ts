/**
 * Gen 3 stat formulas, exactly as the games compute them (pret's
 * CalculateMonStats and ModifyStatByNature), with integer arithmetic.
 */
import type { Stat } from "@/db/schema";

export type StatSpread = Record<Stat, number>;

export type StatInput = {
  base: StatSpread;
  level: number;
  /** 0–31 each. */
  ivs: StatSpread;
  /** 0–255 each, 510 total. */
  evs: StatSpread;
  /** Null for neutral natures. */
  nature: { increasedStat: Stat | null; decreasedStat: Stat | null };
};

/** HP = ⌊(2·Base + IV + ⌊EV/4⌋) · Level / 100⌋ + Level + 10. Shedinja (base HP 1) always has 1 HP. */
export function hpStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
): number {
  if (base === 1) return 1;
  return (
    Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) +
    level +
    10
  );
}

/** Other stats = ⌊(⌊(2·Base + IV + ⌊EV/4⌋) · Level / 100⌋ + 5) · Nature⌋, Nature being 1.1, 1 or 0.9. */
export function otherStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  natureEffect: -1 | 0 | 1,
): number {
  const raw =
    Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  if (natureEffect === 1) return Math.floor((raw * 110) / 100);
  if (natureEffect === -1) return Math.floor((raw * 90) / 100);
  return raw;
}

export function calculateStats({
  base,
  level,
  ivs,
  evs,
  nature,
}: StatInput): StatSpread {
  const effect = (stat: Stat): -1 | 0 | 1 =>
    nature.increasedStat === nature.decreasedStat
      ? 0
      : stat === nature.increasedStat
        ? 1
        : stat === nature.decreasedStat
          ? -1
          : 0;
  return {
    hp: hpStat(base.hp, ivs.hp, evs.hp, level),
    attack: otherStat(
      base.attack,
      ivs.attack,
      evs.attack,
      level,
      effect("attack"),
    ),
    defense: otherStat(
      base.defense,
      ivs.defense,
      evs.defense,
      level,
      effect("defense"),
    ),
    speed: otherStat(base.speed, ivs.speed, evs.speed, level, effect("speed")),
    spAttack: otherStat(
      base.spAttack,
      ivs.spAttack,
      evs.spAttack,
      level,
      effect("spAttack"),
    ),
    spDefense: otherStat(
      base.spDefense,
      ivs.spDefense,
      evs.spDefense,
      level,
      effect("spDefense"),
    ),
  };
}

/** Same IV in every stat (trainers and the Frontier use one fixed IV for all six). */
export function uniformSpread(value: number): StatSpread {
  return {
    hp: value,
    attack: value,
    defense: value,
    speed: value,
    spAttack: value,
    spDefense: value,
  };
}
