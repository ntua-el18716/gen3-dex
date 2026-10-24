/**
 * Wild encounters per game, from each repo's wild_encounters.json.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { EncounterMethod, Game } from "../../../src/db/schema";
import { Lookups, notes } from "../context";
import { mapName } from "../lib/text";
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

export function importEncounters(lookups: Lookups) {
  const locations = new Map<
    string,
    { id: number; key: string; name: string; region: "hoenn" | "kanto" }
  >();
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

  return { locations: [...locations.values()], encounters };
}
