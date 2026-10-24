/**
 * Learnsets per version group: level-up, TM/HM, move tutor and egg moves.
 */
import type { Game } from "../../../src/db/schema";
import {
  GAME_SOURCES,
  Lookups,
  constantsFor,
  gameSource,
  readForGame,
} from "../context";
import {
  parseDesignatedArray,
  parseNamedArrays,
  splitTopLevel,
  stripComments,
} from "../lib/c-parse";
import { sourceExists } from "../lib/source";

/** Level-up moves in the game's order: [level, MOVE_KEY][]. Order matters for default movesets. */
export type LevelUpLearnsets = Map<string, [number, string][]>;

export function readLevelUpLearnsets(game: Game): LevelUpLearnsets {
  const { repo } = gameSource(game);
  const arrays = parseNamedArrays(
    readForGame(game, "src/data/pokemon/level_up_learnsets.h"),
  );
  const movesOf = (arrayName: string): [number, string][] => {
    const body = arrays.get(arrayName);
    if (body === undefined)
      throw new Error(`Learnset ${arrayName} not found (${game})`);
    return [
      ...body.matchAll(/LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*(MOVE_\w+)\s*\)/g),
    ].map((m) => [Number(m[1]), m[2]!]);
  };

  const pointersSrc = readForGame(
    game,
    "src/data/pokemon/level_up_learnset_pointers.h",
  );
  const result: LevelUpLearnsets = new Map();
  if (repo === "pokeruby") {
    // Positional: entry i belongs to the species whose constant is i.
    const speciesByValue = new Map<number, string>();
    for (const [name, value] of constantsFor(game)) {
      if (name.startsWith("SPECIES_") && !speciesByValue.has(value))
        speciesByValue.set(value, name);
    }
    const src = stripComments(pointersSrc);
    const body = src.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
    splitTopLevel(body).forEach((arrayName, i) => {
      const species = speciesByValue.get(i);
      if (species) result.set(species, movesOf(arrayName));
    });
  } else {
    for (const e of parseDesignatedArray(pointersSrc, "gLevelUpLearnsets"))
      result.set(e.key, movesOf(e.body));
  }
  return result;
}

type LearnRow = {
  pokemonId: number;
  game: Game;
  moveId: number;
  method: string;
  level: number;
  sortOrder: number;
};

/** Species → machine numbers (TM01 = 1 … HM08 = 58). */
function readTmHm(game: Game, lookups: Lookups): Map<string, number[]> {
  const src = readForGame(game, "src/data/pokemon/tmhm_learnsets.h");
  const out = new Map<string, number[]>();
  const numberOfMove = new Map(
    [...lookups.machineMove].map(([n, move]) => [move, n]),
  );
  const arrayName =
    gameSource(game).repo === "pokeemerald"
      ? "gTMHMLearnsets"
      : /gTMHMLearnsets/.test(src)
        ? "gTMHMLearnsets"
        : "sTMHMLearnsets";
  for (const e of parseDesignatedArray(src, arrayName)) {
    // Emerald: `.learnset = { .TOXIC = TRUE, … }` (move names);
    // FRLG/RS: `TMHM(TM06_TOXIC) | …` (item names, which can differ from move names).
    const emeraldStyle = [...e.body.matchAll(/\.(\w+)\s*=\s*TRUE/g)].map(
      (m) => {
        const n = numberOfMove.get(lookups.move(`MOVE_${m[1]}`, game));
        if (n === undefined) throw new Error(`MOVE_${m[1]} is not a TM/HM`);
        return n;
      },
    );
    const bitStyle = [...e.body.matchAll(/TMHM\((TM|HM)(\d+)_\w+\)/g)].map(
      (m) => (m[1] === "HM" ? 50 : 0) + Number(m[2]),
    );
    out.set(e.key, emeraldStyle.length > 0 ? emeraldStyle : bitStyle);
  }
  return out;
}

function readTutors(game: Game): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (
    !sourceExists(gameSource(game).repo, "src/data/pokemon/tutor_learnsets.h")
  )
    return out; // R/S have no tutors
  const src = readForGame(game, "src/data/pokemon/tutor_learnsets.h");
  const arrayName = /gTutorLearnsets/.test(src)
    ? "gTutorLearnsets"
    : "sTutorLearnsets";
  for (const e of parseDesignatedArray(src, arrayName)) {
    out.set(
      e.key,
      [...e.body.matchAll(/TUTOR\((MOVE_\w+)\)/g)].map((m) => m[1]!),
    );
  }
  return out;
}

function readEggMoves(game: Game): Map<string, string[]> {
  const src = stripComments(readForGame(game, "src/data/pokemon/egg_moves.h"));
  const out = new Map<string, string[]>();
  for (const m of src.matchAll(/egg_moves\(\s*(\w+)\s*,([^)]*)\)/g)) {
    out.set(
      `SPECIES_${m[1]}`,
      splitTopLevel(m[2]!).filter((x) => x.startsWith("MOVE_")),
    );
  }
  return out;
}

function learnsetRows(game: Game, lookups: Lookups): LearnRow[] {
  const rows = new Map<string, LearnRow>();
  const addId = (
    species: string,
    moveId: number,
    method: string,
    level: number,
    sortOrder = 0,
  ) => {
    if (!lookups.isPokemon(species, game)) return; // SPECIES_NONE, unused Unown slots
    const row = {
      pokemonId: lookups.pokemon(species, game),
      game,
      moveId,
      method,
      level,
      sortOrder,
    };
    const key = `${row.pokemonId}|${row.moveId}|${method}|${level}`;
    if (!rows.has(key)) rows.set(key, row);
  };
  const add = (
    species: string,
    moveKey: string,
    method: string,
    level: number,
    sortOrder = 0,
  ) => addId(species, lookups.move(moveKey, game), method, level, sortOrder);
  for (const [species, moves] of readLevelUpLearnsets(game)) {
    moves.forEach(([level, move], i) =>
      add(species, move, "level", level, i + 1),
    );
  }
  for (const [species, machines] of readTmHm(game, lookups)) {
    for (const n of machines) {
      const moveId = lookups.machineMove.get(n);
      if (moveId === undefined) throw new Error(`Unknown machine ${n}`);
      addId(species, moveId, "machine", 0);
    }
  }
  for (const [species, moves] of readTutors(game))
    for (const move of moves) add(species, move, "tutor", 0);
  for (const [species, moves] of readEggMoves(game))
    for (const move of moves) add(species, move, "egg", 0);
  return [...rows.values()];
}

export function importLearnsets(lookups: Lookups) {
  return GAME_SOURCES.flatMap((g) => learnsetRows(g.game, lookups));
}
