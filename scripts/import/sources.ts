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
      "/src/pokemon.c",
      "/graphics/pokemon/",
    ],
  },
  {
    name: "pokefirered",
    url: "https://github.com/pret/pokefirered.git",
    commit: "ce6406d8c2eaf46d543c8a2606de0c3cb1951982",
    paths: ["/src/data/", "/include/constants/", "/src/pokemon.c"],
  },
  {
    name: "pokeruby",
    url: "https://github.com/pret/pokeruby.git",
    commit: "5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f",
    paths: ["/src/data/", "/include/constants/"],
  },
];

/** Folder (gitignored) where the repos are checked out. */
export const DATA_SRC_DIR = "data-src";
