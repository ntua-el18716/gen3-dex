/**
 * Builds the Town Map the app shows, from the games' own graphics and data.
 *
 *   npm run town-map   (after npm run fetch-sources and npm run import)
 *
 * Pictures: the Town Map backgrounds are tiles plus a tilemap, as the GBA
 * draws them. Hoenn (identical in R/S and Emerald) is pokeemerald's
 * 8-bit affine background: one byte per tile on a 64×64 grid, palette
 * loaded at BG palette 7 (so pixel values start at 112). Kanto and the
 * three Sevii Island maps are pokefirered's 4-bit text backgrounds: 30×20
 * entries of tile (10 bits), h/v flip and palette (4 bits). Each picture is
 * cropped to the area the cursor can reach (Hoenn 28×15 tiles, Kanto 22×15)
 * plus a one-tile margin, so pret's area coordinates (+1) are tile
 * coordinates on the picture, and
 * stored at 4× (crisp on Android, like the sprites).
 *
 * Areas: region_map_sections.json gives each MAPSEC its rectangle in
 * tiles; for FireRed/LeafGreen the layout files say which of the four maps
 * it is on. Only areas some place in gen3.db belongs to are written, and
 * the build fails if one of those has no rectangle.
 *
 * Writes assets/town-map/*.png, src/generated/town-map.ts (areas) and
 * src/generated/town-map-images.ts (the pictures).
 */
import Database from "better-sqlite3";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { titleCase } from "../import/lib/text";
import { DATA_SRC_DIR } from "../import/sources";
import {
  chunk,
  parseJascPalette,
  readIndices,
  SPRITE_SCALE,
} from "../sprites/build-sprites";

const OUT = path.resolve("assets/town-map");
const GENERATED = path.resolve("src/generated/town-map.ts");
const GENERATED_IMAGES = path.resolve("src/generated/town-map-images.ts");
const DB = path.resolve("assets/db/gen3.db");

type Rgb = [number, number, number];
const TILE = 8;
/**
 * Tiles of real map kept around the cursor's area, so towns on its edge
 * (Rustboro, Cinnabar) aren't cut off. Area coordinates are shifted by it.
 */
const MARGIN = 1;

/** An indexed picture: one palette index per pixel. */
export type Picture = {
  width: number;
  height: number;
  pixels: Uint8Array;
  palette: Rgb[];
};

/** Tiles of an indexed PNG, 8×8 each, left to right then top to bottom. */
function tilesOf(png: Buffer) {
  const { width, indices } = readIndices(png);
  const perRow = width / TILE;
  return (tile: number, x: number, y: number) =>
    indices[
      (Math.floor(tile / perRow) * TILE + y) * width +
        (tile % perRow) * TILE +
        x
    ]!;
}

/**
 * Draws an 8-bit affine background (one tile byte per cell, `size`×`size`
 * cells) and crops it to `crop` (in tiles). Pixel values are offset by
 * `paletteBase` (the BG palette slot the game loads the palette into);
 * 0 stays the backdrop colour.
 */
export function drawAffine(
  tiles: Buffer,
  map: Buffer,
  palette: Rgb[],
  paletteBase: number,
  size: number,
  crop: { x: number; y: number; cols: number; rows: number },
): Picture {
  const pixel = tilesOf(tiles);
  const width = crop.cols * TILE;
  const height = crop.rows * TILE;
  const pixels = new Uint8Array(width * height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const cx = crop.x + Math.floor(px / TILE);
      const cy = crop.y + Math.floor(py / TILE);
      const value = pixel(map[cy * size + cx]!, px % TILE, py % TILE);
      pixels[py * width + px] = value === 0 ? 0 : value - paletteBase;
    }
  return { width, height, pixels, palette };
}

/**
 * Draws a 4-bit text background (16-bit entries: tile, h/v flip, palette;
 * `cols` entries per row) and crops it. Only the low 4 bits of a tile's
 * pixel count, as on the GBA; the colour is palette × 16 + that.
 * `patch` replaces cells first (cell → the cell whose entry to use).
 */
