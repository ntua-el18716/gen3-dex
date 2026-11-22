/**
 * Wild encounters per game, from each repo's wild_encounters.json.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { EncounterMethod, Game } from "../../../src/db/schema";
import { Lookups, notes } from "../context";
import { mapName } from "../lib/text";
import { readMapSections } from "../lib/map-sections";
import { DATA_SRC_DIR } from "../sources";
import type { RepoName } from "../lib/source";

type JsonMon = { min_level: number; max_level: number; species: string };
type JsonArea = { encounter_rate: number; mons: JsonMon[] };
type JsonEncounter = {
  map?: string;
  base_label: string;
  land_mons?: JsonArea;
  water_mons?: JsonArea;
  rock_smash_mons?: JsonArea;
  fishing_mons?: JsonArea;
};
type JsonField = {
  type: string;
  encounter_rates: number[];
  groups?: Record<string, number[]>;
};
type JsonGroup = {
  label: string;
  for_maps: boolean;
  fields?: JsonField[];
  encounters: JsonEncounter[];
};

const REPOS: {
  repo: RepoName;
  region: "hoenn" | "kanto";
  gameOf: (label: string) => Game;
}[] = [
  { repo: "pokeemerald", region: "hoenn", gameOf: () => "emerald" },
  {
    repo: "pokeruby",
    region: "hoenn",
    gameOf: (l) => (l.endsWith("_Sapphire") ? "sapphire" : "ruby"),
  },
  {
    repo: "pokefirered",
    region: "kanto",
    gameOf: (l) => (l.endsWith("_LeafGreen") ? "leafgreen" : "firered"),
  },
];

const FIELD_METHOD: Record<string, EncounterMethod> = {
  land_mons: "grass",
  water_mons: "surf",
  rock_smash_mons: "rock-smash",
};

const ROD_METHOD: Record<string, EncounterMethod> = {
  old_rod: "old-rod",
  good_rod: "good-rod",
  super_rod: "super-rod",
};

export type Location = {
  id: number;
  key: string;
  name: string;
  region: "hoenn" | "kanto";
  /** Its Town Map area (pret MAPSEC_…), filled in by `addMapSections`. */
  mapSection?: string | null;
};

export function importEncounters(lookups: Lookups) {
  const locations = new Map<string, Location>();
  const encounters: {
    game: Game;
    locationId: number;
    method: EncounterMethod;
    slot: number;
    pokemonId: number;
    minLevel: number;
    maxLevel: number;
    rate: number;
  }[] = [];
  const seen = new Set<string>();

  for (const { repo, region, gameOf } of REPOS) {
    const json = JSON.parse(
      readFileSync(
        path.resolve(DATA_SRC_DIR, repo, "src/data/wild_encounters.json"),
        "utf8",
      ),
    ) as {
      wild_encounter_groups: JsonGroup[];
    };
    for (const group of json.wild_encounter_groups) {
      if (!group.for_maps) {
        notes.push(
          `Skipped non-map encounter group ${group.label} in ${repo} (Battle Frontier facilities)`,
        );
        continue;
      }
      const fields = new Map((group.fields ?? []).map((f) => [f.type, f]));

      for (const enc of group.encounters) {
        if (!enc.map) continue;
        const game = gameOf(enc.base_label);
        const locationKey = `${region}:${enc.map}`;
        let location = locations.get(locationKey);
        if (!location) {
          location = {
            id: locations.size + 1,
            key: enc.map,
            name: mapName(enc.map),
            region,
          };
          locations.set(locationKey, location);
        }

        const addSlots = (
          method: EncounterMethod,
          area: JsonArea,
          rates: number[],
          slotIndices: number[],
        ) => {
          const id = `${game}|${location!.id}|${method}`;
          if (seen.has(id)) {
            notes.push(
              `Duplicate ${method} table for ${enc.map} in ${game} (${enc.base_label}); kept the first`,
            );
            return;
          }
          seen.add(id);
          slotIndices.forEach((slotIndex, i) => {
            const mon = area.mons[slotIndex];
            if (!mon)
              throw new Error(`Missing slot ${slotIndex} in ${enc.base_label}`);
            encounters.push({
              game,
              locationId: location!.id,
              method,
              slot: i,
              pokemonId: lookups.pokemon(mon.species, game),
              minLevel: mon.min_level,
              maxLevel: mon.max_level,
              rate: rates[slotIndex]!,
            });
          });
        };

        for (const [fieldName, method] of Object.entries(FIELD_METHOD)) {
          const area = enc[fieldName as keyof JsonEncounter] as
            JsonArea | undefined;
          const field = fields.get(fieldName);
          if (area && field)
            addSlots(
              method,
              area,
              field.encounter_rates,
              area.mons.map((_, i) => i),
            );
        }

        const fishing = enc.fishing_mons;
        const fishingField = fields.get("fishing_mons");
        if (fishing && fishingField?.groups) {
          for (const [rod, indices] of Object.entries(fishingField.groups)) {
            const method = ROD_METHOD[rod];
            if (!method) throw new Error(`Unknown fishing group ${rod}`);
            // Rod rates are listed per rod: e.g. old rod 70/30, good rod 60/20/20.
            addSlots(method, fishing, fishingField.encounter_rates, indices);
          }
        }
      }
    }
  }

  // Feebas isn't in the tables: R/S/E pick it in code (see parseFeebas).
  for (const { repo, region, games } of FEEBAS_REPOS) {
    const feebas = parseFeebas(
      readFileSync(
        path.resolve(DATA_SRC_DIR, repo, "src/wild_encounter.c"),
        "utf8",
      ),
    );
    const location = locations.get(`${region}:${feebas.map}`);
    if (!location) throw new Error(`Feebas: no place ${feebas.map}`);
    for (const game of games)
      encounters.push({
        game,
        locationId: location.id,
        method: "feebas-spots",
        slot: 0,
        pokemonId: lookups.pokemon(feebas.species, game),
        minLevel: feebas.minLevel,
        maxLevel: feebas.maxLevel,
        rate: feebas.chance,
      });
  }

  return { locations: [...locations.values()], encounters };
}

