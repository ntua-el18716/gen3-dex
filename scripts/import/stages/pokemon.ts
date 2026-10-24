/**
 * Pokémon species data, per-game Deoxys stats, wild held items, Pokédex
 * text and evolutions.
 */
import type { Game, VersionGroup } from "../../../src/db/schema";
import {
  GAME_SOURCES,
  Lookups,
  VERSION_GROUP_GAME,
  constantsFor,
  gameSource,
  notes,
  numeric,
  readForGame,
} from "../context";
import {
  constant,
  parseDesignatedArray,
  parseList,
  parseStringDeclarations,
  parseStringLiteral,
  parseStructFields,
  splitTopLevel,
  stripComments,
  findMatching,
} from "../lib/c-parse";
import { gameText, kebab, titleCase } from "../lib/text";
import { typeName } from "./core";

/** Species data normalised across the Emerald/FRLG and Ruby file formats. */
export type SpeciesData = {
  key: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spAttack: number;
  spDefense: number;
  type1: string;
  type2: string;
  ability1: string;
  ability2: string;
  catchRate: number;
  expYield: number;
  evHp: number;
  evAttack: number;
  evDefense: number;
  evSpeed: number;
  evSpAttack: number;
  evSpDefense: number;
  itemCommon: string;
  itemRare: string;
  genderRatio: number;
  eggCycles: number;
  friendship: number;
  growthRate: string;
  eggGroup1: string;
  eggGroup2: string;
  safariFleeRate: number;
  bodyColor: string;
};

/** Fields that must be identical in every game (anything else is a surprise worth failing on). */
const INVARIANT_FIELDS = [
  "hp",
  "attack",
  "defense",
  "speed",
  "spAttack",
  "spDefense",
  "type1",
  "type2",
  "ability1",
  "ability2",
  "catchRate",
  "expYield",
  "evHp",
  "evAttack",
  "evDefense",
  "evSpeed",
  "evSpAttack",
  "evSpDefense",
  "genderRatio",
  "eggCycles",
  "friendship",
  "growthRate",
  "eggGroup1",
  "eggGroup2",
  "bodyColor",
] as const;

export function readSpecies(game: Game): Map<string, SpeciesData> {
  const { repo } = gameSource(game);
  const constants = constantsFor(game);
  const src =
    repo === "pokeruby"
      ? readForGame(game, "src/data/pokemon/base_stats.h")
      : readForGame(game, "src/data/pokemon/species_info.h");
  const arrayName = repo === "pokeruby" ? "gBaseStats" : "gSpeciesInfo";
  const out = new Map<string, SpeciesData>();
  for (const e of parseDesignatedArray(src, arrayName)) {
    if (!isRealSpecies(e.key, game)) continue;
    const f = parseStructFields(e.body);
    const n = (v: string | undefined) => numeric(v ?? "0", constants);
    const [type1, type2] = f.types ? parseList(f.types) : [f.type1!, f.type2!];
    const [ability1, ability2] = f.abilities
      ? parseList(f.abilities)
      : [f.ability1!, f.ability2!];
    const [eggGroup1, eggGroup2] = f.eggGroups
      ? parseList(f.eggGroups)
      : [f.eggGroup1!, f.eggGroup2!];
    out.set(e.key, {
      key: e.key,
      hp: n(f.baseHP),
      attack: n(f.baseAttack),
      defense: n(f.baseDefense),
      speed: n(f.baseSpeed),
      spAttack: n(f.baseSpAttack),
      spDefense: n(f.baseSpDefense),
      type1: type1!,
      type2: type2!,
      ability1: ability1!,
      ability2: ability2 ?? "ABILITY_NONE",
      catchRate: n(f.catchRate),
      expYield: n(f.expYield),
      evHp: n(f.evYield_HP),
      evAttack: n(f.evYield_Attack),
      evDefense: n(f.evYield_Defense),
      evSpeed: n(f.evYield_Speed),
      evSpAttack: n(f.evYield_SpAttack),
      evSpDefense: n(f.evYield_SpDefense),
      itemCommon: f.itemCommon ?? f.item1 ?? "ITEM_NONE",
      itemRare: f.itemRare ?? f.item2 ?? "ITEM_NONE",
      genderRatio: n(f.genderRatio),
      eggCycles: n(f.eggCycles),
      friendship: n(f.friendship),
      growthRate: f.growthRate!,
      eggGroup1: eggGroup1!,
      eggGroup2: eggGroup2!,
      safariFleeRate: n(f.safariZoneFleeRate),
      bodyColor: f.bodyColor!,
    });
  }
  return out;
}

