/**
 * Battle Frontier (Emerald): the ~880 sets, the ~300 trainers, which sets
 * each trainer can draw from, which trainers each challenge draws from,
 * and the Frontier Brains.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  BATTLES_PER_CHALLENGE,
  FACTORY_BRAIN_IV_OFFSET,
  FACTORY_IV_ROWS,
  LAST_RANGED_CHALLENGE,
  LEVEL_50,
  MAX_FRIENDSHIP,
  MIN_OPEN_LEVEL,
  PIKE_ROOMS_PER_CHALLENGE,
  PYRAMID_ROUNDS,
} from "../../../src/lib/frontier";
import {
  FRONTIER_FACILITIES,
  FRONTIER_LEVEL_MODES,
  FRONTIER_SYMBOLS,
  type FrontierFacility,
} from "../../../src/db/schema";
import { Lookups, constantsFor, notes, numeric, readForGame } from "../context";
import {
  constant,
  expandListMacros,
  findArrayBody,
  parseDesignatedArray,
  parseList,
  parseListMacros,
  parseNamedArrays,
  parseStringLiteral,
  parseStructFields,
  splitTopLevel,
  stripComments,
  type Constants,
} from "../lib/c-parse";
import { titleCase } from "../lib/text";
import { DATA_SRC_DIR } from "../sources";
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

/**
 * The rules in src/lib/frontier.ts are hand-written; fail the import if pret
 * says otherwise.
 */
function checkRuleConstants(constants: Constants) {
  const expected: [string, number][] = [
    ["FRONTIER_STAGES_PER_CHALLENGE", BATTLES_PER_CHALLENGE],
    ["FRONTIER_MAX_LEVEL_50", LEVEL_50],
    ["FRONTIER_MIN_LEVEL_OPEN", MIN_OPEN_LEVEL],
    ["MAX_FRIENDSHIP", MAX_FRIENDSHIP],
  ];
  for (const [name, value] of expected) {
    const actual = constant(constants, name);
    if (actual !== value)
      throw new Error(`${name} is ${actual} in pret, ${value} in frontier.ts`);
  }
}

/**
 * GetFrontierTrainerFixedIvs is an if/else chain on the trainer id:
 * `if (trainerId <= FRONTIER_TRAINER_JILL) fixedIv = 3; else if … else
 * fixedIv = MAX_PER_STAT_IVS;`. Returns the rule as a function.
 */
export function parseFixedIvRule(
  src: string,
  constants: Constants,
): (trainerId: number) => number {
  const fn = /\bGetFrontierTrainerFixedIvs\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(
    stripComments(src),
  );
  if (!fn) throw new Error("GetFrontierTrainerFixedIvs not found");
  const steps = [
    ...fn[1]!.matchAll(
      /if\s*\(\s*trainerId\s*<=\s*(\w+)\s*\)\s*fixedIv\s*=\s*(\w+)\s*;/g,
    ),
  ].map((m) => ({
    upTo: numeric(m[1]!, constants),
    iv: numeric(m[2]!, constants),
  }));
  const otherwise = /\belse\s+fixedIv\s*=\s*(\w+)\s*;/.exec(fn[1]!);
  if (steps.length === 0 || !otherwise)
    throw new Error("Unexpected GetFrontierTrainerFixedIvs shape");
  const fallback = numeric(otherwise[1]!, constants);
  return (trainerId) => steps.find((s) => trainerId <= s.upTo)?.iv ?? fallback;
}

/** FRONTIER_FACILITY_TOWER → "tower". */
function facilityKey(key: string): FrontierFacility {
  const name = key.replace(/^FRONTIER_FACILITY_/, "").toLowerCase();
  const facility = FRONTIER_FACILITIES.find((f) => f === name);
  if (!facility) throw new Error(`Unknown facility ${key}`);
  return facility;
}