export function drawText(
  tiles: Buffer,
  map: Buffer,
  palette: Rgb[],
  cols: number,
  crop: { x: number; y: number; cols: number; rows: number },
  patch: (x: number, y: number) => [number, number] = (x, y) => [x, y],
): Picture {
  const pixel = tilesOf(tiles);
  const width = crop.cols * TILE;
  const height = crop.rows * TILE;
  const pixels = new Uint8Array(width * height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const [cx, cy] = patch(
        crop.x + Math.floor(px / TILE),
        crop.y + Math.floor(py / TILE),
      );
      const entry = map.readUInt16LE((cy * cols + cx) * 2);
      const tile = entry & 0x3ff;
      const tx = entry & 0x400 ? TILE - 1 - (px % TILE) : px % TILE;
      const ty = entry & 0x800 ? TILE - 1 - (py % TILE) : py % TILE;
      pixels[py * width + px] = (entry >> 12) * 16 + (pixel(tile, tx, ty) & 15);
    }
  return { width, height, pixels, palette };
}

/** An 8-bit indexed PNG of `picture`, each pixel scaled to a factor² block. */
export function encodePng(picture: Picture, factor = 1): Buffer {
  const width = picture.width * factor;
  const height = picture.height * factor;
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      raw[y * (width + 1) + 1 + x] =
        picture.pixels[
          Math.floor(y / factor) * picture.width + Math.floor(x / factor)
        ]!;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 3, 0, 0, 0], 8); // 8-bit, indexed
  const plte = Buffer.alloc(picture.palette.length * 3);
  picture.palette.forEach((c, i) => plte.set(c, i * 3));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", plte),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

type Rect = { x: number; y: number; width: number; height: number };

/**
 * Each MAPSEC's bounding rectangle in a region map layout file: rows of
 * `{MAPSEC_…, …}`, `height` rows per layer (FireRed/LeafGreen have a map
 * and a dungeon layer, Emerald one). FireRed/LeafGreen's sections JSON puts
 * every dungeon at 0,0, so the layout is where their spots really are.
 */
export function layoutRects(source: string, height: number): Map<string, Rect> {
  const rows = [
    ...source.matchAll(/\{\s*(MAPSEC_\w+(?:\s*,\s*MAPSEC_\w+)*)\s*\}/g),
  ].map((m) => m[1]!.split(/\s*,\s*/));
  const bounds = new Map<
    string,
    { x0: number; y0: number; x1: number; y1: number }
  >();
  rows.forEach((row, i) => {
    const y = i % height;
    row.forEach((section, x) => {
      if (section === "MAPSEC_NONE") return;
      const b = bounds.get(section);
      if (!b) bounds.set(section, { x0: x, y0: y, x1: x, y1: y });
      else
        bounds.set(section, {
          x0: Math.min(b.x0, x),
          y0: Math.min(b.y0, y),
          x1: Math.max(b.x1, x),
          y1: Math.max(b.y1, y),
        });
    });
  });
  return new Map(
    [...bounds].map(([section, b]) => [
      section,
      { x: b.x0, y: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 },
    ]),
  );
}

