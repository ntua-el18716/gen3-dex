import { and, asc, eq, inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import * as schema from "./schema";
import {
  ability,
  baseStatOverride,
  game as gameTable,
  item,
  learnset,
  LEARN_METHODS,
  machine,
  move,
  pokedexText,
  pokemon,
  STATS,
  wildHeldItem,
  type Game,
  type LearnMethod,
  type Stat,
} from "./schema";

/**
 * Any synchronous Drizzle database over the shared schema: expo-sqlite in the
 * app, better-sqlite3 in tests. Queries take this, so they never import
 * React Native and can be tested against the real gen3.db. (The run-result
 * type differs per driver, hence `any`.)
 */
export type Db = BaseSQLiteDatabase<"sync", any, typeof schema>;

/** Every Pokémon in National Dex order, with what the list screen shows. */
export function listPokemon(db: Db) {
  return db
    .select({
      id: pokemon.id,
      name: pokemon.name,
      type1: pokemon.type1,
      type2: pokemon.type2,
    })
    .from(pokemon)
    .orderBy(asc(pokemon.id))
    .all();
}

export type PokemonListItem = ReturnType<typeof listPokemon>[number];

/**
 * Everything the overview page shows for one Pokémon in one game, or null if
 * there is no such Pokémon. Base stats include the game's form override
 * (Deoxys); held items are those of the game's version group.
 */
export function getPokemonDetail(db: Db, id: number, game: Game) {
  const row = db.select().from(pokemon).where(eq(pokemon.id, id)).get();
  if (!row) return null;

  const override = db
    .select()
    .from(baseStatOverride)
    .where(
      and(eq(baseStatOverride.pokemonId, id), eq(baseStatOverride.game, game)),
    )
    .get();
  const statSource = override ?? row;
  const baseStats = Object.fromEntries(
    STATS.map((s) => [s, statSource[s]]),
  ) as Record<Stat, number>;

  const abilityIds = [row.ability1Id, row.ability2Id].filter(
    (a): a is number => a !== null,
  );
  const abilityRows = db
    .select({
      id: ability.id,
      name: ability.name,
      description: ability.description,
    })
    .from(ability)
    .where(inArray(ability.id, abilityIds))
    .all();
  const abilities = abilityIds.map((a) => abilityRows.find((r) => r.id === a)!);

  const heldItems = db
    .select({ rarity: wildHeldItem.rarity, name: item.name })
    .from(wildHeldItem)
    .innerJoin(item, eq(item.id, wildHeldItem.itemId))
    .innerJoin(gameTable, eq(gameTable.versionGroup, wildHeldItem.versionGroup))
    .where(and(eq(wildHeldItem.pokemonId, id), eq(gameTable.id, game)))
    .orderBy(asc(wildHeldItem.rarity))
    .all();

  return {
    ...row,
    formName: override?.formName ?? null,
    baseStats,
    abilities,
    heldItems,
  };
}

export type PokemonDetail = NonNullable<ReturnType<typeof getPokemonDetail>>;

/**
 * The Pokédex entries of a Pokémon in every game, merged where games share
 * the same text (e.g. one entry for R/S/E), in game order.
 */
export function getPokedexEntries(db: Db, id: number) {
  const rows = db
    .select({ game: pokedexText.game, text: pokedexText.text })
    .from(pokedexText)
    .innerJoin(gameTable, eq(gameTable.id, pokedexText.game))
    .where(eq(pokedexText.pokemonId, id))
    .orderBy(asc(gameTable.sortOrder))
    .all();

  const entries: { games: Game[]; text: string }[] = [];
  for (const { game, text } of rows) {
    const same = entries.find((e) => e.text === text);
    if (same) same.games.push(game);
    else entries.push({ games: [game], text });
  }
  return entries;
}

export type PokedexEntry = ReturnType<typeof getPokedexEntries>[number];

/**
 * The moves a Pokémon learns in one game, as one section per learn method
 * (in LEARN_METHODS order, empty methods left out). Level-up moves are in the
 * game's order, TMs/HMs by number, tutor and egg moves by name.
 */
export function getLearnset(db: Db, id: number, game: Game) {
  const rows = db
    .select({
      method: learnset.method,
      level: learnset.level,
      sortOrder: learnset.sortOrder,
      machine: machine.label,
      machineNumber: machine.number,
      moveId: move.id,
      name: move.name,
      type: move.type,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
    })
    .from(learnset)
    .innerJoin(move, eq(move.id, learnset.moveId))
    .leftJoin(
      machine,
      and(eq(learnset.method, "machine"), eq(machine.moveId, learnset.moveId)),
    )
    .where(and(eq(learnset.pokemonId, id), eq(learnset.game, game)))
    .all();

  type Row = (typeof rows)[number];
  const order: Record<LearnMethod, (a: Row, b: Row) => number> = {
    level: (a, b) => a.level - b.level || a.sortOrder - b.sortOrder,
    machine: (a, b) => (a.machineNumber ?? 0) - (b.machineNumber ?? 0),
    tutor: (a, b) => a.name.localeCompare(b.name),
    egg: (a, b) => a.name.localeCompare(b.name),
  };

  return LEARN_METHODS.map((method) => ({
    method,
    data: rows.filter((r) => r.method === method).sort(order[method]),
  })).filter((section) => section.data.length > 0);
}

export type LearnsetSection = ReturnType<typeof getLearnset>[number];
export type LearnsetMove = LearnsetSection["data"][number];
