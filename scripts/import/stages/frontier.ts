/**
 * Battle Frontier (Emerald): the ~880 sets, the ~300 trainers, and which
 * sets each trainer can draw from.
 */
import { Lookups, constantsFor, numeric, readForGame } from "../context";
import {
  constant,
  expandListMacros,
  parseDesignatedArray,
  parseList,
  parseListMacros,
  parseNamedArrays,
  parseStringLiteral,
  parseStructFields,
  splitTopLevel,
} from "../lib/c-parse";
import { titleCase } from "../lib/text";
import { trainerClassNames } from "./trainers";

const E = "emerald" as const;
const MAX_TOTAL_EVS = 510;

/** EV spread bits in pret's order, which is also the stat order the game uses. */
const EV_BITS = [
  "evHp",
  "evAttack",
  "evDefense",
  "evSpeed",
  "evSpAttack",
  "evSpDefense",
] as const;

/**
 * pret's CreateMonWithEVSpread: 510 is split evenly between the chosen
 * stats. The value is stored in a u8, so a single-stat spread (510) wraps to 254.
 */
export function frontierEvs(
  spreadBits: number,
): Record<(typeof EV_BITS)[number], number> {
  const count = EV_BITS.filter((_, i) => spreadBits & (1 << i)).length;
  const amount = count === 0 ? 0 : Math.trunc(MAX_TOTAL_EVS / count) & 0xff;
  return Object.fromEntries(
    EV_BITS.map((k, i) => [k, spreadBits & (1 << i) ? amount : 0]),
  ) as Record<(typeof EV_BITS)[number], number>;
}

export function importFrontier(lookups: Lookups) {
  const constants = constantsFor(E);

  // BATTLE_FRONTIER_ITEM_* → real item.
  const heldItems = new Map(
    parseDesignatedArray(
      readForGame(E, "src/battle_tower.c"),
      "gBattleFrontierHeldItems",
    ).map((e) => [e.key, e.body]),
  );

  const sets = parseDesignatedArray(
    readForGame(E, "src/data/battle_frontier/battle_frontier_mons.h"),
    "gBattleFrontierMons",
  ).map((e) => {
    const f = parseStructFields(e.body);
    const moves = parseList(f.moves!).map((m) => lookups.optionalMove(m));
    const item = heldItems.get(f.itemTableId!);
    if (item === undefined)
      throw new Error(`Unknown Frontier item ${f.itemTableId}`);
    const nature = lookups.natureByKey.get(f.nature!);
    if (nature === undefined) throw new Error(`Unknown nature ${f.nature}`);
    return {
      id: constant(constants, e.key),
      key: e.key,
      pokemonId: lookups.pokemon(f.species!),
      move1Id: moves[0] ?? null,
      move2Id: moves[1] ?? null,
      move3Id: moves[2] ?? null,
      move4Id: moves[3] ?? null,
      itemId: lookups.optionalItem(item),
      natureId: nature,
      ...frontierEvs(numeric(f.evSpread!.replace(/\s+/g, " "), constants)),
    };
  });
  const setIds = new Set(sets.map((s) => s.id));

  // Trainer classes: facility class → trainer class → name.
  const facilityToClass = new Map(
    parseDesignatedArray(
      readForGame(E, "src/data/pokemon/trainer_class_lookups.h"),
      "gFacilityClassToTrainerClass",
    ).map((e) => [e.key, e.body]),
  );
  const classNames = trainerClassNames(E);

  // Which sets each trainer uses: arrays of FRONTIER_MON_* and list macros.
  const monsSrc = readForGame(
    E,
    "src/data/battle_frontier/battle_frontier_trainer_mons.h",
  );
  const macros = parseListMacros(monsSrc);
  const arrays = parseNamedArrays(monsSrc);

  const trainers: {
    id: number;
    key: string;
    name: string;
    trainerClass: string;
  }[] = [];
  const trainerSets: { trainerId: number; setId: number }[] = [];
  for (const e of parseDesignatedArray(
    readForGame(E, "src/data/battle_frontier/battle_frontier_trainers.h"),
    "gBattleFrontierTrainers",
  )) {
    const f = parseStructFields(e.body);
    const id = constant(constants, e.key);
    const trainerClass = facilityToClass.get(f.facilityClass!);
    trainers.push({
      id,
      key: e.key,
      name: titleCase(parseStringLiteral(f.trainerName!)),
      trainerClass:
        (trainerClass && classNames.get(trainerClass)) ?? f.facilityClass!,
    });
    const body = arrays.get(f.monSet!);
    if (body === undefined) throw new Error(`Mon set ${f.monSet} not found`);
    const setTokens = expandListMacros(splitTopLevel(body), macros).filter(
      (t) => t.startsWith("FRONTIER_MON_"),
    );
    for (const token of new Set(setTokens)) {
      const setId = constant(constants, token);
      if (!setIds.has(setId))
        throw new Error(`${e.key} references unknown set ${token}`);
      trainerSets.push({ trainerId: id, setId });
    }
  }
  return { sets, trainers, trainerSets };
}
