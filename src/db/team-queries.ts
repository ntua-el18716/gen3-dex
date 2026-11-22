import { and, asc, eq, inArray } from "drizzle-orm";

import type { NameIndex } from "@/lib/showdown";
import type { Team } from "@/lib/teams";

import { getTeamCombatants } from "./damage-queries";
import { withAncestors, type Db } from "./queries";
import {
  ability,
  item,
  learnset,
  machine,
  move,
  nature,
  pokemon,
  type Game,
} from "./schema";

/**
 * Every move a Pokémon can know in one game, by name, each with how it gets
 * it ("Lv 36", "TM35", "Tutor", "Egg"). Moves only an earlier stage learns
 * count too ("As Charmander"): the Pokémon keeps them when it evolves, and
 * the games list egg moves under the first stage only.
 */
export function getTeachableMoves(db: Db, pokemonId: number, game: Game) {
  const line = withAncestors(db, pokemonId);
  const rows = db
    .select({
      pokemonId: learnset.pokemonId,
      species: pokemon.name,
      method: learnset.method,
      level: learnset.level,
      machine: machine.label,
      id: move.id,
      name: move.name,
      type: move.type,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
    })
    .from(learnset)
    .innerJoin(move, eq(move.id, learnset.moveId))
    .innerJoin(pokemon, eq(pokemon.id, learnset.pokemonId))
    .leftJoin(
      machine,
      and(eq(learnset.method, "machine"), eq(machine.moveId, learnset.moveId)),
    )
    .where(and(inArray(learnset.pokemonId, line), eq(learnset.game, game)))
    .all();

  type Row = (typeof rows)[number];
  const how = (r: Row) =>
    r.pokemonId !== pokemonId
      ? `As ${r.species}`
      : r.method === "level"
        ? `Lv ${r.level}`
        : r.method === "machine"
          ? (r.machine ?? "TM")
          : r.method === "tutor"
            ? "Tutor"
            : "Egg";
  // The Pokémon's own ways first, then the nearest earlier stage's; within
  // a stage, the lowest level.
  const rank = (r: Row) => line.indexOf(r.pokemonId) * 1000 + r.level;
  const best = new Map<number, Row>();
  for (const r of rows) {
    const current = best.get(r.id);
    if (!current || rank(r) < rank(current)) best.set(r.id, r);
  }
  return [...best.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      power: r.power,
      accuracy: r.accuracy,
      pp: r.pp,
      how: how(r),
    }));
}

export type MoveOption = ReturnType<typeof getTeachableMoves>[number];

/** Every move in the games, for Pokémon traded in with moves from elsewhere. */
export function listMoves(db: Db): MoveOption[] {
  return db
    .select({
      id: move.id,
      name: move.name,
      type: move.type,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
    })
    .from(move)
    .orderBy(asc(move.name))
    .all()
    .map((m) => ({ ...m, how: "" }));
}

/** Every Pokémon, for choosing a team member (with its first ability, which a new member starts with). */
export function listSpecies(db: Db) {
  return db
    .select({
      id: pokemon.id,
      name: pokemon.name,
      type1: pokemon.type1,
      type2: pokemon.type2,
      ability1Id: pokemon.ability1Id,
    })
    .from(pokemon)
    .orderBy(asc(pokemon.id))
    .all();
}

/** Items worth holding: the Items and Berries pockets, by name. */
export function listHoldItems(db: Db) {
  return db
    .select({ id: item.id, name: item.name, description: item.description })
    .from(item)
    .where(inArray(item.pocket, ["items", "berries"]))
    .orderBy(asc(item.name))
    .all();
}

export function listNatures(db: Db) {
  return db.select().from(nature).orderBy(asc(nature.name)).all();
}

/**
 * A team's members with everything the team screens show: names, types, the
 * species' abilities, item, nature, moves, and the real stats for the
 * member's level, nature, IVs and EVs (the same Pokémon the damage
 * calculator uses, see getTeamCombatants). Members whose Pokémon isn't in
 * the database come back as null, so slots keep their positions.
 */
export function getTeamDetails(db: Db, team: Pick<Team, "game" | "members">) {
  return getTeamCombatants(db, team).map((c, slot) => {
    if (!c) return null;
    const member = team.members[slot]!;
    return {
      pokemonId: c.battler.pokemonId,
      name: c.name,
      type1: c.battler.type1,
      type2: c.battler.type2,
      /** The abilities this species can have. */
      abilities: c.abilities.map(({ id, name }) => ({ id, name })),
      abilityName:
        c.abilities.find((a) => a.id === member.abilityId)?.name ?? null,
      itemName: c.itemName,
      // An unknown nature id behaves like a neutral nature.
      nature: c.nature ?? {
        id: member.natureId,
        name: "Hardy",
        increasedStat: null,
        decreasedStat: null,
      },
      moves: c.moves.map(({ id, name, type }) => ({ id, name, type })),
      baseStats: c.baseStats,
      stats: c.battler.stats,
    };
  });
}

export type TeamMemberDetail = NonNullable<
  ReturnType<typeof getTeamDetails>[number]
>;

/** Every name a Showdown set can mention, for reading and writing them. */
export function getNameIndex(db: Db): NameIndex {
  return {
    species: db
      .select({
        id: pokemon.id,
        name: pokemon.name,
        ability1Id: pokemon.ability1Id,
        ability2Id: pokemon.ability2Id,
      })
      .from(pokemon)
      .all()
      .map(({ id, name, ability1Id, ability2Id }) => ({
        id,
        name,
        abilityIds: [ability1Id, ability2Id].filter((a) => a !== null),
      })),
    moves: db.select({ id: move.id, name: move.name }).from(move).all(),
    items: db.select({ id: item.id, name: item.name }).from(item).all(),
    abilities: db
      .select({ id: ability.id, name: ability.name })
      .from(ability)
      .all(),
    natures: db.select({ id: nature.id, name: nature.name }).from(nature).all(),
  };
}