export function importFrontier(lookups: Lookups) {
  const constants = constantsFor(E);
  checkRuleConstants(constants);
  const towerSrc = readForGame(E, "src/battle_tower.c");
  const utilSrc = readForGame(E, "src/frontier_util.c");

  // BATTLE_FRONTIER_ITEM_* → real item.
  const heldItems = new Map(
    parseDesignatedArray(towerSrc, "gBattleFrontierHeldItems").map((e) => [
      e.key,
      e.body,
    ]),
  );

  const highTier = constant(constants, "FRONTIER_MONS_HIGH_TIER");
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
    const id = constant(constants, e.key);
    return {
      id,
      key: e.key,
      pokemonId: lookups.pokemon(f.species!),
      move1Id: moves[0] ?? null,
      move2Id: moves[1] ?? null,
      move3Id: moves[2] ?? null,
      move4Id: moves[3] ?? null,
      itemId: lookups.optionalItem(item),
      natureId: nature,
      ...frontierEvs(numeric(f.evSpread!.replace(/\s+/g, " "), constants)),
      openLevelOnly: id > highTier,
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
  const fixedIv = parseFixedIvRule(towerSrc, constants);

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
    fixedIv: number;
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
      fixedIv: fixedIv(id),
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

  return {
    sets,
    trainers,
    trainerSets,
    trainerRanges: importTrainerRanges(towerSrc, constants),
    ...importFactory(towerSrc, constants, setIds),
    ...importPikeAndPyramid(lookups, constants),
    ...importBrains(lookups, utilSrc, constants, classNames),
  };
}

/** sFrontierTrainerIdRanges (battles 1–6 of a challenge) and …Hard (battle 7). */
function importTrainerRanges(towerSrc: string, constants: Constants) {
  const read = (name: string, lastBattle: boolean) =>
    splitTopLevel(findArrayBody(towerSrc, name))
      .filter((row) => row !== "")
      .map((row, challenge) => {
        const [first, last] = parseList(row).map((t) => numeric(t, constants));
        if (first === undefined || last === undefined || first > last)
          throw new Error(`Bad trainer range in ${name}: ${row}`);
        return {
          challenge,
          lastBattle,
          firstTrainerId: first,
          lastTrainerId: last,
        };
      });
  const normal = read("sFrontierTrainerIdRanges", false);
  const hard = read("sFrontierTrainerIdRangesHard", true);
  if (
    normal.length !== LAST_RANGED_CHALLENGE + 1 ||
    hard.length !== LAST_RANGED_CHALLENGE + 1
  )
    throw new Error(
      `Expected ${LAST_RANGED_CHALLENGE + 1} challenge ranges, got ${normal.length}/${hard.length}`,
    );
  return [...normal, ...hard];
}

/**
 * Battle Factory: the set ranges per level mode and challenge
 * (sInitialRentalMonRanges: 8 rows for Level 50, then 8 for Open Level) and
 * the IV table (sFixedIVTable). Also checks that the quirks encoded in
 * src/lib/frontier.ts are still what pret's code does.
 */
function importFactory(
  towerSrc: string,
  constants: Constants,
  setIds: Set<number>,
) {
  const factorySrc = readForGame(E, "src/battle_factory.c");
  const rows = (name: string) =>
    splitTopLevel(findArrayBody(factorySrc, name))
      .filter((row) => row !== "")
      .map((row) => parseList(row).map((t) => numeric(t, constants)));

  const ranges = rows("sInitialRentalMonRanges");
  const perMode = LAST_RANGED_CHALLENGE + 1;
  if (ranges.length !== perMode * FRONTIER_LEVEL_MODES.length)
    throw new Error(`Expected ${perMode} Factory ranges per level mode`);
  const setRanges = ranges.map(([first, last], i) => {
    if (
      first === undefined ||
      last === undefined ||
      !setIds.has(first) ||
      !setIds.has(last) ||
      first > last
    )
      throw new Error(`Bad Factory range ${i}: ${first}–${last}`);
    return {
      levelMode: FRONTIER_LEVEL_MODES[Math.floor(i / perMode)]!,
      challenge: i % perMode,
      firstSetId: first,
      lastSetId: last,
    };
  });

  const ivs = rows("sFixedIVTable").map(([iv, lastBattleIv], challenge) => {
    if (iv === undefined || lastBattleIv === undefined)
      throw new Error(`Bad Factory IV row ${challenge}`);
    return { challenge, iv, lastBattleIv };
  });
  if (ivs.length !== FACTORY_IV_ROWS)
    throw new Error(
      `Expected ${FACTORY_IV_ROWS} Factory IV rows, got ${ivs.length}`,
    );

  const expectations: [string, string, RegExp][] = [
    // Ranges: challenges below 7 have their own row; later ones use row 7.
    [
      "battle_factory.c",
      factorySrc,
      new RegExp(String.raw`challengeNum < ${LAST_RANGED_CHALLENGE}\b`),
    ],
    // The off-by-one clamp in GetFactoryMonFixedIV (row 8 reads past the table).
    [
      "battle_factory.c",
      factorySrc,
      /challengeNum > ARRAY_COUNT\(sFixedIVTable\)/,
    ],
    [
      "battle_factory.c",
      factorySrc,
      new RegExp(
        String.raw`GetFactoryMonFixedIV\(challengeNum \+ ${FACTORY_BRAIN_IV_OFFSET}, FALSE\)`,
      ),
    ],
    // Opponents' IVs come from the Battle Tower Level 50 streak.
    [
      "battle_tower.c",
      towerSrc,
      /challengeNum = gSaveBlock2Ptr->frontier\.towerWinStreaks\[battleMode\]\[FRONTIER_LVL_50\]/,
    ],
  ];
  for (const [file, src, pattern] of expectations)
    if (!pattern.test(src))
      throw new Error(
        `${file} no longer matches ${pattern} (see src/lib/frontier.ts)`,
      );

  return { factorySetRanges: setRanges, factoryIvs: ivs };
}

type WildJsonGroup = {
  label: string;
  fields?: { type: string; encounter_rates: number[] }[];
  encounters: { land_mons?: { mons: { species: string }[] } }[];
};

/**
 * Battle Pike and Battle Pyramid wild Pokémon. The real tables are in C;
 * wild_encounters.json only has placeholder headers whose slots say which
 * table entry each grass slot picks (Pike: by species; Pyramid: species
 * number − 1, so SPECIES_BULBASAUR = entry 0).
 */
function importPikeAndPyramid(lookups: Lookups, constants: Constants) {
  const expectConstant = (name: string, value: number) => {
    if (constant(constants, name) !== value)
      throw new Error(`${name} is not ${value} (see src/lib/frontier.ts)`);
  };
  expectConstant("NUM_PIKE_ROOMS", PIKE_ROOMS_PER_CHALLENGE);
  expectConstant("TOTAL_PYRAMID_ROUNDS", PYRAMID_ROUNDS);

  const json = JSON.parse(
    readFileSync(
      path.resolve(DATA_SRC_DIR, "pokeemerald/src/data/wild_encounters.json"),
      "utf8",
    ),
  ) as { wild_encounter_groups: WildJsonGroup[] };
  const groups = json.wild_encounter_groups;
  const landRates = groups
    .flatMap((g) => g.fields ?? [])
    .find((f) => f.type === "land_mons")?.encounter_rates;
  if (!landRates) throw new Error("No land encounter rates");
  const header = (label: string) => {
    const g = groups.find((x) => x.label === label);
    if (!g) throw new Error(`${label} not found`);
    return g.encounters.map((e) => e.land_mons!.mons.map((m) => m.species));
  };
  /** Sums the grass-slot rates per table entry. */
  const rates = (slots: string[], entryOf: (species: string) => number) => {
    const out = new Map<number, number>();
    slots.forEach((species, i) => {
      const entry = entryOf(species);
      out.set(entry, (out.get(entry) ?? 0) + landRates[i]!);
    });
    return out;
  };
  const moves = (list: string) => {
    const [m1, m2, m3, m4] = parseList(list).map((m) =>
      lookups.optionalMove(m),
    );
    return {
      move1Id: m1 ?? null,
      move2Id: m2 ?? null,
      move3Id: m3 ?? null,
      move4Id: m4 ?? null,
    };
  };
  /** Struct entries of each array named in a pointer table. */
  const tables = (src: string, pointerTable: string) => {
    const arrays = parseNamedArrays(src);
    return parseList(`{${findArrayBody(src, pointerTable)}}`).map((name) => {
      const body = arrays.get(name);
      if (body === undefined) throw new Error(`${name} not found`);
      return splitTopLevel(body)
        .filter((e) => e.trim() !== "")
        .map((e) => parseStructFields(e));
    });
  };

  // Pike
  const pikeSrc = readForGame(E, "src/battle_pike.c");
  for (const pattern of [
    /winStreak <= 20 \* NUM_PIKE_ROOMS[\s\S]*winStreak <= 40 \* NUM_PIKE_ROOMS[\s\S]*winStreak <= 60 \* NUM_PIKE_ROOMS/,
    /monLevel = FRONTIER_MAX_LEVEL_50 - wildMons\[headerId\]\[pikeMonId\]\.levelDelta/,
  ])
    if (!pattern.test(pikeSrc))
      throw new Error(`battle_pike.c no longer matches ${pattern}`);
  const pikeHeaders = header("gBattlePikeWildMonHeaders");
  const pikeWildMons = (
    [
      ["50", "sLvl50Mons"],
      ["open", "sLvlOpenMons"],
    ] as const
  ).flatMap(([levelMode, pointerTable]) =>
    tables(pikeSrc, pointerTable).flatMap((mons, tier) => {
      const species = mons.map((f) => f.species!);
      const slotRates = rates(pikeHeaders[tier]!, (s) => {
        const entry = species.indexOf(s);
        if (entry === -1)
          throw new Error(`Pike tier ${tier}: ${s} not in table`);
        return entry;
      });
      return mons.map((f, slot) => ({
        levelMode,
        tier,
        slot,
        pokemonId: lookups.pokemon(f.species!),
        levelDelta: Number(f.levelDelta),
        rate: slotRates.get(slot) ?? 0,
        ...moves(f.moves!),
      }));
    }),
  );

  // Pyramid
  const pyramidSrc = readForGame(E, "src/battle_pyramid.c");
  for (const pattern of [
    /pyramidWinStreaks\[lvl\] \/ FRONTIER_STAGES_PER_CHALLENGE\) % TOTAL_PYRAMID_ROUNDS/,
    /lvl -= wildMons\[id\]\.lvl;\s*lvl = lvl - 5 \+ \(Random\(\) % 11\)/,
    /lvl = wildMons\[id\]\.lvl - 5 \+ \(\(Random\(\) % 11\)\)/,
  ])
    if (!pattern.test(pyramidSrc))
      throw new Error(`battle_pyramid.c no longer matches ${pattern}`);
  const pyramidWildMons = (
    [
      ["50", "battle_pyramid_level_50_wild_mons.h", "sLevel50WildMonPointers"],
      [
        "open",
        "battle_pyramid_open_level_wild_mons.h",
        "sOpenLevelWildMonPointers",
      ],
    ] as const
  ).flatMap(([levelMode, file, pointerTable]) => {
    const rounds = tables(
      readForGame(E, `src/data/battle_frontier/${file}`),
      pointerTable,
    );
    if (rounds.length !== PYRAMID_ROUNDS)
      throw new Error(`Expected ${PYRAMID_ROUNDS} Pyramid rounds in ${file}`);
    return rounds.flatMap((mons, round) =>
      mons.map((f, slot) => ({
        levelMode,
        round,
        slot,
        pokemonId: lookups.pokemon(f.species!),
        level: Number(f.lvl),
        abilityNum:
          f.abilityNum === "ABILITY_RANDOM" ? null : Number(f.abilityNum),
        ...moves(f.moves!),
      })),
    );
  });
  const pyramidFloorRates = header("gBattlePyramidWildMonHeaders").flatMap(
    (slots, i) =>
      [...rates(slots, (s) => constant(constants, s) - 1)]
        .sort(([a], [b]) => a - b)
        .map(([slot, rate]) => ({ floor: i + 1, slot, rate })),
  );

  return { pikeWildMons, pyramidWildMons, pyramidFloorRates };
}

