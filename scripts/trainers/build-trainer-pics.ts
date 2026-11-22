/**
 * Builds the trainer pictures the League page shows (gym leaders, Elite
 * Four, Champions, rivals) from each game's own pret repo.
 *
 *   npm run trainer-pics   (after npm run fetch-sources)
 *
 * A trainer's picture is found the way the game finds it: the trainer's
 * `.trainerPic` constant in its trainers file, the picture table entry for
 * that constant, and the graphics file the table's symbol is built from.
 * pokeruby has no picture table; its symbols follow the constant's name
 * (TRAINER_PIC_ROXANNE → gTrainerFrontPic_Roxanne). The PNGs are 16-colour
 * indexed with colour 0 transparent; they're stored at 4× like the Pokémon
 * sprites, so Android only ever scales them down (crisp).
 *
 * Writes assets/trainer-pics/<repo>/<file>.png and
 * src/generated/trainer-pics.ts ("game:TRAINER_KEY" → require()d image).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { GAMES, type Game } from "../../src/db/schema";
import { leagueFor } from "../../src/lib/league";
import { DATA_SRC_DIR, type SourceRepo } from "../import/sources";
import { SPRITE_SCALE, upscale } from "../sprites/build-sprites";

const OUT = path.resolve("assets/trainer-pics");
const GENERATED = path.resolve("src/generated/trainer-pics.ts");

type Repo = SourceRepo["name"];

const REPO: Record<Game, Repo> = {
  ruby: "pokeruby",
  sapphire: "pokeruby",
  emerald: "pokeemerald",
  firered: "pokefirered",
  leafgreen: "pokefirered",
};

const FILES: Record<
  Repo,
  { trainers: string; table?: string; graphics: string }
> = {
  pokeemerald: {
    trainers: "src/data/trainers.h",
    table: "src/data/trainer_graphics/front_pic_tables.h",
    graphics: "src/data/graphics/trainers.h",
  },
  pokefirered: {
    trainers: "src/data/trainers.h",
    table: "src/data/trainer_graphics/front_pic_tables.h",
    graphics: "src/data/graphics/trainers.h",
  },
  pokeruby: {
    trainers: "src/data/trainers_en.h",
    graphics: "src/data/graphics/trainers.h",
  },
};

/** Trainer constant → picture constant, from a trainers file. */
export function parseTrainerPics(source: string): Map<string, string> {
  const pics = new Map<string, string>();
  const blocks = source.split(/(?=\[TRAINER_\w+\]\s*=)/);
  for (const block of blocks) {
    const key = block.match(/^\[(TRAINER_\w+)\]\s*=/)?.[1];
    const pic = block.match(/\.trainerPic\s*=\s*(TRAINER_PIC_\w+)/)?.[1];
    if (key && pic) pics.set(key, pic);
  }
  return pics;
}

/** Picture constant → front picture symbol, from TRAINER_SPRITE(...) lines. */
export function parsePicTable(source: string): Map<string, string> {
  const symbols = new Map<string, string>();
  for (const m of source.matchAll(
    /TRAINER_SPRITE\(\s*(\w+)\s*,\s*(gTrainerFrontPic_\w+)/g,
  ))
    symbols.set(`TRAINER_PIC_${m[1]}`, m[2]!);
  return symbols;
}

/** TRAINER_PIC_ELITE_FOUR_SIDNEY → gTrainerFrontPic_EliteFourSidney. */
export function symbolFromConstant(pic: string): string {
  return (
    "gTrainerFrontPic_" +
    pic
      .replace(/^TRAINER_PIC_/, "")
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("")
  );
}

/**
 * Front picture symbol → the PNG it's built from ("graphics/trainers/
 * front_pics/leader_roxanne.png"); `.4bpp.lz` paths name the PNG next to
 * them.
 */
export function parseGraphicsPaths(source: string): Map<string, string> {
  const paths = new Map<string, string>();
  for (const m of source.matchAll(
    /(gTrainerFrontPic_\w+)\[\]\s*=\s*INC\w+\("([^"]+)"/g,
  ))
    paths.set(m[1]!, m[2]!.replace(/\.4bpp(\.lz)?$/, ".png"));
  return paths;
}

function main() {
  const read = (repo: Repo, file: string) =>
    readFileSync(path.resolve(DATA_SRC_DIR, repo, file), "utf8");
  const lookups = new Map<
    Repo,
    {
      pics: Map<string, string>;
      table?: Map<string, string>;
      paths: Map<string, string>;
    }
  >();
  for (const repo of new Set(Object.values(REPO))) {
    const files = FILES[repo];
    lookups.set(repo, {
      pics: parseTrainerPics(read(repo, files.trainers)),
      table: files.table ? parsePicTable(read(repo, files.table)) : undefined,
      paths: parseGraphicsPaths(read(repo, files.graphics)),
    });
  }

  rmSync(OUT, { recursive: true, force: true });
  const written = new Set<string>();
  const entries: string[] = [];
  for (const game of GAMES) {
    const repo = REPO[game];
    const { pics, table, paths } = lookups.get(repo)!;
    const keys = new Set(
      leagueFor(game).flatMap((s) =>
        s.trainers.flatMap((t) => t.variants.flatMap((v) => v.keys)),
      ),
    );
    for (const key of [...keys].sort()) {
      const pic = pics.get(key);
      if (!pic) throw new Error(`${game}: no trainerPic for ${key}`);
      const symbol = table ? table.get(pic) : symbolFromConstant(pic);
      const source = symbol && paths.get(symbol);
      if (!source) throw new Error(`${game}: no picture file for ${pic}`);
      const file = `${repo}/${path.basename(source)}`;
      if (!written.has(file)) {
        mkdirSync(path.join(OUT, repo), { recursive: true });
        const png = readFileSync(path.resolve(DATA_SRC_DIR, repo, source));
        writeFileSync(path.join(OUT, file), upscale(png, SPRITE_SCALE));
        written.add(file);
      }
      entries.push(
        `  "${game}:${key}": require("../../assets/trainer-pics/${file}"),`,
      );
    }
  }
  writeFileSync(
    GENERATED,
    `// Generated by scripts/trainers/build-trainer-pics.ts. Do not edit.\n` +
      `import type { ImageSourcePropType } from "react-native";\n\n` +
      `/** League trainers' pictures, by "game:TRAINER_KEY". */\n` +
      `export const trainerPics: Record<string, ImageSourcePropType> = {\n` +
      `${entries.join("\n")}\n};\n`,
  );
  console.log(
    `Wrote ${written.size} pictures for ${entries.length} trainer keys.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename)
) {
  main();
}
