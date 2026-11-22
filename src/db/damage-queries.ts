import { and, eq, inArray, sql } from "drizzle-orm";

import type { BattleMove, Battler, TypeMatchup } from "@/lib/damage";
import { calculateStats, uniformSpread, type StatSpread } from "@/lib/stats";
import type { Team } from "@/lib/teams";

import { baseStatsIn, type Db } from "./queries";
import {
  ability,
  frontierBrainMon,
  frontierSet,
  item,
  move,
  nature,
  pokemon,
  typeChart,
  type FrontierFacility,
  type FrontierSymbol,
  type Game,
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
  abilities: { id: number; key: string; name: string }[];
  /** Its nature, if the id is a real one. */
  nature: typeof nature.$inferSelect | null;
  baseStats: StatSpread;
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
  const { baseStats: base } = baseStatsIn(db, species, b.game);

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
    abilities,
    nature: natureRow ?? null,
    baseStats: base,
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

/**
 * One of a Frontier Brain's fixed Pokémon (Silver or Gold team, by slot)
 * at `level`, with its own fixed IVs.
 */
export function getBrainCombatant(
  db: Db,
  facility: FrontierFacility,
  symbol: FrontierSymbol,
  slot: number,
  level: number,
): (Combatant & { iv: number }) | null {
  const mon = db
    .select()
    .from(frontierBrainMon)
    .where(
      and(
        eq(frontierBrainMon.facility, facility),
        eq(frontierBrainMon.symbol, symbol),
        eq(frontierBrainMon.slot, slot),
      ),
    )
    .get();
  if (!mon) return null;
  const combatant = build(db, {
    pokemonId: mon.pokemonId,
    game: "emerald",
    level,
    ivs: uniformSpread(mon.fixedIv),
    evs: {
      hp: mon.evHp,
      attack: mon.evAttack,
      defense: mon.evDefense,
      speed: mon.evSpeed,
      spAttack: mon.evSpAttack,
      spDefense: mon.evSpDefense,
    },
    natureId: mon.natureId,
    itemId: mon.itemId,
    moveIds: [mon.move1Id, mon.move2Id, mon.move3Id, mon.move4Id],
    abilityId: null,
  });
  return combatant && { ...combatant, iv: mon.fixedIv };
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
