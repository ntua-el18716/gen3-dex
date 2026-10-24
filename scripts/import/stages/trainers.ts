/**
 * Trainers and their parties for every game, including the default movesets
 * the game generates for trainers whose moves aren't listed.
 */
import type { Game } from "../../../src/db/schema";
import {
  GAME_SOURCES,
  Lookups,
  constantsFor,
  gameSource,
  numeric,
  readForGame,
} from "../context";
import {
  findMatching,
  parseDesignatedArray,
  parseList,
  parseStringLiteral,
  parseStructFields,
  splitTopLevel,
  stripComments,
} from "../lib/c-parse";
import { titleCase } from "../lib/text";
import { readLevelUpLearnsets, type LevelUpLearnsets } from "./learnsets";

const MAX_PER_STAT_IVS = 31;

/**
 * The moves a Pokémon knows when the game creates it at `level` without a
 * custom moveset (pret's GiveBoxMonInitialMoveset): walk the level-up list in
 * order up to `level`; skip moves already known; once four moves are known,
 * forget the oldest to make room.
 */
export function defaultMoveset(
  levelUp: [number, string][],
  level: number,
): string[] {
  const moves: string[] = [];
  for (const [moveLevel, move] of levelUp) {
    if (moveLevel > level) break;
    if (moves.includes(move)) continue;
    if (moves.length === 4) moves.shift();
    moves.push(move);
  }
  return moves;
}

/** Trainer class constant → display name, for a game. Handles designated and positional arrays. */
export function trainerClassNames(game: Game): Map<string, string> {
  const { repo } = gameSource(game);
  const path =
    repo === "pokeruby"
      ? "src/data/text/trainer_class_names_en.h"
      : "src/data/text/trainer_class_names.h";
  const src = stripComments(readForGame(game, path));
  const open = src.indexOf("{", src.indexOf("gTrainerClassNames"));
  const entries = splitTopLevel(src.slice(open + 1, findMatching(src, open)));
  const constants = constantsFor(game);
  const classByValue = new Map<number, string>();
  for (const [name, value] of constants) {
    if (name.startsWith("TRAINER_CLASS_") && !classByValue.has(value))
      classByValue.set(value, name);
  }
  const names = new Map<string, string>();
  entries.forEach((entry, i) => {
    const designated = /^\[(\w+)\]\s*=\s*([\s\S]*)$/.exec(entry);
    const key = designated ? designated[1]! : classByValue.get(i);
    const text = parseStringLiteral(
      designated ? designated[2]! : entry,
    ).replace(/\{PKMN\}/g, "PKMN");
    if (key) names.set(key, titleCase(text));
  });
  return names;
}

type TrainerRow = {
  id: number;
  game: Game;
  key: string;
  name: string;
  trainerClass: string;
  isDouble: boolean;
  itemIds: string;
};
type TrainerMonRow = {
  trainerId: number;
  slot: number;
  pokemonId: number;
  level: number;
  iv: number;
  heldItemId: number | null;
  move1Id: number | null;
  move2Id: number | null;
  move3Id: number | null;
  move4Id: number | null;
  movesComputed: boolean;
};

/** Party arrays: name → list of member field maps. */
function readParties(game: Game): Map<string, Record<string, string>[]> {
  const src = stripComments(readForGame(game, "src/data/trainer_parties.h"));
  const parties = new Map<string, Record<string, string>[]>();
  for (const m of src.matchAll(
    /struct\s+TrainerMon\w+\s+(\w+)\s*\[\s*\]\s*=\s*\{/g,
  )) {
    const open = m.index! + m[0].length - 1;
    const body = src.slice(open + 1, findMatching(src, open));
    // FireRed keeps unused Hoenn trainer slots filled with DUMMY_TRAINER_MON; drop those.
    const members = splitTopLevel(body)
      .map(parseStructFields)
      .filter((f) => f.species !== undefined);
    parties.set(m[1]!, members);
  }
  return parties;
}

export function importTrainers(lookups: Lookups) {
  const trainers: TrainerRow[] = [];
  const mons: TrainerMonRow[] = [];

  for (const { game, repo } of GAME_SOURCES) {
    const constants = constantsFor(game);
    const classNames = trainerClassNames(game);
    const parties = readParties(game);
    const learnsets: LevelUpLearnsets = readLevelUpLearnsets(game);
    const path =
      repo === "pokeruby" ? "src/data/trainers_en.h" : "src/data/trainers.h";

    for (const e of parseDesignatedArray(
      readForGame(game, path),
      "gTrainers",
    )) {
      if (e.key === "TRAINER_NONE") continue;
      const f = parseStructFields(e.body);
      const partyName = /\b([sg]\w*Party_\w+)\b/.exec(f.party ?? "")?.[1];
      const party = partyName ? parties.get(partyName) : undefined;
      if (!party || party.length === 0) continue; // unused trainer slots
      const name = titleCase(parseStringLiteral(f.trainerName ?? ""));
      if (name === "") continue;

      const id = trainers.length + 1;
      trainers.push({
        id,
        game,
        key: e.key,
        name,
        trainerClass: classNames.get(f.trainerClass!) ?? f.trainerClass!,
        isDouble: f.doubleBattle === "TRUE",
        itemIds: parseList(f.items ?? "{}")
          .map((item) => lookups.optionalItem(item, game))
          .filter((x): x is number => x !== null)
          .join(","),
      });

      party.forEach((member, slot) => {
        const species = member.species!;
        const level = numeric(member.lvl ?? member.level!, constants);
        const listed = member.moves
          ? parseList(member.moves).map((m) => lookups.optionalMove(m, game))
          : null;
        const levelUp = learnsets.get(species);
        if (!listed && !levelUp)
          throw new Error(`No learnset for ${species} (${game})`);
        const moveIds =
          listed ??
          defaultMoveset(levelUp!, level).map((m) => lookups.move(m, game));
        mons.push({
          trainerId: id,
          slot,
          pokemonId: lookups.pokemon(species, game),
          level,
          iv: Math.trunc(
            (numeric(member.iv ?? "0", constants) * MAX_PER_STAT_IVS) / 255,
          ),
          heldItemId: member.heldItem
            ? lookups.optionalItem(member.heldItem, game)
            : null,
          move1Id: moveIds[0] ?? null,
          move2Id: moveIds[1] ?? null,
          move3Id: moveIds[2] ?? null,
          move4Id: moveIds[3] ?? null,
          movesComputed: !listed,
        });
      });
    }
  }
  return { trainers, mons };
}