type JsonSection = {
  id: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

/**
 * Areas the game gives no spot of their own (they sit at 0,0, off every
 * layout), drawn at the area around them instead.
 */
const SPOT_OF: Record<string, string> = {
  // R/S name both villain hideouts one area; the hideout with Pokémon (Ruby's
  // Magma Hideout) is at Jagged Pass, Emerald's MAPSEC_MAGMA_HIDEOUT.
  "hoenn:MAPSEC_EVIL_TEAM_HIDEOUT": "MAPSEC_MAGMA_HIDEOUT",
  "kanto:MAPSEC_S_S_ANNE": "MAPSEC_VERMILION_CITY",
  "kanto:MAPSEC_SILPH_CO": "MAPSEC_SAFFRON_CITY",
  // The only Underground Path map with a Pokémon (a trade) is the north
  // entrance, on Route 5.
  "kanto:MAPSEC_UNDERGROUND_PATH": "MAPSEC_ROUTE_5",
  ...Object.fromEntries(
    ["DILFORD", "LIPTOO", "MONEAN", "RIXY", "SCUFIB", "VIAPOIS", "WEEPTH"].map(
      (c) => [`kanto:MAPSEC_${c}_CHAMBER`, "MAPSEC_TANOBY_RUINS"],
    ),
  ),
};

/** Names for areas drawn at another's spot that read better merged. */
const SPOT_NAME: Record<string, string> = Object.fromEntries(
  ["DILFORD", "LIPTOO", "MONEAN", "RIXY", "SCUFIB", "VIAPOIS", "WEEPTH"].map(
    (c) => [`kanto:MAPSEC_${c}_CHAMBER`, "TANOBY CHAMBERS"],
  ),
);

export type TownMapId =
  "hoenn" | "kanto" | "sevii-123" | "sevii-45" | "sevii-67";

const read = (repo: string, file: string) =>
  readFileSync(path.resolve(DATA_SRC_DIR, repo, file));

function main() {
  // --- Pictures ---------------------------------------------------------
  const pictures: Record<TownMapId, Picture> = {} as never;
  pictures.hoenn = drawAffine(
    read("pokeemerald", "graphics/pokenav/region_map/map.png"),
    read("pokeemerald", "graphics/pokenav/region_map/map.bin"),
    parseJascPalette(
      read("pokeemerald", "graphics/pokenav/region_map/map.pal").toString(),
    ),
    112,
    64,
    // MAPCURSOR_X_MIN 1, MAPCURSOR_Y_MIN 2; MAP_WIDTH 28, MAP_HEIGHT 15;
    // plus the margin.
    {
      x: 1 - MARGIN,
      y: 2 - MARGIN,
      cols: 28 + 2 * MARGIN,
      rows: 15 + 2 * MARGIN,
    },
  );
  const frlgTiles = read("pokefirered", "graphics/region_map/region_map.png");
  const frlgPalette = parseJascPalette(
    read("pokefirered", "graphics/region_map/region_map.pal").toString(),
  );
  const KANTO_FILES: Record<Exclude<TownMapId, "hoenn">, string> = {
    kanto: "kanto",
    "sevii-123": "sevii_123",
    "sevii-45": "sevii_45",
    "sevii-67": "sevii_67",
  };
  for (const [id, file] of Object.entries(KANTO_FILES)) {
    pictures[id as TownMapId] = drawText(
      frlgTiles,
      read("pokefirered", `graphics/region_map/${file}.bin`),
      frlgPalette,
      30,
      // The cursor's area starts 4 tiles in (sprite x = 8 × x + 36);
      // MAP_WIDTH 22, MAP_HEIGHT 15; plus the margin.
      {
        x: 4 - MARGIN,
        y: 4 - MARGIN,
        cols: 22 + 2 * MARGIN,
        rows: 15 + 2 * MARGIN,
      },
      // Cover the "switch map" button in the bottom right with the sea
      // from the row below the map.
      (x, y) => (x >= 24 && y >= 16 && y <= 18 ? [x, 19] : [x, y]),
    );
  }

  // --- Areas --------------------------------------------------------------
  const sections = (repo: string) =>
    new Map(
      (
        JSON.parse(
          read(repo, "src/data/region_map/region_map_sections.json").toString(),
        ) as { map_sections: JsonSection[] }
      ).map_sections.map((s) => [s.id, s]),
    );
  const hoennSections = sections("pokeemerald");
  const kantoSections = sections("pokefirered");
  // Where each area is: its tiles in the layout files, else the JSON's
  // rectangle (Emerald's caves aren't in its layout).
  const layouts: {
    region: "hoenn" | "kanto";
    map: TownMapId;
    rects: Map<string, Rect>;
  }[] = (
    [
      ["hoenn", "pokeemerald", "hoenn", "region_map_layout.h"],
      ["kanto", "pokefirered", "kanto", "region_map_layout_kanto.h"],
      ["kanto", "pokefirered", "sevii-123", "region_map_layout_sevii_123.h"],
      ["kanto", "pokefirered", "sevii-45", "region_map_layout_sevii_45.h"],
      ["kanto", "pokefirered", "sevii-67", "region_map_layout_sevii_67.h"],
    ] as const
  ).map(([region, repo, map, file]) => ({
    region,
    map,
    rects: layoutRects(
      read(repo, `src/data/region_map/${file}`).toString(),
      15,
    ),
  }));

  const db = new Database(DB, { readonly: true });
  const used = db
    .prepare(
      "select distinct region, map_section as section from location order by region, map_section",
    )
    .all() as { region: "hoenn" | "kanto"; section: string }[];
  db.close();

  const areas: string[] = [];
  const problems: string[] = [];
  for (const { region, section } of used) {
    const all = region === "hoenn" ? hoennSections : kantoSections;
    const own = all.get(section);
    const spot = SPOT_OF[`${region}:${section}`];
    const at = spot ?? section;
    const name =
      SPOT_NAME[`${region}:${section}`] ?? own?.name ?? all.get(at)?.name;
    const inLayout = layouts.find(
      (l) => l.region === region && l.rects.has(at),
    );
    const json = all.get(at);
    const placed = inLayout
      ? { map: inLayout.map, ...inLayout.rects.get(at)! }
      : region === "hoenn" && json?.x !== undefined
        ? {
            map: "hoenn" as TownMapId,
            x: json.x,
            y: json.y!,
            width: json.width!,
            height: json.height!,
          }
        : null;
    if (!placed || !name) {
      // E.g. Navel Rock and Birth Island, reached by ferry: not on the map.
      problems.push(`${region}:${section}`);
      continue;
    }
    areas.push(
      `  "${region}:${section}": { name: ${JSON.stringify(titleCase(name))}, map: "${placed.map}", x: ${placed.x + MARGIN}, y: ${placed.y + MARGIN}, width: ${placed.width}, height: ${placed.height} },`,
    );
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const images: string[] = [];
  const sizes: string[] = [];
  for (const [id, picture] of Object.entries(pictures)) {
    writeFileSync(
      path.join(OUT, `${id}.png`),
      encodePng(picture, SPRITE_SCALE),
    );
    images.push(`  "${id}": require("../../assets/town-map/${id}.png"),`);
    sizes.push(
      `  "${id}": { cols: ${picture.width / TILE}, rows: ${picture.height / TILE} },`,
    );
  }
  const header = `// Generated by scripts/town-map/build-town-map.ts. Do not edit.\n`;
  // The pictures are in their own file so the areas can be used where
  // images can't be loaded (tests).
  writeFileSync(
    GENERATED_IMAGES,
    header +
      `import type { ImageSourcePropType } from "react-native";\n\n` +
      `import type { TownMapId } from "./town-map";\n\n` +
      `/** The Town Map pictures, stored at ${SPRITE_SCALE}×. */\n` +
      `export const TOWN_MAP_IMAGES: Record<TownMapId, ImageSourcePropType> = {\n${images.join("\n")}\n};\n`,
  );
  writeFileSync(
    GENERATED,
    header +
      `\nexport type TownMapId = ${Object.keys(pictures)
        .map((k) => `"${k}"`)
        .join(" | ")};\n\n` +
      `/** Each Town Map picture's size in 8-pixel tiles. */\n` +
      `export const TOWN_MAPS: Record<TownMapId, { cols: number; rows: number }> = {\n${sizes.join("\n")}\n};\n\n` +
      `/**\n * Town Map areas by "region:MAPSEC_…" (location.map_section): which map\n * they're on and their rectangle in tiles. Areas with no spot on the map\n * (${problems.length}) are left out.\n */\n` +
      `export const TOWN_MAP_AREAS: Record<string, { name: string; map: TownMapId; x: number; y: number; width: number; height: number }> = {\n${areas.join("\n")}\n};\n`,
  );
  console.log(
    `Wrote ${images.length} maps and ${areas.length} areas; no spot on the map: ${problems.join(", ")}`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename)
) {
  main();
}