/** True if two field values match by name, by alias, or by the constants' numeric values. */
function sameValue(
  emeraldValue: string | number,
  otherValue: string | number,
  otherGame: Game,
): boolean {
  if (emeraldValue === otherValue) return true;
  if (typeof emeraldValue === "number" || typeof otherValue === "number")
    return false;
  if (
    (EGG_GROUP_NAMES[emeraldValue] ?? emeraldValue) ===
    (EGG_GROUP_NAMES[otherValue] ?? otherValue)
  )
    return true;
  const a = constantsFor("emerald").get(emeraldValue);
  const b = constantsFor(otherGame).get(otherValue);
  return a !== undefined && a === b;
}

/** Emerald's egg group constant names → schema values. */
const EGG_GROUP_NAMES: Record<string, string> = {
  EGG_GROUP_NO_EGGS_DISCOVERED: "undiscovered",
  EGG_GROUP_UNDISCOVERED: "undiscovered",
};

function eggGroup(key: string): string {
  return EGG_GROUP_NAMES[key] ?? kebab(key.replace(/^EGG_GROUP_/, ""));
}

/** Species constants that are real Pokémon (not SPECIES_NONE, the Egg or the unused Unown slots). */
function isRealSpecies(speciesKey: string, game: Game): boolean {
  const dex = constantsFor(game).get(
    speciesKey.replace(/^SPECIES_/, "NATIONAL_DEX_"),
  );
  return dex !== undefined && dex >= 1 && dex <= 386;
}

export function importPokemon(lookups: Lookups) {
  const emerald = readSpecies("emerald");
  const constants = constantsFor("emerald");

  // Every game must agree on the invariant fields.
  const differences: string[] = [];
  for (const g of GAME_SOURCES) {
    if (g.game === "emerald") continue;
    const other = readSpecies(g.game);
    if (other.size !== emerald.size)
      differences.push(`${g.game}: ${other.size} species vs ${emerald.size}`);
    for (const [key, e] of emerald) {
      const o = other.get(key);
      if (!o) {
        differences.push(`${g.game}: missing ${key}`);
        continue;
      }
      for (const field of INVARIANT_FIELDS) {
        // Compare constants by value: the repos sometimes name them differently
        // (EGG_GROUP_UNDISCOVERED vs EGG_GROUP_NO_EGGS_DISCOVERED).
        if (!sameValue(e[field], o[field], g.game)) {
          differences.push(
            `${g.game} ${key}.${field}: ${o[field]} (Emerald ${e[field]})`,
          );
        }
      }
    }
  }
  if (differences.length > 0) {
    throw new Error(
      `Species data differs between games:\n${differences.slice(0, 40).join("\n")}`,
    );
  }

  const names = new Map(
    parseDesignatedArray(
      readForGame("emerald", "src/data/text/species_names.h"),
      "gSpeciesNames",
    ).map((e) => [e.key, parseStringLiteral(e.body)]),
  );
  const dexEntries = new Map(
    parseDesignatedArray(
      readForGame("emerald", "src/data/pokemon/pokedex_entries.h"),
      "gPokedexEntries",
    ).map((e) => [e.key, parseStructFields(e.body)]),
  );

  const rows = [];
  for (const s of emerald.values()) {
    const suffix = s.key.replace(/^SPECIES_/, "");
    const id = constant(constants, `NATIONAL_DEX_${suffix}`);
    lookups.pokemonBySpeciesValue.set(constant(constants, s.key), id);
    const hoenn = constant(constants, `HOENN_DEX_${suffix}`);
    const dex = dexEntries.get(`NATIONAL_DEX_${suffix}`);
    if (!dex) throw new Error(`No Pokédex entry for ${s.key}`);
    rows.push({
      id,
      key: s.key,
      name: titleCase(names.get(s.key) ?? suffix),
      hoennDexNumber:
        hoenn <= constant(constants, "HOENN_DEX_COUNT") ? hoenn : null,
      type1: typeName(s.type1),
      type2: s.type2 === s.type1 ? null : typeName(s.type2),
      ability1Id: lookups.ability(s.ability1),
      ability2Id:
        s.ability2 === "ABILITY_NONE" ? null : lookups.ability(s.ability2),
      hp: s.hp,
      attack: s.attack,
      defense: s.defense,
      speed: s.speed,
      spAttack: s.spAttack,
      spDefense: s.spDefense,
      evHp: s.evHp,
      evAttack: s.evAttack,
      evDefense: s.evDefense,
      evSpeed: s.evSpeed,
      evSpAttack: s.evSpAttack,
      evSpDefense: s.evSpDefense,
      catchRate: s.catchRate,
      baseExperience: s.expYield,
      genderRatio: s.genderRatio,
      eggCycles: s.eggCycles,
      baseFriendship: s.friendship,
      growthRate: kebab(s.growthRate.replace(/^GROWTH_/, "")),
      eggGroup1: eggGroup(s.eggGroup1),
      eggGroup2: s.eggGroup2 === s.eggGroup1 ? null : eggGroup(s.eggGroup2),
      bodyColor: kebab(s.bodyColor.replace(/^BODY_COLOR_/, "")),
      safariFleeRate: s.safariFleeRate,
      category: titleCase(parseStringLiteral(dex.categoryName ?? "")),
      heightDm: numeric(dex.height!, constants),
      weightHg: numeric(dex.weight!, constants),
    });
  }
  return rows.sort((a, b) => a.id - b.id);
}

