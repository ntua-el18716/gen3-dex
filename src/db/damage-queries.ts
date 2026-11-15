import { and, eq, inArray, sql } from "drizzle-orm";

import type { BattleMove, Battler, TypeMatchup } from "@/lib/damage";
import { calculateStats, uniformSpread, type StatSpread } from "@/lib/stats";
import type { Team } from "@/lib/teams";

import type { Db } from "./queries";
import {
  ability,
  baseStatOverride,
  frontierSet,
  item,
  move,
  nature,
  pokemon,
  STATS,
  typeChart,
  type Game,
  type Stat,
} from "./schema";

/**
 * The type chart in the game's own order (the importer writes the rows as
 * pret lists them). The order matters: effectiveness is applied row by row,
 * rounding down each time.
 */
export function getTypeChart(db: Db): TypeMatchup[] {
  return db
    .select()
    .from(typeChart)
    .orderBy(sql`rowid`)
    .all();
}

/** A Pokémon ready for the damage calculator, with what a screen shows. */
export type Combatant = {
  name: string;
  battler: Battler;
  moves: (BattleMove & { id: number; name: string })[];
  /** The held item's name, for display. */
  itemName: string | null;
  /** The abilities its species can have (the battler has one of them). */
  abilities: { key: string; name: string }[];
};

type Build = {
  pokemonId: number;
  game: Game;
  level: number;
  ivs: StatSpread;
  evs: StatSpread;
  natureId: number;
  itemId: number | null;
  moveIds: (number | null)[];
  /** Null: the species' first ability. */
  abilityId: number | null;
};

function build(db: Db, b: Build): Combatant | null {
  const species = db
    .select()
    .from(pokemon)
    .where(eq(pokemon.id, b.pokemonId))
    .get();
  if (!species) return null;
  const override = db
    .select()
    .from(baseStatOverride)
    .where(
      and(
        eq(baseStatOverride.pokemonId, b.pokemonId),
        eq(baseStatOverride.game, b.game),
      ),
    )
    .get();
  const source = override ?? species;
  const base = Object.fromEntries(STATS.map((s) => [s, source[s]])) as Record<
    Stat,
    number
  >;

  const abilityIds = [species.ability1Id, species.ability2Id].filter(
    (a): a is number => a !== null,
  );
  const abilityRows = db
    .select({ id: ability.id, key: ability.key, name: ability.name })
    .from(ability)
    .where(inArray(ability.id, abilityIds))
    .all();
  const abilities = abilityIds
    .map((id) => abilityRows.find((a) => a.id === id))
    .filter((a) => a !== undefined);
  const chosen =
    abilities.find((a) => a.id === b.abilityId) ?? abilities[0] ?? null;

  const natureRow = db
    .select()
    .from(nature)
    .where(eq(nature.id, b.natureId))
    .get();
  const held =
    b.itemId === null
      ? undefined
      : db
          .select({
            key: item.key,
            holdEffect: item.holdEffect,
            name: item.name,
          })
          .from(item)
          .where(eq(item.id, b.itemId))
          .get();
  const moveIds = b.moveIds.filter((m): m is number => m !== null);
  const moveRows = moveIds.length
    ? db
        .select({
          id: move.id,
          key: move.key,
          name: move.name,
          type: move.type,
          power: move.power,
          effect: move.effect,
        })
        .from(move)
        .where(inArray(move.id, moveIds))
        .all()
    : [];

  return {
    name: species.name,
    battler: {
      pokemonId: species.id,
      level: b.level,
      type1: species.type1,
      type2: species.type2,
      stats: calculateStats({
        base,
        level: b.level,
        ivs: b.ivs,
        evs: b.evs,
        nature: {
          increasedStat: natureRow?.increasedStat ?? null,
          decreasedStat: natureRow?.decreasedStat ?? null,
        },
      }),
      ivs: b.ivs,
      ability: chosen?.key ?? null,
      item: held ? { key: held.key, holdEffect: held.holdEffect } : null,
      weightHg: species.weightHg,
    },
    // In the order they were chosen.
    moves: moveIds
      .map((id) => moveRows.find((m) => m.id === id))
      .filter((m) => m !== undefined),
    itemName: held?.name ?? null,
    abilities: abilities.map(({ key, name }) => ({ key, name })),
  };
}

/**
 * A Battle Frontier set as it battles: at `level`, with every IV equal to
 * `iv` (the trainer's fixed IV). Frontier Pokémon get either of their
 * species' abilities at random, so the caller picks which to assume.
 */
export function getSetCombatant(
  db: Db,
  setId: number,
  level: number,
  iv: number,
): Combatant | null {
  const set = db
    .select()
    .from(frontierSet)
    .where(eq(frontierSet.id, setId))
    .get();
  if (!set) return null;
  return build(db, {
    pokemonId: set.pokemonId,
    game: "emerald",
    level,
    ivs: uniformSpread(iv),
    evs: {
      hp: set.evHp,
      attack: set.evAttack,
      defense: set.evDefense,
      speed: set.evSpeed,
      spAttack: set.evSpAttack,
      spDefense: set.evSpDefense,
    },
    natureId: set.natureId,
    itemId: set.itemId,
    moveIds: [set.move1Id, set.move2Id, set.move3Id, set.move4Id],
    abilityId: null,
  });
}

/** A saved team's members as combatants (null where a Pokémon is unknown). */
export function getTeamCombatants(
  db: Db,
  team: Pick<Team, "game" | "members">,
): (Combatant | null)[] {
  return team.members.map((m) =>
    build(db, {
      pokemonId: m.pokemonId,
      game: team.game,
      level: m.level,
      ivs: m.ivs,
      evs: m.evs,
      natureId: m.natureId,
      itemId: m.itemId,
      moveIds: m.moveIds,
      abilityId: m.abilityId,
    }),
  );
}
