/**
 * Builds assets/db/gen3.db from the pret decompilations.
 *
 *   npm run import
 *
 * 1. Checks out the pinned pret commits (data-src/, gitignored).
 * 2. Parses each kind of data (stages/*), cross-checking the games against
 *    each other where they should agree.
 * 3. Creates a fresh database from the Drizzle migrations and inserts
 *    everything with foreign keys enforced.
 * 4. Runs validation queries against facts we know from the games.
 *
 * The output is deterministic: the same pret commits give the same file.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import * as schema from "../../src/db/schema";
import { Lookups, notes } from "./context";
import { fetchSources } from "./fetch-sources";
import { SOURCES } from "./sources";
import * as core from "./stages/core";
import { importEncounters } from "./stages/encounters";
import { importFrontier } from "./stages/frontier";
import { importLearnsets } from "./stages/learnsets";
import * as pokemon from "./stages/pokemon";
import { importTrainers } from "./stages/trainers";
import { validate } from "./validate";

export const DB_PATH = path.resolve("assets/db/gen3.db");

function time<T>(label: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  console.log(
    `  ${label.padEnd(28)} ${Math.round(performance.now() - start)} ms`,
  );
  return result;
}

function main() {
  console.log("Fetching sources…");
  fetchSources();

  console.log("Parsing…");
  const lookups = new Lookups();
  const games = core.importGames();
  const abilities = time("abilities", () => core.importAbilities(lookups));
  const moves = time("moves", () => core.importMoves(lookups));
  const items = time("items", () => core.importItems(lookups));
  const natures = time("natures", () => core.importNatures(lookups));
  const typeChart = time("type chart", () => core.importTypeChart());
  const machines = time("TMs/HMs", () => core.importMachines(lookups));
  const pokemonRows = time("Pokémon", () => pokemon.importPokemon(lookups));
  const overrides = time("Deoxys forms", () =>
    pokemon.importBaseStatOverrides(lookups),
  );
  const heldItems = time("wild held items", () =>
    pokemon.importWildHeldItems(lookups),
  );
  const dexText = time("Pokédex text", () =>
    pokemon.importPokedexText(lookups),
  );
  const evolutions = time("evolutions", () =>
    pokemon.importEvolutions(lookups),
  );
  const learnsets = time("learnsets", () => importLearnsets(lookups));
  const { locations, encounters } = time("encounters", () =>
    importEncounters(lookups),
  );
  const { trainers, mons } = time("trainers", () => importTrainers(lookups));
  const frontier = time("Battle Frontier", () => importFrontier(lookups));

  console.log("Writing database…");
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  rmSync(DB_PATH, { force: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = DELETE");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const insert = (table: SQLiteTable, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 400) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.insert(table)
        .values(rows.slice(i, i + 400) as any)
        .run();
    }
  };

  db.transaction(() => {
    insert(schema.game, games);
    insert(schema.ability, abilities);
    insert(schema.move, moves);
    insert(schema.item, items);
    insert(schema.nature, natures);
    insert(schema.typeChart, typeChart);
    insert(schema.machine, machines);
    insert(schema.pokemon, pokemonRows);
    insert(schema.baseStatOverride, overrides);
    insert(schema.wildHeldItem, heldItems);
    insert(schema.pokedexText, dexText);
    insert(schema.evolution, evolutions);
    insert(schema.learnset, learnsets);
    insert(schema.location, locations);
    insert(schema.encounter, encounters);
    insert(schema.trainer, trainers);
    insert(schema.trainerMon, mons);
    insert(schema.frontierSet, frontier.sets);
    insert(schema.frontierTrainer, frontier.trainers);
    insert(schema.frontierTrainerSet, frontier.trainerSets);
    insert(schema.meta, [
      ...SOURCES.map((s) => ({ key: `source.${s.name}`, value: s.commit })),
      { key: "schema", value: "gen3-companion/1" },
    ]);
  });

  const fkProblems = sqlite.pragma("foreign_key_check") as unknown[];
  if (fkProblems.length > 0)
    throw new Error(
      `Foreign key violations: ${JSON.stringify(fkProblems.slice(0, 5))}`,
    );
  sqlite.exec("VACUUM");

  console.log("Validating…");
  const failures = validate(sqlite);
  sqlite.close();

  if (notes.length > 0) {
    console.log("\nNotes:");
    for (const n of summariseNotes(notes)) console.log(`  · ${n}`);
  }
  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} validation check(s) failed:`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`\n✓ Wrote ${path.relative(process.cwd(), DB_PATH)}`);
}

/** Collapses repetitive notes ("Duplicate … table for MAP_ALTERING_CAVE …") into counts. */
function summariseNotes(all: string[]): string[] {
  const groups = new Map<string, number>();
  for (const n of all) {
    const key = n.replace(/\([^)]*\)/g, "(…)");
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups].map(([n, count]) => (count > 1 ? `${n} ×${count}` : n));
}

main();
