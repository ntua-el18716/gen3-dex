/**
 * Pokémon you get once: starters, gifts, eggs, overworld legendaries and
 * other one-time battles, roamers, in-game trades and Game Corner prizes.
 *
 * Most come from the map scripts (givemon, giveegg, setwildbattle,
 * seteventmon; see lib/map-scripts.ts for how a command is traced to its
 * maps). The rest is in C code: the Hoenn starters (starter_choose.c +
 * battle_setup.c), roamers (roamer.c) and trade data (trade tables, located
 * through the scripts that start each trade).
 *
 * Only the notes (requirements such as "needs the Devon Scope") are
 * hand-written; every note must match an imported row.
 */
import path from "node:path";

import type { Game, StaticEncounterKind } from "../../../src/db/schema";
import {
  GAME_SOURCES,
  Lookups,
  constantsFor,
  notes,
  readForGame,
  type GameSource,
} from "../context";
import {
  constant,
  findArrayBody,
  findMatching,
  parseDesignatedEntries,
  parseList,
  parseStringLiteral,
  parseStructFields,
  preprocess,
  splitTopLevel,
  stripComments,
} from "../lib/c-parse";
import { loadScriptGraph, type ScriptGraph } from "../lib/map-scripts";
import { sourceExists, readSource } from "../lib/source";
import { mapName, titleCase } from "../lib/text";
import { DATA_SRC_DIR } from "../sources";
import type { Location } from "./encounters";

export type StaticEncounterRow = {
  game: Game;
  locationId: number | null;
  pokemonId: number;
  kind: StaticEncounterKind;
  level: number | null;
  count: number;
  heldItemId: number | null;
  tradeForId: number | null;
  nickname: string | null;
  note: string | null;
};

/**
 * Ruby and Sapphire share the Lilycove hideout's two versions; the game only
 * lets you into the villain team's one (Magma in Ruby, Aqua in Sapphire).
 */
const UNREACHABLE_MAPS: Partial<Record<Game, RegExp>> = {
  ruby: /^MAP_AQUA_HIDEOUT_/,
  sapphire: /^MAP_MAGMA_HIDEOUT_/,
};

/**
 * Hand-written hints, by species. `games` limits a note to some games.
 * The importer fails if a note matches nothing, so stale notes can't linger.
 */
const NOTES: { species: string; games?: Game[]; note: string }[] = [
  // Hoenn
  {
    species: "SPECIES_LILEEP",
    note: "Revived from the Root Fossil. Mirage Tower has it and the Claw Fossil, but you can take only one.",
  },
  {
    species: "SPECIES_ANORITH",
    note: "Revived from the Claw Fossil. Mirage Tower has it and the Root Fossil, but you can take only one.",
  },
  ...["SPECIES_CHIKORITA", "SPECIES_CYNDAQUIL", "SPECIES_TOTODILE"].map(
    (species) => ({
      species,
      games: ["emerald"] as Game[],
      note: "Choose one, after completing the Hoenn Pokédex.",
    }),
  ),
  { species: "SPECIES_BELDUM", note: "After the Elite Four." },
  {
    species: "SPECIES_CASTFORM",
    note: "After driving the villain team out of the Weather Institute.",
  },
  { species: "SPECIES_KECLEON", note: "Invisible: needs the Devon Scope." },
  {
    species: "SPECIES_ELECTRODE",
    note: "Disguised as an item.",
  },
  {
    species: "SPECIES_VOLTORB",
    note: "Disguised as an item.",
  },
  { species: "SPECIES_SUDOWOODO", note: "Needs the Wailmer Pail." },
  ...["SPECIES_REGIROCK", "SPECIES_REGICE", "SPECIES_REGISTEEL"].map(
    (species) => ({
      species,
      note: "Opened by solving the Sealed Chamber's Braille puzzle.",
    }),
  ),
  ...["SPECIES_GROUDON", "SPECIES_KYOGRE"].map((species) => ({
    species,
    games: ["emerald"] as Game[],
    note: "After the Elite Four. The cave moves around; the Weather Institute tells you where.",
  })),
  ...["SPECIES_LATIAS", "SPECIES_LATIOS"].map((species) => ({
    species,
    note: "Needs the Eon Ticket (event item).",
  })),
  { species: "SPECIES_MEW", note: "Needs the Old Sea Map (event item)." },
  ...["SPECIES_LUGIA", "SPECIES_HO_OH"].map((species) => ({
    species,
    note: "Needs the Mystic Ticket (event item).",
  })),
  { species: "SPECIES_DEOXYS", note: "Needs the Aurora Ticket (event item)." },
  // Kanto
  {
    species: "SPECIES_OMANYTE",
    note: "Revived from the Helix Fossil (you choose it or the Dome Fossil at Mt. Moon).",
  },
  {
    species: "SPECIES_KABUTO",
    note: "Revived from the Dome Fossil (you choose it or the Helix Fossil at Mt. Moon).",
  },
  { species: "SPECIES_AERODACTYL", note: "Revived from the Old Amber." },
  ...["SPECIES_HITMONLEE", "SPECIES_HITMONCHAN"].map((species) => ({
    species,
    note: "Choose one, after beating the Karate Master.",
  })),
  { species: "SPECIES_MAGIKARP", note: "Sold for ₽500." },
  {
    species: "SPECIES_SNORLAX",
    note: "Asleep on the road: needs the Poké Flute.",
  },
  {
    species: "SPECIES_MEWTWO",
    note: "After the Elite Four and the Sevii Islands story.",
  },
];

