import { asc } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import * as schema from "./schema";
import { pokemon } from "./schema";

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