export function importWildHeldItems(lookups: Lookups) {
  const rows: {
    pokemonId: number;
    versionGroup: VersionGroup;
    rarity: "common" | "rare";
    itemId: number;
  }[] = [];
  for (const [versionGroup, game] of Object.entries(VERSION_GROUP_GAME) as [
    VersionGroup,
    Game,
  ][]) {
    const species = readSpecies(game);
    // Both games of a group must agree.
    const partner = GAME_SOURCES.find(
      (g) => g.versionGroup === versionGroup && g.game !== game,
    );
    if (partner) {
      const other = readSpecies(partner.game);
      for (const [key, s] of species) {
        const o = other.get(key)!;
        if (s.itemCommon !== o.itemCommon || s.itemRare !== o.itemRare) {
          throw new Error(
            `Wild held items for ${key} differ between ${game} and ${partner.game}`,
          );
        }
      }
    }
    for (const s of species.values()) {
      const pokemonId = lookups.pokemon(s.key, game);
      const common = lookups.optionalItem(s.itemCommon, game);
      const rare = lookups.optionalItem(s.itemRare, game);
      if (common)
        rows.push({
          pokemonId,
          versionGroup,
          rarity: "common",
          itemId: common,
        });
      if (rare)
        rows.push({ pokemonId, versionGroup, rarity: "rare", itemId: rare });
    }
  }
  return rows;
}

const DEOXYS_FORMS: { game: Game; formName: string }[] = [
  { game: "emerald", formName: "Speed Forme" },
  { game: "firered", formName: "Attack Forme" },
  { game: "leafgreen", formName: "Defense Forme" },
];

/** Deoxys's form (and so its base stats) depends on the game; R/S use the normal stats. */
export function importBaseStatOverrides(lookups: Lookups) {
  return DEOXYS_FORMS.map(({ game, formName }) => {
    const constants = constantsFor(game);
    const entries = parseDesignatedArray(
      readForGame(game, "src/pokemon.c"),
      "sDeoxysBaseStats",
    );
    const stat = (key: string) => {
      const e = entries.find((x) => x.key === key);
      if (!e) throw new Error(`sDeoxysBaseStats[${key}] missing for ${game}`);
      return numeric(e.body, constants);
    };
    return {
      pokemonId: lookups.pokemon("SPECIES_DEOXYS"),
      game,
      formName,
      hp: stat("STAT_HP"),
      attack: stat("STAT_ATK"),
      defense: stat("STAT_DEF"),
      speed: stat("STAT_SPEED"),
      spAttack: stat("STAT_SPATK"),
      spDefense: stat("STAT_SPDEF"),
    };
  });
}