const FEEBAS_REPOS: { repo: RepoName; region: "hoenn"; games: Game[] }[] = [
  { repo: "pokeemerald", region: "hoenn", games: ["emerald"] },
  { repo: "pokeruby", region: "hoenn", games: ["ruby", "sapphire"] },
];

/**
 * R/S/E's Feebas rule from wild_encounter.c: `CheckFeebas` runs when you
 * fish on its map (MAP_ROUTE119) on one of six spots, and lets through
 * `Random() % 100 > N` → not Feebas, so the chance is N + 1 percent; the
 * Pokémon is a `{min, max, SPECIES_…}` WildPokemon (sWildFeebas in
 * pokeemerald, gWildFeebasRoute119Data in pokeruby). Fails loudly if the
 * code no longer looks like that.
 */
export function parseFeebas(source: string) {
  const mon =
    /(?:sWildFeebas|gWildFeebasRoute119Data)\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(SPECIES_\w+)\s*\}/.exec(
      source,
    );
  const check = /bool8 CheckFeebas\(void\)\s*\{([\s\S]*?)\n\}/.exec(
    source,
  )?.[1];
  const map = check && /MAP_GROUP\((MAP_\w+)\)/.exec(check)?.[1];
  const chance =
    check &&
    /Random\(\) % 100 > (\d+)\)(?:\s*\/\/[^\n]*)?\s*return FALSE/.exec(
      check,
    )?.[1];
  if (!mon || !map || !chance)
    throw new Error("wild_encounter.c: Feebas rule not found");
  return {
    species: mon[3]!,
    minLevel: Number(mon[1]),
    maxLevel: Number(mon[2]),
    map,
    chance: Number(chance) + 1,
  };
}

/**
 * Gives each place its Town Map area from the map's map.json (Hoenn:
 * Emerald's maps, then Ruby's for maps only R/S have). Fails if a place
 * has none, so a new map can't silently drop off the Town Map.
 */
export function addMapSections(locations: Location[]) {
  const sections = {
    hoenn: [
      readMapSections(path.resolve(DATA_SRC_DIR, "pokeemerald")),
      readMapSections(path.resolve(DATA_SRC_DIR, "pokeruby")),
    ],
    kanto: [readMapSections(path.resolve(DATA_SRC_DIR, "pokefirered"))],
  };
  const missing: string[] = [];
  for (const l of locations) {
    l.mapSection =
      sections[l.region].map((s) => s.get(l.key)).find(Boolean) ?? null;
    if (!l.mapSection) missing.push(`${l.region}:${l.key}`);
  }
  if (missing.length)
    throw new Error(`No Town Map area for ${missing.join(", ")}`);
}