export function importStaticEncounters(
  lookups: Lookups,
  locations: Location[],
): StaticEncounterRow[] {
  const locationIds = new Map(
    locations.map((l) => [`${l.region}:${l.key}`, l.id]),
  );
  const locationId = (source: GameSource, mapKey: string): number => {
    const key = `${source.region}:${mapKey}`;
    let id = locationIds.get(key);
    if (id === undefined) {
      id = locations.length + 1;
      locations.push({
        id,
        key: mapKey,
        name: mapName(mapKey),
        region: source.region,
      });
      locationIds.set(key, id);
    }
    return id;
  };

  const rows: (StaticEncounterRow & { species: string })[] = [];
  for (const source of GAME_SOURCES) {
    const { game } = source;
    const graph = loadScriptGraph(
      path.resolve(DATA_SRC_DIR, source.repo),
      source.defines,
    );
    const aliases = versionAliases(source);
    const species = (key: string) => aliases.get(key) ?? key;
    const reachable = (map: string) => !UNREACHABLE_MAPS[game]?.test(map);
    const item = (key: string | undefined) =>
      key ? lookups.optionalItem(key, game) : null;

    const add = (
      row: Omit<StaticEncounterRow, "game" | "pokemonId" | "note"> & {
        species: string;
      },
    ) =>
      rows.push({
        ...row,
        game,
        pokemonId: lookups.pokemon(row.species, game),
        note: null,
      });

    // Script commands.
    for (const command of [
      "givemon",
      "giveegg",
      "setwildbattle",
      "seteventmon",
    ]) {
      for (const c of graph.commands(command)) {
        const [speciesArg, levelArg, itemArg] = c.args;
        const isStatic =
          command === "setwildbattle" || command === "seteventmon";
        if (
          isStatic &&
          graph
            .commandsIn(c.label)
            .some((k) => k.args[0] === "StartMarowakBattle")
        ) {
          notes.push(
            `Skipped the Ghost Marowak in ${game} (it can't be caught)`,
          );
          continue;
        }
        const options = speciesArg!.startsWith("SPECIES_")
          ? [speciesArg!]
          : graph.values(speciesArg!, c.label);
        if (options.length === 0)
          throw new Error(`${game}: can't tell what ${c.label} gives`);

        const ancestors = [...graph.ancestors(c.label)];
        const kind: StaticEncounterKind =
          command === "giveegg"
            ? "egg"
            : isStatic
              ? "static"
              : speciesArg === "PLAYER_STARTER_SPECIES"
                ? "starter"
                : ancestors.some((l) =>
                      graph.commandsIn(l).some((k) => k.name === "checkcoins"),
                    )
                  ? "prize"
                  : "gift";
        const level =
          command === "giveegg"
            ? // Same in every Gen 3 game; pokeruby has no constant for it.
              constant(constantsFor("emerald"), "EGG_HATCH_LEVEL")
            : Number(levelArg);
        for (const [map, events] of graph.maps(c.label)) {
          if (!reachable(map)) continue;
          for (const s of options)
            add({
              species: species(s),
              locationId: locationId(source, map),
              kind,
              level,
              // Six Kecleon on Route 120 share one script; gifts count once.
              count: isStatic ? events : 1,
              heldItemId: item(itemArg),
              tradeForId: null,
              nickname: null,
            });
        }
      }
    }

    // In-game trades: the script sets VAR_0x8008 to the trade's index.
    const trades = tradeTable(source);
    for (const c of graph.commands("setvar")) {
      if (c.args[0] !== "VAR_0x8008") continue;
      const isTrade = graph
        .commandsIn(c.label)
        .some((k) => k.args.some((a) => /GetInGameTradeSpeciesInfo$/.test(a)));
      if (!isTrade) continue;
      const index = /^\d+$/.test(c.args[1]!)
        ? Number(c.args[1])
        : constant(constantsFor(game), c.args[1]!);
      const trade = trades[index];
      if (!trade) throw new Error(`${game}: no in-game trade ${c.args[1]}`);
      for (const [map] of graph.maps(c.label)) {
        add({
          species: trade.species,
          locationId: locationId(source, map),
          kind: "trade",
          level: null,
          count: 1,
          heldItemId: item(trade.heldItem),
          tradeForId: lookups.pokemon(trade.requestedSpecies, game),
          nickname: titleCase(trade.nickname),
        });
      }
    }

    // Hoenn starters (chosen from Birch's bag; the script only calls a special).
    if (source.region === "hoenn") {
      const starterMaps = graph
        .commands("special")
        .filter((c) => /ChooseStarter$/.test(c.args[0]!))
        .flatMap((c) => [...graph.maps(c.label).keys()]);
      if (starterMaps.length !== 1)
        throw new Error(
          `${game}: expected one starter map, got ${starterMaps}`,
        );
      const { starters, level } = hoennStarters(source);
      for (const s of starters)
        add({
          species: s,
          locationId: locationId(source, starterMaps[0]!),
          kind: "starter",
          level,
          count: 1,
          heldItemId: null,
          tradeForId: null,
          nickname: null,
        });
    }

    // Roamers.
    const kantoStarters = rows
      .filter((r) => r.game === game && r.kind === "starter")
      .map((r) => r.species);
    for (const roamer of roamers(source, kantoStarters))
      rows.push({
        game,
        locationId: null,
        pokemonId: lookups.pokemon(roamer.species, game),
        kind: "roaming",
        level: roamer.level,
        count: 1,
        heldItemId: null,
        tradeForId: null,
        nickname: null,
        note: roamer.note,
        species: roamer.species,
      });
  }

  applyNotes(rows);
  return mergeDuplicates(rows);
}

