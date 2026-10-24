/**
 * Game-invariant reference data, read from Emerald: games, abilities, moves,
 * items, natures, the type chart and the TM/HM list.
 */
import type { PokemonType, Stat } from "../../../src/db/schema";
import {
  GAME_SOURCES,
  Lookups,
  readForGame,
  constantsFor,
  numeric,
} from "../context";
import {
  constant,
  parseDesignatedArray,
  parseList,
  parseListMacros,
  parseStringDeclarations,
  parseStringLiteral,
  parseStructFields,
  splitTopLevel,
  stripComments,
} from "../lib/c-parse";
import { gameText, kebab, titleCase } from "../lib/text";

const E = "emerald" as const;

export function typeName(typeKey: string): PokemonType {
  if (typeKey === "TYPE_MYSTERY") return "???";
  return kebab(typeKey.replace(/^TYPE_/, "")) as PokemonType;
}

export function importGames() {
  return GAME_SOURCES.map((g, i) => ({
    id: g.game,
    name: g.name,
    versionGroup: g.versionGroup,
    region: g.region,
    sortOrder: i,
  }));
}

export function importAbilities(lookups: Lookups) {
  const src = readForGame(E, "src/data/text/abilities.h");
  const constants = constantsFor(E);
  const strings = parseStringDeclarations(src);
  const names = new Map(
    parseDesignatedArray(src, "gAbilityNames").map((e) => [
      e.key,
      parseStringLiteral(e.body),
    ]),
  );
  const rows = parseDesignatedArray(src, "gAbilityDescriptionPointers")
    .filter((e) => e.key !== "ABILITY_NONE")
    .map((e) => {
      const id = constant(constants, e.key);
      lookups.abilityIds.add(id);
      return {
        id,
        key: e.key,
        name: titleCase(names.get(e.key) ?? missing("ability name", e.key)),
        description: gameText(
          strings.get(e.body) ?? missing("ability description", e.body),
        ),
      };
    });
  return rows;
}

export function importMoves(lookups: Lookups) {
  const constants = constantsFor(E);
  const namesSrc = readForGame(E, "src/data/text/move_names.h");
  const names = new Map(
    parseDesignatedArray(namesSrc, "gMoveNames").map((e) => [
      e.key,
      parseStringLiteral(e.body),
    ]),
  );
  const descSrc = readForGame(E, "src/data/text/move_descriptions.h");
  const descStrings = parseStringDeclarations(descSrc);
  const descriptions = new Map(
    parseDesignatedArray(descSrc, "gMoveDescriptionPointers").map((e) => [
      e.key.replace(/\s*-\s*1$/, ""),
      descStrings.get(e.body),
    ]),
  );

  const movesSrc = readForGame(E, "src/data/battle_moves.h");
  return parseDesignatedArray(movesSrc, "gBattleMoves")
    .filter((e) => e.key !== "MOVE_NONE")
    .map((e) => {
      const f = parseStructFields(e.body);
      const id = constant(constants, e.key);
      lookups.moveIds.add(id);
      const flags = (f.flags ?? "").split("|").map((s) => s.trim());
      return {
        id,
        key: e.key,
        name: titleCase(names.get(e.key) ?? missing("move name", e.key)),
        type: typeName(f.type!),
        power: numeric(f.power ?? "0", constants),
        accuracy: numeric(f.accuracy ?? "0", constants),
        pp: numeric(f.pp!, constants),
        priority: numeric(f.priority ?? "0", constants),
        effectChance: numeric(f.secondaryEffectChance ?? "0", constants),
        effect: f.effect!,
        target: f.target!,
        makesContact: flags.includes("FLAG_MAKES_CONTACT"),
        description: gameText(
          descriptions.get(e.key) ?? missing("move description", e.key),
        ),
      };
    });
}

const POCKETS: Record<string, string> = {
  POCKET_ITEMS: "items",
  POCKET_POKE_BALLS: "poke-balls",
  POCKET_TM_HM: "tms-hms",
  POCKET_BERRIES: "berries",
  POCKET_KEY_ITEMS: "key-items",
};

