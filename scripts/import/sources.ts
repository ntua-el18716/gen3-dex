/**
 * The pret decompilation repos the importer reads from.
 *
 * Commits are pinned so the generated database is reproducible: the same
 * commits always produce the same gen3.db. To update, change a `commit`,
 * re-run `npm run import`, and review the diff in the validation report.
 */
export type SourceRepo = {
  name: "pokeemerald" | "pokefirered" | "pokeruby";
  url: string;
  commit: string;
  /** Sparse-checkout patterns: we only need data and constants, not the whole game. */
  paths: string[];
};

export const SOURCES: SourceRepo[] = [
  {
    name: "pokeemerald",
    url: "https://github.com/pret/pokeemerald.git",
    commit: "731ad5bfd6e6f265508d0efcca0ba42f9dcf5881",
    paths: [
      "/src/data/",
      "/include/constants/",
      "/src/battle_main.c",
      "/src/battle_tower.c",
      // Battle Frontier rules (trainer selection, Frontier Brains, facilities).
      "/src/frontier_util.c",
      "/src/battle_dome.c",
      "/src/battle_factory.c",
      "/src/battle_palace.c",
      "/src/battle_arena.c",
      "/src/battle_pike.c",
      "/src/battle_pyramid.c",
      // Map scripts and map ids: gifts, static encounters, Frontier scripts.
      "/data/maps/*/scripts.inc",
      "/data/maps/*/map.json",
      "/data/scripts/",
      "/src/starter_choose.c",
      "/src/battle_setup.c",
      "/src/roamer.c",
      "/src/pokemon.c",
      "/graphics/pokemon/",
      // Trainer pictures, for the League page (npm run trainer-pics).
      "/graphics/trainers/front_pics/",
      // The Town Map (npm run town-map).
      "/graphics/pokenav/region_map/map.*",
    ],
  },
  {
    name: "pokefirered",
    url: "https://github.com/pret/pokefirered.git",
    commit: "ce6406d8c2eaf46d543c8a2606de0c3cb1951982",
    paths: [
      "/src/data/",
      "/include/constants/",
      "/src/pokemon.c",
      "/data/maps/*/scripts.inc",
      "/data/maps/*/map.json",
      "/data/scripts/",
      "/src/roamer.c",
      "/graphics/pokemon/",
      "/graphics/trainers/front_pics/",
      "/graphics/trainers/palettes/",
      "/graphics/region_map/region_map.*",
      "/graphics/region_map/kanto.bin",
      "/graphics/region_map/sevii_*.bin",
    ],
  },
  {
    name: "pokeruby",
    url: "https://github.com/pret/pokeruby.git",
    commit: "5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f",
    paths: [
      "/src/data/",
      "/include/constants/",
      "/data/maps/*/scripts.inc",
      "/data/maps/*/map.json",
      "/data/scripts/",
      // Version-specific aliases (SPECIES_GROUDON_OR_KYOGRE…) used by the scripts.
      "/constants/version.inc",
      "/src/starter_choose.c",
      "/src/battle_setup.c",
      "/src/roamer.c",
      // In-game trades.
      "/src/trade.c",
      "/graphics/trainers/*.png",
      "/graphics/trainers/*.pal",
      "/graphics/pokenav/region_map.*",
      "/graphics/pokenav/region_map_map.bin",
    ],
  },
];

/** Folder (gitignored) where the repos are checked out. */
export const DATA_SRC_DIR = "data-src";