/** pokeruby's constants/version.inc: `.set SPECIES_GROUDON_OR_KYOGRE, SPECIES_GROUDON` per version. */
function versionAliases(source: GameSource): Map<string, string> {
  const file = "constants/version.inc";
  const aliases = new Map<string, string>();
  if (!sourceExists(source.repo, file)) return aliases;
  const src = preprocess(
    readSource(source.repo, file)
      .replace(/^\s*\.(ifdef|ifndef|else)\b/gm, "#$1")
      .replace(/^\s*\.(endif|endc)\b/gm, "#endif"),
    source.defines,
  );
  for (const m of src.matchAll(/^\s*\.set\s+(\w+)\s*,\s*(\w+)/gm))
    aliases.set(m[1]!, m[2]!);
  return aliases;
}

type Trade = {
  species: string;
  requestedSpecies: string;
  heldItem: string;
  nickname: string;
};

/** The in-game trade table, indexed like the scripts' VAR_0x8008. */
function tradeTable(source: GameSource): Trade[] {
  const { game } = source;
  if (source.repo === "pokeruby") {
    // Positional initializers: nickname, species, IVs…, held item, …, requested species.
    const body = findArrayBody(
      readForGame(game, "src/trade.c"),
      "gIngameTrades",
    );
    return splitTopLevel(body)
      .filter((e) => e.trim().startsWith("{"))
      .map((entry) => {
        const values = parseList(entry);
        const speciesValues = values.filter((v) => v.startsWith("SPECIES_"));
        return {
          nickname: parseStringLiteral(values[0]!),
          species: speciesValues[0]!,
          requestedSpecies: speciesValues[speciesValues.length - 1]!,
          heldItem: values.find((v) => v.startsWith("ITEM_"))!,
        };
      });
  }
  const [file, array] =
    source.repo === "pokeemerald"
      ? ["src/data/trade.h", "sIngameTrades"]
      : ["src/data/ingame_trades.h", "sInGameTrades"];
  const entries = parseDesignatedEntries(
    findArrayBody(readForGame(game, file), array),
  );
  const trades: Trade[] = [];
  for (const { key, body } of entries) {
    const f = parseStructFields(body);
    trades[constant(constantsFor(game), key)] = {
      nickname: parseStringLiteral(f.nickname!),
      species: f.species!,
      requestedSpecies: f.requestedSpecies!,
      heldItem: f.heldItem!,
    };
  }
  return trades;
}

