import { and, asc, eq, inArray } from "drizzle-orm";

import { calculateStats } from "@/lib/stats";
import type { Team } from "@/lib/teams";

import type { Db } from "./queries";
import {
  ability,
  baseStatOverride,
  evolution,
  item,
  learnset,
  machine,
  move,
  nature,
  pokemon,
  STATS,
  type Game,
  type Stat,
} from "./schema";

/** A Pokémon and everything it evolved from, itself first. */
function withAncestors(db: Db, pokemonId: number): number[] {
  const line = [pokemonId];
  for (let i = 0; i < line.length; i++) {
    const parents = db
      .select({ id: evolution.fromPokemonId })
      .from(evolution)
      .where(eq(evolution.toPokemonId, line[i]!))
      .all();
    for (const p of parents) if (!line.includes(p.id)) line.push(p.id);
  }
  return line;
}

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

export type NatureOption = ReturnType<typeof listNatures>[number];

/**
 * A team's members with everything the screens show: names, types, the
 * species' abilities, item, nature, moves, and the real stats for the
 * member's level, nature, IVs and EVs. Base stats are the team's game's
 * (Deoxys differs per game). Members whose Pokémon isn't in the database
 * come back as null, so slots keep their positions.
 */
export function getTeamDetails(db: Db, team: Pick<Team, "game" | "members">) {
  const ids = <T>(values: (T | null)[]) => [
    ...new Set(values.filter((v): v is T => v !== null)),
  ];
  const speciesIds = ids(team.members.map((m) => m.pokemonId));
  if (speciesIds.length === 0) return [];

  const species = db
    .select()
    .from(pokemon)
    .where(inArray(pokemon.id, speciesIds))
    .all();
  const overrides = db
    .select()
    .from(baseStatOverride)
    .where(
      and(
        inArray(baseStatOverride.pokemonId, speciesIds),
        eq(baseStatOverride.game, team.game),
      ),
    )
    .all();
  const abilities = db
    .select({ id: ability.id, name: ability.name })
    .from(ability)
    .where(
      inArray(
        ability.id,
        ids(species.flatMap((s) => [s.ability1Id, s.ability2Id])),
      ),
    )
    .all();
  const itemIds = ids(team.members.map((m) => m.itemId));
  const items = itemIds.length
    ? db
        .select({ id: item.id, name: item.name })
        .from(item)
        .where(inArray(item.id, itemIds))
        .all()
    : [];
  const moveIds = ids(team.members.flatMap((m) => m.moveIds));
  const moves = moveIds.length
    ? db
        .select({ id: move.id, name: move.name, type: move.type })
        .from(move)
        .where(inArray(move.id, moveIds))
        .all()
    : [];
  const natures = db.select().from(nature).all();

  return team.members.map((m) => {
    const s = species.find((row) => row.id === m.pokemonId);
    if (!s) return null;
    const statSource = overrides.find((o) => o.pokemonId === s.id) ?? s;
    const baseStats = Object.fromEntries(
      STATS.map((stat) => [stat, statSource[stat]]),
    ) as Record<Stat, number>;
    const memberNature = natures.find((n) => n.id === m.natureId) ?? {
      id: m.natureId,
      name: "Hardy",
      increasedStat: null,
      decreasedStat: null,
    };
    return {
      pokemonId: s.id,
      name: s.name,
      type1: s.type1,
      type2: s.type2,
      /** The abilities this species can have. */
      abilities: [s.ability1Id, s.ability2Id]
        .map((id) => abilities.find((a) => a.id === id))
        .filter((a) => a !== undefined),
      abilityName: abilities.find((a) => a.id === m.abilityId)?.name ?? null,
      itemName: items.find((i) => i.id === m.itemId)?.name ?? null,
      nature: memberNature,
      moves: m.moveIds
        .map((id) => moves.find((mv) => mv.id === id))
        .filter((mv) => mv !== undefined),
      baseStats,
      stats: calculateStats({
        base: baseStats,
        level: m.level,
        ivs: m.ivs,
        evs: m.evs,
        nature: memberNature,
      }),
    };
  });
}

export type TeamMemberDetail = NonNullable<
  ReturnType<typeof getTeamDetails>[number]
>;
