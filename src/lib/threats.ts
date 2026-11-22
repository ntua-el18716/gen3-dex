/**
 * The threat list: for each of your Pokémon, which of the opponent's
 * possible sets put it in danger. Built on the damage calculator
 * (lib/damage.ts); pure, so it's tested without a database.
 *
 * Per set, the opponent's ability is unknown (Frontier Pokémon get either
 * at random), so every candidate ability is tried and the worst case for
 * you is kept: their strongest hit, your weakest. Intimidate on either side
 * is applied on entry when asked. Single battles, full HP, no stat changes,
 * no critical hits.
 */
import {
  afterIntimidate,
  battleSpeed,
  calculateDamage,
  summarize,
  type BattleMove,
  type Battler,
  type TypeMatchup,
  type Weather,
} from "./damage";

export type ThreatSide = {
  battler: Battler;
  moves: (BattleMove & { name: string })[];
};

export type ThreatFoe = ThreatSide & {
  setId: number;
  /** Every ability the set's species can have (pret constants). */
  abilities: string[];
};

/** A move's best result against a target, as shares of the target's HP. */
export type HitSummary = {
  move: string;
  minShare: number;
  maxShare: number;
  /** Chance it knocks out from full HP in one use (null: can't say). */
  koChance: number | null;
};

export type ThreatLevel = "deadly" | "dangerous" | "fine";

export type Threat = {
  setId: number;
  /**
   * deadly: can knock you out in one hit before you move;
   * dangerous: can knock you out in one hit but you move first, or takes
   * at least half your HP before you move, or has a one-hit KO move.
   */
  level: ThreatLevel;
  /** Their strongest move against you (null: nothing that hurts). */
  theirBest: HitSummary | null;
  /** Your strongest move against them (null: nothing that hurts). */
  yourBest: HitSummary | null;
  /** Who moves first, by battle Speed. */
  order: "they" | "you" | "tie";
  /** A one-hit KO move (Fissure, Sheer Cold…) they have, if any. */
  ohkoMove: string | null;
};

/** The strongest hit `attacker` has against `defender`. */
function bestHit(
  attacker: ThreatSide,
  defender: Battler,
  chart: readonly TypeMatchup[],
  weather: Weather,
): { best: HitSummary | null; ohkoMove: string | null } {
  let best: HitSummary | null = null;
  let ohkoMove: string | null = null;
  for (const move of attacker.moves) {
    const result = calculateDamage(attacker.battler, defender, move, chart, {
      weather,
      frontier: true,
    });
    if (result.kind === "varies" && result.why === "one-hit-ko") {
      // Still subject to the type chart (Fissure can't hit Flying types).
      const typeCheck = calculateDamage(
        attacker.battler,
        defender,
        { ...move, power: 100, effect: "EFFECT_HIT" },
        chart,
        { weather, frontier: true },
      );
      if (typeCheck.kind === "damage") ohkoMove = move.name;
      continue;
    }
    if (result.kind !== "damage") continue;
    const s = summarize(result, defender.currentHp ?? defender.stats.hp);
    if (!best || s.maxShare > best.maxShare)
      best = {
        move: move.name,
        minShare: s.minShare,
        maxShare: s.maxShare,
        koChance: s.koChance,
      };
  }
  return { best, ohkoMove };
}

const RANK: Record<ThreatLevel, number> = { deadly: 0, dangerous: 1, fine: 2 };

/**
 * How dangerous each possible set is to `member`, most dangerous first
 * (deadly, then dangerous, then by how hard they hit).
 */
export function assessThreats(
  member: ThreatSide,
  foes: ThreatFoe[],
  chart: readonly TypeMatchup[],
  {
    weather = "clear",
    intimidate = true,
  }: { weather?: Weather; intimidate?: boolean } = {},
): Threat[] {
  const threats = foes.map((foe): Threat => {
    let theirBest: HitSummary | null = null;
    let yourBest: HitSummary | null = null;
    let ohkoMove: string | null = null;
    let order: Threat["order"] = "you";
    const abilities = foe.abilities.length > 0 ? foe.abilities : [null];
    abilities.forEach((ability, i) => {
      let theirs: Battler = { ...foe.battler, ability };
      let mine = member.battler;
      if (intimidate) {
        const before = { mine, theirs };
        theirs = afterIntimidate(before.mine, before.theirs);
        mine = afterIntimidate(before.theirs, before.mine);
      }
      const them = bestHit({ ...foe, battler: theirs }, mine, chart, weather);
      const you = bestHit({ ...member, battler: mine }, theirs, chart, weather);
      // Worst case for you: their strongest version, your weakest answer.
      if (them.best && (!theirBest || them.best.maxShare > theirBest.maxShare))
        theirBest = them.best;
      if (
        i === 0 ||
        !you.best ||
        (yourBest && you.best.maxShare < yourBest.maxShare)
      )
        yourBest = you.best;
      ohkoMove ??= them.ohkoMove;
      const mySpeed = battleSpeed(mine, weather);
      const theirSpeed = battleSpeed(theirs, weather);
      const o =
        theirSpeed > mySpeed ? "they" : theirSpeed < mySpeed ? "you" : "tie";
      // Any version that's faster counts as faster.
      if (o === "they" || (o === "tie" && order === "you")) order = o;
    });
    const hit = theirBest as HitSummary | null;
    const canKo = hit !== null && hit.maxShare >= 1;
    const before = order !== "you";
    const level: ThreatLevel =
      canKo && before
        ? "deadly"
        : canKo || (before && hit !== null && hit.maxShare >= 0.5) || ohkoMove
          ? "dangerous"
          : "fine";
    return { setId: foe.setId, level, theirBest, yourBest, order, ohkoMove };
  });
  return threats.sort(
    (a, b) =>
      RANK[a.level] - RANK[b.level] ||
      (b.theirBest?.maxShare ?? 0) - (a.theirBest?.maxShare ?? 0),
  );
}