export function importItems(lookups: Lookups) {
  const constants = constantsFor(E);
  const descriptions = parseStringDeclarations(
    readForGame(E, "src/data/text/item_descriptions.h"),
  );
  return (
    parseDesignatedArray(readForGame(E, "src/data/items.h"), "gItems")
      .filter((e) => e.key !== "ITEM_NONE")
      // Skip the unused placeholder slots, named "????????" in the game.
      .filter(
        (e) =>
          !parseStringLiteral(parseStructFields(e.body).name ?? "").startsWith(
            "?",
          ),
      )
      .map((e) => {
        const f = parseStructFields(e.body);
        // Emerald keys TMs by move (ITEM_TM_FOCUS_PUNCH); .itemId has the real constant.
        const id = constant(constants, f.itemId ?? e.key);
        lookups.itemIds.add(id);
        const rawName = parseStringLiteral(f.name ?? "");
        return {
          id,
          key: e.key,
          name: titleCase(rawName),
          description: gameText(descriptions.get(f.description ?? "") ?? ""),
          price: numeric(f.price ?? "0", constants),
          pocket: POCKETS[f.pocket ?? ""] ?? null,
          holdEffect:
            !f.holdEffect || f.holdEffect === "HOLD_EFFECT_NONE"
              ? null
              : f.holdEffect,
        };
      })
  );
}

/** Gen 3 nature table order: Attack, Defense, Speed, Sp. Atk, Sp. Def. */
const NATURE_STATS: Stat[] = [
  "attack",
  "defense",
  "speed",
  "spAttack",
  "spDefense",
];

export function importNatures(lookups: Lookups) {
  const constants = constantsFor(E);
  const namesSrc = readForGame(E, "src/data/text/nature_names.h");
  const nameStrings = parseStringDeclarations(namesSrc);
  const names = new Map(
    parseDesignatedArray(namesSrc, "gNatureNamePointers").map((e) => [
      e.key,
      nameStrings.get(e.body),
    ]),
  );
  return parseDesignatedArray(
    readForGame(E, "src/pokemon.c"),
    "gNatureStatTable",
  ).map((e) => {
    const effects = parseList(e.body).map(Number);
    const up = effects.findIndex((x) => x > 0);
    const down = effects.findIndex((x) => x < 0);
    const id = constant(constants, e.key);
    lookups.natureByKey.set(e.key, id);
    return {
      id,
      name: titleCase(names.get(e.key) ?? missing("nature name", e.key)),
      increasedStat: up >= 0 ? NATURE_STATS[up]! : null,
      decreasedStat: down >= 0 ? NATURE_STATS[down]! : null,
    };
  });
}

const MULTIPLIERS: Record<string, number> = {
  TYPE_MUL_NO_EFFECT: 0,
  TYPE_MUL_NOT_EFFECTIVE: 0.5,
  TYPE_MUL_SUPER_EFFECTIVE: 2,
};

export function importTypeChart() {
  const src = stripComments(readForGame(E, "src/battle_main.c"));
  const m = /gTypeEffectiveness\s*\[[^\]]*\]\s*=\s*\{([\s\S]*?)\};/.exec(src);
  if (!m) throw new Error("gTypeEffectiveness not found");
  const tokens = splitTopLevel(m[1]!);
  const rows: {
    attackingType: PokemonType;
    defendingType: PokemonType;
    multiplier: number;
  }[] = [];
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const [atk, def, mul] = [tokens[i]!, tokens[i + 1]!, tokens[i + 2]!];
    // TYPE_FORESIGHT separates the Ghost immunities that Foresight removes;
    // they are still part of the normal chart. TYPE_ENDTABLE ends it.
    if (atk === "TYPE_FORESIGHT") continue;
    if (atk === "TYPE_ENDTABLE") break;
    const multiplier = MULTIPLIERS[mul];
    if (multiplier === undefined) throw new Error(`Unknown multiplier ${mul}`);
    rows.push({
      attackingType: typeName(atk),
      defendingType: typeName(def),
      multiplier,
    });
  }
  return rows;
}

/** TM01–TM50 then HM01–HM08, in the order of FOREACH_TM / FOREACH_HM. */
export function importMachines(lookups: Lookups) {
  const macros = parseListMacros(readForGame(E, "include/constants/tms_hms.h"));
  const names = (macro: string) =>
    (macros.get(macro)?.body ?? [])
      .join(" ")
      .match(/F\((\w+)\)/g)!
      .map((s) => s.slice(2, -1));
  const tms = names("FOREACH_TM");
  const hms = names("FOREACH_HM");
  if (tms.length !== 50 || hms.length !== 8)
    throw new Error(
      `Expected 50 TMs and 8 HMs, got ${tms.length}/${hms.length}`,
    );
  const rows = [
    ...tms.map((name, i) => ({
      number: i + 1,
      label: `TM${String(i + 1).padStart(2, "0")}`,
      moveId: lookups.move(`MOVE_${name}`),
    })),
    ...hms.map((name, i) => ({
      number: 51 + i,
      label: `HM${String(i + 1).padStart(2, "0")}`,
      moveId: lookups.move(`MOVE_${name}`),
    })),
  ];
  for (const r of rows) lookups.machineMove.set(r.number, r.moveId);
  return rows;
}

function missing(what: string, key: string): never {
  throw new Error(`Missing ${what} for ${key}`);
}
