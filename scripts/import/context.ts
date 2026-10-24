/**
 * Shared state for the import stages: which repo and preprocessor defines
 * each game uses, and lookups from pret constants (SPECIES_GENGAR,
 * MOVE_THUNDERBOLT…) to database ids.
 */
import type { Game, VersionGroup } from "../../src/db/schema";
import {
  constant,
  evalExpression,
  preprocess,
  type Constants,
} from "./lib/c-parse";
import { readSource, repoConstants, type RepoName } from "./lib/source";

export type GameSource = {
  game: Game;
  name: string;
  repo: RepoName;
  /** Names defined when building this game, for #ifdef handling. */
  defines: ReadonlySet<string>;
  versionGroup: VersionGroup;
  region: "hoenn" | "kanto";
};

export const GAME_SOURCES: GameSource[] = [
  {
    game: "ruby",
    name: "Ruby",
    repo: "pokeruby",
    defines: new Set(["RUBY", "ENGLISH"]),
    versionGroup: "rs",
    region: "hoenn",
  },
  {
    game: "sapphire",
    name: "Sapphire",
    repo: "pokeruby",
    defines: new Set(["SAPPHIRE", "ENGLISH"]),
    versionGroup: "rs",
    region: "hoenn",
  },
  {
    game: "emerald",
    name: "Emerald",
    repo: "pokeemerald",
    defines: new Set(),
    versionGroup: "e",
    region: "hoenn",
  },
  {
    game: "firered",
    name: "FireRed",
    repo: "pokefirered",
    defines: new Set(["FIRERED"]),
    versionGroup: "frlg",
    region: "kanto",
  },
  {
    game: "leafgreen",
    name: "LeafGreen",
    repo: "pokefirered",
    defines: new Set(["LEAFGREEN"]),
    versionGroup: "frlg",
    region: "kanto",
  },
];

export function gameSource(game: Game): GameSource {
  const source = GAME_SOURCES.find((g) => g.game === game);
  if (!source) throw new Error(`Unknown game ${game}`);
  return source;
}

/** The game whose files represent a version group (the other game must agree; validated). */
export const VERSION_GROUP_GAME: Record<VersionGroup, Game> = {
  rs: "ruby",
  e: "emerald",
  frlg: "firered",
};

/** Reads a file as compiled for `game` (inactive #ifdef branches removed). */
export function readForGame(game: Game, relPath: string): string {
  const source = gameSource(game);
  return preprocess(readSource(source.repo, relPath), source.defines);
}

export function constantsFor(game: Game): Constants {
  return repoConstants(gameSource(game).repo);
}

/**
 * Lookups filled in by the core stages and used by the later ones.
 *
 * Ids (species, moves, items, abilities) are identical in every Gen 3 game,
 * but the repos sometimes name the constants differently (Emerald's
 * MOVE_SOLAR_BEAM is Ruby's MOVE_SOLARBEAM; Emerald's ITEM_TM01 is FireRed's
 * ITEM_TM01_FOCUS_PUNCH). So every lookup resolves the name with the
 * constants of the game the data came from, then checks the numeric id.
 */
export class Lookups {
  /** Internal species number → National Dex number (e.g. SPECIES_TREECKO 277 → 252). */
  readonly pokemonBySpeciesValue = new Map<number, number>();
  readonly moveIds = new Set<number>();
  readonly itemIds = new Set<number>();
  readonly abilityIds = new Set<number>();
  /** NATURE_ADAMANT → 3. */
  readonly natureByKey = new Map<string, number>();
  /** Machine number (TM01 = 1 … HM08 = 58) → move id. */
  readonly machineMove = new Map<number, number>();

  /** National Dex number for a species constant. */
  pokemon(speciesKey: string, game: Game = "emerald"): number {
    const dex = this.pokemonBySpeciesValue.get(
      constant(constantsFor(game), speciesKey.trim()),
    );
    if (dex === undefined)
      throw new Error(
        `Species ${speciesKey} (${game}) is not a Pokémon in the table`,
      );
    return dex;
  }
  /** False for SPECIES_NONE, the Egg and the unused Unown slots. */
  isPokemon(speciesKey: string, game: Game = "emerald"): boolean {
    const value = constantsFor(game).get(speciesKey.trim());
    return value !== undefined && this.pokemonBySpeciesValue.has(value);
  }
  move(key: string, game: Game = "emerald"): number {
    return checked(
      this.moveIds,
      constant(constantsFor(game), key.trim()),
      key,
      "move",
    );
  }
  /** Returns null for MOVE_NONE. */
  optionalMove(key: string, game: Game = "emerald"): number | null {
    const k = key.trim();
    return k === "MOVE_NONE" || k === "0" ? null : this.move(k, game);
  }
  item(key: string, game: Game = "emerald"): number {
    return checked(
      this.itemIds,
      constant(constantsFor(game), key.trim()),
      key,
      "item",
    );
  }
  /** Returns null for ITEM_NONE. */
  optionalItem(key: string, game: Game = "emerald"): number | null {
    const k = key.trim();
    return k === "ITEM_NONE" || k === "0" ? null : this.item(k, game);
  }
  ability(key: string, game: Game = "emerald"): number {
    return checked(
      this.abilityIds,
      constant(constantsFor(game), key.trim()),
      key,
      "ability",
    );
  }
}

function checked(
  ids: Set<number>,
  id: number,
  key: string,
  kind: string,
): number {
  if (!ids.has(id))
    throw new Error(`${kind} ${key} (${id}) is not in the ${kind} table`);
  return id;
}

/** Evaluates a numeric field value such as `70`, `STANDARD_FRIENDSHIP` or `PERCENT_FEMALE(12.5)`. */
export function numeric(value: string, constants: Constants): number {
  const v = value.trim();
  const percent = /^PERCENT_FEMALE\(\s*([\d.]+)\s*\)$/.exec(v);
  if (percent)
    return Math.min(254, Math.trunc((Number(percent[1]) * 255) / 100));
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v === "TRUE") return 1;
  if (v === "FALSE") return 0;
  if (/^[A-Za-z_]\w*$/.test(v)) return constant(constants, v);
  // Expressions such as `F_EV_SPREAD_SP_ATTACK | F_EV_SPREAD_HP`.
  const result = evalExpression(v, constants);
  if (result === undefined) throw new Error(`Cannot evaluate ${v}`);
  return result;
}

/** Collects rows into named tables; written to the database in one go at the end. */
export type Rows = Record<string, Record<string, unknown>[]>;

/** Non-fatal observations surfaced in the validation report. */
export const notes: string[] = [];
