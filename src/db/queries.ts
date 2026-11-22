import { and, asc, eq, inArray, max, min, or, sum } from "drizzle-orm";
import { alias, type BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import {
  comparePlaceNames,
  isUnusedMap,
  placeKind,
  type PlaceKind,
} from "@/lib/places";

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
  return baseStatsFrom(species, override);
}

/** The base stats from a species row and the game's override row, if any. */
export function baseStatsFrom(
  species: typeof pokemon.$inferSelect,
  override: typeof baseStatOverride.$inferSelect | undefined,
) {
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
    .select({ rarity: wildHeldItem.rarity, id: item.id, name: item.name })
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

/** A Pokémon and everything it evolved from, itself first. */
export function withAncestors(db: Db, pokemonId: number): number[] {
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
 * The moves a Pokémon learns in one game, as one section per learn method
 * (in LEARN_METHODS order, empty methods left out). Level-up moves are in the
 * game's order, TMs/HMs by number, tutor and egg moves by name.
 *
 * Egg moves include its earlier stages' (`from` names the stage): the games
 * list them under the first stage only, but the Pokémon keeps them when it
 * evolves, so a Charizard can know Charmander's Dragon Dance.
 */
export function getLearnset(db: Db, id: number, game: Game) {
  const line = withAncestors(db, id);
  const rows = db
    .select({
      pokemonId: learnset.pokemonId,
      species: pokemon.name,
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
    .innerJoin(pokemon, eq(pokemon.id, learnset.pokemonId))
    .leftJoin(
      machine,
      and(eq(learnset.method, "machine"), eq(machine.moveId, learnset.moveId)),
    )
    .where(
      and(
        // Its own moves, and its earlier stages' egg moves.
        or(
          eq(learnset.pokemonId, id),
          and(inArray(learnset.pokemonId, line), eq(learnset.method, "egg")),
        ),
        eq(learnset.game, game),
      ),
    )
    .all()
    // Each egg move once, from the nearest stage (its own first).
    .sort((a, b) => line.indexOf(a.pokemonId) - line.indexOf(b.pokemonId))
    .filter(
      (r, i, all) =>
        r.method !== "egg" ||
        all.findIndex((o) => o.method === "egg" && o.moveId === r.moveId) === i,
    )
    .map(({ pokemonId, species, ...r }) => ({
      ...r,
      /** For an earlier stage's egg move: that stage's name. */
      from: pokemonId === id ? null : species,
    }));

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
      key: location.key,
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
  for (const {
    locationId,
    key,
    name,
    method,
    minLevel,
    maxLevel,
    rate,
  } of rows) {
    if (isUnusedMap(key)) continue;
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

/**
 * Every place with wild Pokémon or a one-time encounter in a game, sorted
 * by kind (routes, towns, the rest) and then naturally by name, with the
 * species found there (by National Dex number). Maps the game never uses
 * are left out.
 */
export function listPlaces(db: Db, game: Game) {
  const wild = db
    .select({
      id: location.id,
      key: location.key,
      name: location.name,
      mapSection: location.mapSection,
      pokemonId: encounter.pokemonId,
      method: encounter.method,
      rate: sum(encounter.rate).mapWith(Number),
    })
    .from(encounter)
    .innerJoin(location, eq(location.id, encounter.locationId))
    .where(eq(encounter.game, game))
    .groupBy(location.id, encounter.method, encounter.pokemonId)
    .all();
  const oneTime = db
    .selectDistinct({
      id: location.id,
      key: location.key,
      name: location.name,
      mapSection: location.mapSection,
      pokemonId: staticEncounter.pokemonId,
    })
    .from(staticEncounter)
    .innerJoin(location, eq(location.id, staticEncounter.locationId))
    .where(eq(staticEncounter.game, game))
    .all();
  // How prominent a Pokémon is at a place, smaller first: one-time
  // encounters, then by encounter method (grass before surfing before
  // fishing), then the commoner.
  const rank = (r: (typeof wild)[number] | (typeof oneTime)[number]) =>
    "method" in r
      ? (ENCOUNTER_METHODS.indexOf(r.method) + 1) * 1000 - r.rate
      : 0;
  const places = new Map<
    number,
    {
      id: number;
      name: string;
      kind: PlaceKind;
      /** Its Town Map area (pret MAPSEC_…). */
      mapSection: string;
      ranks: Map<number, number>;
    }
  >();
  for (const row of [...oneTime, ...wild]) {
    if (isUnusedMap(row.key)) continue;
    const place = places.get(row.id) ?? {
      id: row.id,
      name: row.name,
      kind: placeKind(row.key, row.name),
      mapSection: row.mapSection,
      ranks: new Map(),
    };
    const r = rank(row);
    place.ranks.set(
      row.pokemonId,
      Math.min(r, place.ranks.get(row.pokemonId) ?? Infinity),
    );
    places.set(row.id, place);
  }
  const KIND_ORDER: PlaceKind[] = ["route", "town", "other"];
  return [...places.values()]
    .map(({ ranks, ...p }) => ({
      ...p,
      /** Most prominent first (see `rank`). */
      pokemonIds: [...ranks]
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .map(([id]) => id),
    }))
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        comparePlaceNames(a.name, b.name),
    );
}

export type PlaceListItem = ReturnType<typeof listPlaces>[number];

/**
 * One place in one game: its wild Pokémon per encounter method (a species'
 * slots added up, with its level range), most common first, and its
 * one-time encounters. Null if there's no such place.
 */
export function getPlace(db: Db, id: number, game: Game) {
  const place = db.select().from(location).where(eq(location.id, id)).get();
  if (!place) return null;
  const rows = db
    .select({
      method: encounter.method,
      pokemonId: pokemon.id,
      name: pokemon.name,
      type1: pokemon.type1,
      type2: pokemon.type2,
      minLevel: min(encounter.minLevel),
      maxLevel: max(encounter.maxLevel),
      rate: sum(encounter.rate).mapWith(Number),
    })
    .from(encounter)
    .innerJoin(pokemon, eq(pokemon.id, encounter.pokemonId))
    .where(and(eq(encounter.locationId, id), eq(encounter.game, game)))
    .groupBy(encounter.method, pokemon.id)
    .all();
  const methods = ENCOUNTER_METHODS.map((method) => ({
    method,
    mons: rows
      .filter((r) => r.method === method)
      .map(({ method: _, minLevel, maxLevel, ...r }) => ({
        ...r,
        minLevel: minLevel ?? 0,
        maxLevel: maxLevel ?? 0,
      }))
      .sort((a, b) => b.rate - a.rate || a.pokemonId - b.pokemonId),
  })).filter((m) => m.mons.length > 0);

  const tradeFor = alias(pokemon, "trade_for");
  const oneTime = db
    .select({
      id: staticEncounter.id,
      kind: staticEncounter.kind,
      pokemonId: pokemon.id,
      name: pokemon.name,
      type1: pokemon.type1,
      type2: pokemon.type2,
      level: staticEncounter.level,
      count: staticEncounter.count,
      heldItem: item.name,
      tradeFor: tradeFor.name,
      nickname: staticEncounter.nickname,
      note: staticEncounter.note,
    })
    .from(staticEncounter)
    .innerJoin(pokemon, eq(pokemon.id, staticEncounter.pokemonId))
    .leftJoin(item, eq(item.id, staticEncounter.heldItemId))
    .leftJoin(tradeFor, eq(tradeFor.id, staticEncounter.tradeForId))
    .where(
      and(eq(staticEncounter.locationId, id), eq(staticEncounter.game, game)),
    )
    .orderBy(asc(staticEncounter.id))
    .all();
  return {
    id: place.id,
    name: place.name,
    region: place.region,
    methods,
    oneTime,
  };
}

export type PlaceDetail = NonNullable<ReturnType<typeof getPlace>>;