export function importPokedexText(lookups: Lookups) {
  const rows: { pokemonId: number; game: Game; text: string }[] = [];
  const push = (game: Game, nationalDex: number, text: string) =>
    rows.push({ pokemonId: nationalDex, game, text: gameText(text) });

  // Emerald, FireRed, LeafGreen: entries point at named strings.
  const textFiles: Partial<Record<Game, string>> = {
    emerald: "src/data/pokemon/pokedex_text.h",
    firered: "src/data/pokemon/pokedex_text_fr.h",
    leafgreen: "src/data/pokemon/pokedex_text_lg.h",
  };
  for (const [game, textFile] of Object.entries(textFiles) as [
    Game,
    string,
  ][]) {
    const constants = constantsFor(game);
    const strings = parseStringDeclarations(readForGame(game, textFile));
    for (const e of parseDesignatedArray(
      readForGame(game, "src/data/pokemon/pokedex_entries.h"),
      "gPokedexEntries",
    )) {
      const dex = constant(constants, e.key);
      if (dex < 1 || dex > 386) continue;
      const description = parseStructFields(e.body).description!;
      push(game, dex, strings.get(description) ?? missingText(game, e.key));
    }
  }

  // Ruby and Sapphire: a positional array with the text split over two pages,
  // and #ifdef SAPPHIRE variants for some Pokémon.
  for (const game of ["ruby", "sapphire"] as const) {
    const src = readForGame(game, "src/data/pokedex_entries_en.h");
    const strings = parseStringDeclarations(src);
    const body = arrayBody(src, "gPokedexEntries");
    splitTopLevel(body).forEach((entry, dex) => {
      if (dex < 1 || dex > 386) return;
      const f = parseStructFields(entry);
      const page1 =
        strings.get(f.descriptionPage1!) ?? missingText(game, String(dex));
      const page2 = strings.get(f.descriptionPage2!) ?? "";
      push(game, dex, `${page1}\n${page2}`);
    });
  }

  const perGame = new Map<Game, number>();
  for (const r of rows) perGame.set(r.game, (perGame.get(r.game) ?? 0) + 1);
  for (const g of GAME_SOURCES) {
    if (perGame.get(g.game) !== 386)
      throw new Error(
        `Expected 386 Pokédex entries for ${g.game}, got ${perGame.get(g.game)}`,
      );
  }
  void lookups;
  return rows;
}

const EVOLUTION_METHODS: Record<string, string> = {
  EVO_FRIENDSHIP: "friendship",
  EVO_FRIENDSHIP_DAY: "friendship-day",
  EVO_FRIENDSHIP_NIGHT: "friendship-night",
  EVO_LEVEL: "level",
  EVO_TRADE: "trade",
  EVO_TRADE_ITEM: "trade-item",
  EVO_ITEM: "item",
  EVO_LEVEL_ATK_GT_DEF: "level-attack-gt-defense",
  EVO_LEVEL_ATK_EQ_DEF: "level-attack-eq-defense",
  EVO_LEVEL_ATK_LT_DEF: "level-attack-lt-defense",
  EVO_LEVEL_SILCOON: "level-silcoon",
  EVO_LEVEL_CASCOON: "level-cascoon",
  EVO_LEVEL_NINJASK: "level-ninjask",
  EVO_LEVEL_SHEDINJA: "level-shedinja",
  EVO_BEAUTY: "beauty",
};

function readEvolutions(game: Game): string[] {
  const out: string[] = [];
  for (const e of parseDesignatedArray(
    readForGame(game, "src/data/pokemon/evolution.h"),
    "gEvolutionTable",
  )) {
    for (const evo of parseList(e.body)) {
      const [method, param, target] = parseList(evo);
      if (!method || method === "0") continue;
      out.push(`${e.key}|${method}|${param}|${target}`);
    }
  }
  return out.sort();
}

export function importEvolutions(lookups: Lookups) {
  const emerald = readEvolutions("emerald");
  for (const game of ["firered", "ruby"] as const) {
    const other = readEvolutions(game);
    const onlyE = emerald.filter((x) => !other.includes(x));
    const onlyO = other.filter((x) => !emerald.includes(x));
    if (onlyE.length || onlyO.length) {
      notes.push(
        `Evolutions differ in ${game}: only Emerald [${onlyE.join("; ")}], only ${game} [${onlyO.join("; ")}]`,
      );
    }
  }
  const constants = constantsFor("emerald");
  return emerald.map((line) => {
    const [from, method, param, to] = line.split("|") as [
      string,
      string,
      string,
      string,
    ];
    const kind = EVOLUTION_METHODS[method];
    if (!kind) throw new Error(`Unknown evolution method ${method}`);
    const isItem = kind === "item" || kind === "trade-item";
    const hasLevel = kind.startsWith("level") || kind === "beauty";
    return {
      fromPokemonId: lookups.pokemon(from),
      toPokemonId: lookups.pokemon(to),
      method: kind,
      level: hasLevel ? numeric(param, constants) : null,
      itemId: isItem ? lookups.item(param) : null,
    };
  });
}

function arrayBody(rawSrc: string, name: string): string {
  const src = stripComments(rawSrc);
  const m = new RegExp(`\\b${name}\\b[^=;]*=\\s*\\{`).exec(src);
  if (!m) throw new Error(`Array ${name} not found`);
  const open = m.index + m[0].length - 1;
  return src.slice(open + 1, findMatching(src, open));
}

function missingText(game: Game, key: string): never {
  throw new Error(`Missing Pokédex text for ${key} in ${game}`);
}
