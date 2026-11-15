import { and, asc, eq, inArray, max, min, sum } from "drizzle-orm";
import { alias, type BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import * as schema from "./schema";
import {
  ability,
  baseStatOverride,
  encounter,
  ENCOUNTER_METHODS,
  evolution,
  GAMES,
  game as gameTable,
  item,
  learnset,
  LEARN_METHODS,
  location,
  machine,
  move,
  pokedexText,
  pokemon,
  STATIC_ENCOUNTER_KINDS,
  staticEncounter,
  STATS,
  wildHeldItem,
  type EncounterMethod,
  type EvolutionMethod,
  type Game,
  type LearnMethod,
  type PokemonType,
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
 * A species' base stats in one game: its own, or those of the form the game
 * uses (Deoxys is a different form in each game), with the form's name.
 */
export function baseStatsIn(
  db: Db,
  species: typeof pokemon.$inferSelect,
  game: Game,
) {
  const override = db
    .select()
    .from(baseStatOverride)
    .where(
      and(
        eq(baseStatOverride.pokemonId, species.id),
        eq(baseStatOverride.game, game),
      ),
    )
    .get();
  const source = override ?? species;
  return {
    baseStats: Object.fromEntries(STATS.map((s) => [s, source[s]])) as Record<
      Stat,
      number
    >,
    formName: override?.formName ?? null,
  };
}

/**
 * Everything the overview page shows for one Pokémon in one game, or null if
 * there is no such Pokémon. Base stats include the game's form override
 * (Deoxys); held items are those of the game's version group.
 */
export function getPokemonDetail(db: Db, id: number, game: Game) {
  const row = db.select().from(pokemon).where(eq(pokemon.id, id)).get();
  if (!row) return null;

  const { baseStats, formName } = baseStatsIn(db, row, game);

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
    formName,
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
      makesContact: move.makesContact,
      description: move.description,
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

export type EvolutionNode = {
  id: number;
  name: string;
  type1: PokemonType;
  type2: PokemonType | null;
  /** How this stage evolves, one entry per branch (Eevee has five). */
  evolutions: {
    method: EvolutionMethod;
    level: number | null;
    item: string | null;
    into: EvolutionNode;
  }[];
};

/**
 * The whole evolution family of a Pokémon as a tree, starting from its first
 * stage (so Raichu gives Pichu → Pikachu → Raichu). Evolutions are the same
 * in every Gen 3 game. A Pokémon that doesn't evolve is a single node.
 */
export function getEvolutionChain(db: Db, id: number): EvolutionNode {
  // The table is small (under 200 rows), so read it whole.
  const steps = db
    .select({
      from: evolution.fromPokemonId,
      to: evolution.toPokemonId,
      method: evolution.method,
      level: evolution.level,
      item: item.name,
    })
    .from(evolution)
    .leftJoin(item, eq(item.id, evolution.itemId))
    .all();

  let root = id;
  for (let prev; (prev = steps.find((s) => s.to === root));) root = prev.from;

  const familyIds = new Set([root]);
  for (let added = true; added;) {
    added = false;
    for (const s of steps) {
      if (familyIds.has(s.from) && !familyIds.has(s.to)) {
        familyIds.add(s.to);
        added = true;
      }
    }
  }
  const members = db
    .select({
      id: pokemon.id,
      name: pokemon.name,
      type1: pokemon.type1,
      type2: pokemon.type2,
    })
    .from(pokemon)
    .where(inArray(pokemon.id, [...familyIds]))
    .all();

  const build = (nodeId: number): EvolutionNode => ({
    ...members.find((m) => m.id === nodeId)!,
    evolutions: steps
      .filter((s) => s.from === nodeId)
      .sort((a, b) => a.to - b.to)
      .map((s) => ({
        method: s.method,
        level: s.level,
        item: s.item,
        into: build(s.to),
      })),
  });
  return build(root);
}

/**
 * Where a Pokémon can be found in the wild in one game: one entry per place,
 * each with its encounter methods. `rate` adds up the encounter slots it
 * occupies: the chance (%) that an encounter with that method is this Pokémon.
 * Gifts and one-off encounters (legendaries, starters) aren't wild data.
 */
export function getLocations(db: Db, id: number, game: Game) {
  const rows = db
    .select({
      locationId: location.id,
      name: location.name,
      method: encounter.method,
      minLevel: min(encounter.minLevel),
      maxLevel: max(encounter.maxLevel),
      rate: sum(encounter.rate).mapWith(Number),
    })
    .from(encounter)
    .innerJoin(location, eq(location.id, encounter.locationId))
    .where(and(eq(encounter.pokemonId, id), eq(encounter.game, game)))
    .groupBy(location.id, encounter.method)
    .orderBy(asc(location.id))
    .all();

  const places: {
    locationId: number;
    name: string;
    encounters: {
      method: EncounterMethod;
      minLevel: number;
      maxLevel: number;
      rate: number;
    }[];
  }[] = [];
  for (const { locationId, name, method, minLevel, maxLevel, rate } of rows) {
    let place = places.find((p) => p.locationId === locationId);
    if (!place) {
      place = { locationId, name, encounters: [] };
      places.push(place);
    }
    place.encounters.push({
      method,
      minLevel: minLevel ?? 0,
      maxLevel: maxLevel ?? 0,
      rate,
    });
  }
  for (const place of places) {
    place.encounters.sort(
      (a, b) =>
        ENCOUNTER_METHODS.indexOf(a.method) -
        ENCOUNTER_METHODS.indexOf(b.method),
    );
  }
  return places;
}

export type LocationEntry = ReturnType<typeof getLocations>[number];

/** The games (in game order) where a Pokémon can be found in the wild. */
export function getWildGames(db: Db, id: number): Game[] {
  return db
    .selectDistinct({ game: encounter.game, order: gameTable.sortOrder })
    .from(encounter)
    .innerJoin(gameTable, eq(gameTable.id, encounter.game))
    .where(eq(encounter.pokemonId, id))
    .orderBy(asc(gameTable.sortOrder))
    .all()
    .map((r) => r.game);
}

/** Gifts, starters, one-time encounters, roamers, trades and prizes in a game. */
export function getStaticEncounters(db: Db, id: number, game: Game) {
  const tradeFor = alias(pokemon, "trade_for");
  return db
    .select({
      id: staticEncounter.id,
      kind: staticEncounter.kind,
      /** Null for roamers. */
      place: location.name,
      level: staticEncounter.level,
      count: staticEncounter.count,
      heldItem: item.name,
      tradeFor: tradeFor.name,
      nickname: staticEncounter.nickname,
      note: staticEncounter.note,
    })
    .from(staticEncounter)
    .leftJoin(location, eq(location.id, staticEncounter.locationId))
    .leftJoin(item, eq(item.id, staticEncounter.heldItemId))
    .leftJoin(tradeFor, eq(tradeFor.id, staticEncounter.tradeForId))
    .where(
      and(eq(staticEncounter.pokemonId, id), eq(staticEncounter.game, game)),
    )
    .orderBy(asc(staticEncounter.id))
    .all()
    .sort(
      (a, b) =>
        STATIC_ENCOUNTER_KINDS.indexOf(a.kind) -
        STATIC_ENCOUNTER_KINDS.indexOf(b.kind),
    );
}

export type StaticEncounterEntry = ReturnType<
  typeof getStaticEncounters
>[number];

/** The games (in game order) where a Pokémon can be caught or received, not counting evolution or breeding. */
export function getFoundGames(db: Db, id: number): Game[] {
  const games = new Set<Game>([
    ...getWildGames(db, id),
    ...db
      .selectDistinct({ game: staticEncounter.game })
      .from(staticEncounter)
      .where(eq(staticEncounter.pokemonId, id))
      .all()
      .map((r) => r.game),
  ]);
  return GAMES.filter((g) => games.has(g));
}