/** The function body following `signature` in C source. */
function functionBody(src: string, signature: RegExp): string {
  const m = signature.exec(src);
  if (!m) throw new Error(`Function ${signature} not found`);
  const open = src.indexOf("{", m.index + m[0].length);
  return src.slice(open + 1, findMatching(src, open));
}

/** sStarterMon(s) in starter_choose.c; the level is what CB2_GiveStarter passes to ScriptGiveMon. */
function hoennStarters(source: GameSource) {
  const src = readForGame(source.game, "src/starter_choose.c");
  const name = source.repo === "pokeruby" ? "sStarterMons" : "sStarterMon";
  const starters = parseList(`{${findArrayBody(src, name)}}`);
  const give = functionBody(
    stripComments(readForGame(source.game, "src/battle_setup.c")),
    /static void CB2_GiveStarter\(void\)\s*(?=\{)/,
  );
  const level = /ScriptGiveMon\(\s*\w+\s*,\s*(\d+)/.exec(give);
  if (!level) throw new Error(`${source.game}: starter level not found`);
  return { starters, level: Number(level[1]) };
}

/** roamer.c: who roams, at what level, and what decides it. */
function roamers(
  source: GameSource,
  kantoStarters: string[],
): { species: string; level: number; note: string }[] {
  const src = stripComments(readForGame(source.game, "src/roamer.c"));
  const body = functionBody(
    src,
    /void CreateInitialRoamerMon\([^)]*\)\s*(?=\{)/,
  );
  const levelMatch = /->level\s*=\s*(\d+)/.exec(body);
  if (!levelMatch) throw new Error(`${source.game}: roamer level not found`);
  const level = Number(levelMatch[1]);

  if (source.repo === "pokeruby") {
    // ROAMER_SPECIES is #defined per version in species.h.
    const species = /#define ROAMER_SPECIES (\w+)/.exec(
      readForGame(source.game, "include/constants/species.h"),
    )?.[1];
    if (!species) throw new Error(`${source.game}: ROAMER_SPECIES not found`);
    return [{ species, level, note: "Roams Hoenn after the Elite Four." }];
  }
  if (source.repo === "pokeemerald") {
    return [...new Set(body.match(/SPECIES_\w+/g))].map((species) => ({
      species,
      level,
      note: "Roams Hoenn after the Elite Four. Latios or Latias, depending on your answer on TV; the other is on Southern Island.",
    }));
  }
  // FireRed/LeafGreen: GetRoamerSpecies() switches on the starter.
  const macro = /#define GetRoamerSpecies\(\)[\s\S]*?\}\)/.exec(src)?.[0];
  if (!macro) throw new Error(`${source.game}: GetRoamerSpecies not found`);
  const byStarter = new Map(
    [...macro.matchAll(/case (SPECIES_\w+):\W*a = (SPECIES_\w+)/g)].map((m) => [
      m[1]!,
      m[2]!,
    ]),
  );
  const fallback = /default:\W*a = (SPECIES_\w+)/.exec(macro)?.[1];
  const others = kantoStarters.filter((s) => !byStarter.has(s));
  if (!fallback || others.length !== 1)
    throw new Error(`${source.game}: can't match roamers to starters`);
  byStarter.set(others[0]!, fallback);
  return [...byStarter].map(([starter, species]) => ({
    species,
    level,
    note: `Roams Kanto after the Network Machine on One Island is fixed, if your starter was ${titleCase(starter.replace(/^SPECIES_/, ""))}.`,
  }));
}

function applyNotes(rows: (StaticEncounterRow & { species: string })[]) {
  for (const { species, games, note } of NOTES) {
    const matches = rows.filter(
      (r) =>
        r.species === species &&
        r.kind !== "roaming" &&
        r.kind !== "trade" &&
        (!games || games.includes(r.game)),
    );
    if (matches.length === 0)
      throw new Error(`Note for ${species} matches no encounter`);
    for (const r of matches) r.note = note;
  }
}

/** One row per Pokémon, place and way; the same thing found several times adds to `count`. */
function mergeDuplicates(
  rows: (StaticEncounterRow & { species: string })[],
): StaticEncounterRow[] {
  const merged = new Map<string, StaticEncounterRow>();
  for (const { species: _, ...row } of rows) {
    const key = [
      row.game,
      row.locationId,
      row.pokemonId,
      row.kind,
      row.level,
      row.heldItemId,
      row.tradeForId,
    ].join("|");
    const existing = merged.get(key);
    if (existing) existing.count += row.count;
    else merged.set(key, { ...row });
  }
  return [...merged.values()];
}