/** Frontier Brains: who, when (sFrontierBrainStreakAppearances), and their teams. */
function importBrains(
  lookups: Lookups,
  utilSrc: string,
  constants: Constants,
  classNames: Map<string, string>,
) {
  const trainersById = new Map(
    parseDesignatedArray(
      readForGame(E, "src/data/trainers.h"),
      "gTrainers",
    ).map((e) => [e.key, parseStructFields(e.body)]),
  );
  const trainerOf = new Map(
    parseDesignatedArray(utilSrc, "sFrontierBrainTrainerIds").map((e) => [
      facilityKey(e.key),
      e.body,
    ]),
  );

  const brains = parseDesignatedArray(
    utilSrc,
    "sFrontierBrainStreakAppearances",
  ).map((e) => {
    const facility = facilityKey(e.key);
    const [silverAt, goldAt, repeatEvery, streakOffset] = parseList(e.body).map(
      (v) => numeric(v, constants),
    );
    const trainer = trainersById.get(trainerOf.get(facility) ?? "");
    if (!trainer || streakOffset === undefined)
      throw new Error(`Incomplete Frontier Brain data for ${facility}`);
    return {
      facility,
      name: titleCase(parseStringLiteral(trainer.trainerName!)),
      trainerClass:
        classNames.get(trainer.trainerClass!) ?? trainer.trainerClass!,
      silverAt: silverAt!,
      goldAt: goldAt!,
      repeatEvery: repeatEvery!,
      streakOffset,
    };
  });

  const brainMons = parseDesignatedArray(
    utilSrc,
    "sFrontierBrainsMons",
  ).flatMap((e) => {
    const facility = facilityKey(e.key);
    // The Factory Brain battles with random rentals; pret's entry here is
    // an unused copy of Steven's multi-battle team.
    if (facility === "factory") {
      notes.push("Skipped the Factory Brain's unused fixed team");
      return [];
    }
    return parseList(e.body).flatMap((symbolBody, s) =>
      parseList(symbolBody).map((monBody, slot) => {
        const f = parseStructFields(monBody);
        const moves = parseList(f.moves!).map((m) => lookups.optionalMove(m));
        const evs = parseList(f.evs!).map((v) => numeric(v, constants));
        const nature = lookups.natureByKey.get(f.nature!);
        if (nature === undefined || evs.length !== 6)
          throw new Error(`Bad Frontier Brain mon for ${facility}`);
        return {
          facility,
          symbol: FRONTIER_SYMBOLS[s]!,
          slot,
          pokemonId: lookups.pokemon(f.species!),
          itemId: lookups.optionalItem(f.heldItem!),
          natureId: nature,
          fixedIv: numeric(f.fixedIV!, constants),
          // Same order as the game's stats: HP, Atk, Def, Speed, SpA, SpD.
          ...Object.fromEntries(EV_BITS.map((k, i) => [k, evs[i]!])),
          move1Id: moves[0] ?? null,
          move2Id: moves[1] ?? null,
          move3Id: moves[2] ?? null,
          move4Id: moves[3] ?? null,
        };
      }),
    );
  });

  return { brains, brainMons };
}
