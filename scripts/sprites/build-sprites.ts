/**
 * Builds the Pokémon sprites from pokeemerald's graphics: front and back,
 * normal and shiny, for all 386 Pokémon.
 *
 *   npm run sprites   (after npm run import, which fetches the sources)
 *
 * pret stores each sprite as a 16-colour indexed PNG plus two JASC palettes
 * (normal.pal, shiny.pal). A shiny Pokémon is the same pixels with the
 * shiny palette, so we only rewrite the PNG's PLTE chunk; the pixel data and
 * transparency (tRNS) are copied unchanged.
 *
 * Also writes src/generated/sprites.ts, a map from National Dex number to
 * require()d images, because React Native can only bundle images that are
 * required with a literal path.
 */
import Database from "better-sqlite3";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

import { DATA_SRC_DIR } from "../import/sources";

const GRAPHICS = path.resolve(DATA_SRC_DIR, "pokeemerald/graphics/pokemon");
/** FireRed/LeafGreen redrew many sprites (mostly Kanto); used in FR/LG. */
const FRLG_GRAPHICS = path.resolve(
  DATA_SRC_DIR,
  "pokefirered/graphics/pokemon",
);
const OUT = path.resolve("assets/sprites");
const GENERATED = path.resolve("src/generated/sprites.ts");

/** Species whose sprites live in a form subfolder. */
const FORM_FOLDERS: Record<string, { images: string; palettes: string }> = {
  unown: { images: "unown/a", palettes: "unown" },
  castform: { images: "castform/normal", palettes: "castform/normal" },
};

const VARIANTS = [
  { dir: "front", image: "front.png", palette: "normal.pal" },
  { dir: "front-shiny", image: "front.png", palette: "shiny.pal" },
  { dir: "back", image: "back.png", palette: "normal.pal" },
  { dir: "back-shiny", image: "back.png", palette: "shiny.pal" },
] as const;

// --- PNG chunk handling -----------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Returns `png` with its PLTE chunk replaced by `colors`. */
export function withPalette(
  png: Buffer,
  colors: [number, number, number][],
): Buffer {
  const parts: Buffer[] = [png.subarray(0, 8)];
  let offset = 8;
  let replaced = false;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (type === "PLTE") {
      // Keep the same number of entries as the original palette.
      const count = length / 3;
      const data = Buffer.alloc(length);
      for (let i = 0; i < count; i++) {
        const [r, g, b] = colors[i] ?? [0, 0, 0];
        data.set([r, g, b], i * 3);
      }
      parts.push(chunk("PLTE", data));
      replaced = true;
    } else {
      parts.push(png.subarray(offset, end));
    }
    offset = end;
  }
  if (!replaced) throw new Error("PNG has no palette");
  return Buffer.concat(parts);
}

const FRAME_SIZE = 64;

/**
 * A few source images are vertical strips of frames (Blaziken has four,
 * Deoxys's back sprite two); keep only the first 64×64 frame. PNG row
 * filters only look at earlier rows, so the first rows can be kept as-is.
 */
export function cropToFirstFrame(png: Buffer): Buffer {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24]!;
  if (height <= FRAME_SIZE) return png;

  const chunks: { type: string; data: Buffer }[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    chunks.push({
      type: png.toString("ascii", offset + 4, offset + 8),
      data: png.subarray(offset + 8, offset + 8 + length),
    });
    offset += 12 + length;
  }
  const rowBytes = 1 + Math.ceil((width * bitDepth) / 8); // filter byte + pixels (indexed: 1 channel)
  const pixels = inflateSync(
    Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)),
  );
  const cropped = deflateSync(pixels.subarray(0, rowBytes * FRAME_SIZE), {
    level: 9,
  });

  const out: Buffer[] = [png.subarray(0, 8)];
  let wroteData = false;
  for (const c of chunks) {
    if (c.type === "IHDR") {
      const header = Buffer.from(c.data);
      header.writeUInt32BE(FRAME_SIZE, 4);
      out.push(chunk("IHDR", header));
    } else if (c.type === "IDAT") {
      if (!wroteData) out.push(chunk("IDAT", cropped));
      wroteData = true;
    } else {
      out.push(chunk(c.type, c.data));
    }
  }
  return Buffer.concat(out);
}

/** PNG scanline filters (spec §9), undone; bpp = bytes per pixel. */
function unfilter(data: Buffer, rowBytes: number, rows: number, bpp: number) {
  const out = Buffer.alloc(rowBytes * rows);
  for (let y = 0; y < rows; y++) {
    const filter = data[y * (rowBytes + 1)]!;
    const src = y * (rowBytes + 1) + 1;
    const dst = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const a = x >= bpp ? out[dst + x - bpp]! : 0;
      const b = y > 0 ? out[dst - rowBytes + x]! : 0;
      const c = x >= bpp && y > 0 ? out[dst - rowBytes + x - bpp]! : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[dst + x] = (data[src + x]! + pred) & 0xff;
    }
  }
  return out;
}

/** The palette index of every pixel of an indexed PNG, row by row. */
export function readIndices(png: Buffer) {
  const chunks: { type: string; data: Buffer }[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    chunks.push({
      type: png.toString("ascii", offset + 4, offset + 8),
      data: png.subarray(offset + 8, offset + 8 + length),
    });
    offset += 12 + length;
  }
  const header = chunks.find((c) => c.type === "IHDR")!.data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8]!;
  if (header[9] !== 3 || header[12] !== 0)
    throw new Error("Expected a non-interlaced indexed PNG");
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const raw = unfilter(
    inflateSync(
      Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)),
    ),
    rowBytes,
    height,
    1,
  );
  const perByte = 8 / bitDepth;
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const byte = raw[y * rowBytes + Math.floor(x / perByte)]!;
      const shift = 8 - bitDepth * ((x % perByte) + 1);
      indices[y * width + x] = (byte >> shift) & ((1 << bitDepth) - 1);
    }
  return { chunks, header, width, height, indices };
}

/**
 * Scales an indexed PNG up by an integer factor, each pixel becoming a
 * factor×factor block (output: 8-bit indexed, same palette and
 * transparency). Android smooths images it scales up, which blurs pixel
 * art; shipping big sprites means the app only ever scales them down.
 */
export function upscale(png: Buffer, factor: number): Buffer {
  const { chunks, header, width, height, indices } = readIndices(png);
  const outWidth = width * factor;
  const outHeight = height * factor;
  const scaled = Buffer.alloc((outWidth + 1) * outHeight);
  for (let y = 0; y < outHeight; y++) {
    const row = y * (outWidth + 1); // filter byte 0 (none), then pixels
    const src = Math.floor(y / factor) * width;
    for (let x = 0; x < outWidth; x++)
      scaled[row + 1 + x] = indices[src + Math.floor(x / factor)]!;
  }

  const newHeader = Buffer.from(header);
  newHeader.writeUInt32BE(outWidth, 0);
  newHeader.writeUInt32BE(outHeight, 4);
  newHeader[8] = 8;
  const out: Buffer[] = [png.subarray(0, 8)];
  let wroteData = false;
  for (const c of chunks) {
    if (c.type === "IHDR") out.push(chunk("IHDR", newHeader));
    else if (c.type === "IDAT") {
      if (!wroteData)
        out.push(chunk("IDAT", deflateSync(scaled, { level: 9 })));
      wroteData = true;
    } else out.push(chunk(c.type, c.data));
  }
  return Buffer.concat(out);
}

/** Sprites are stored at this multiple of the games' 64×64. */
export const SPRITE_SCALE = 4;

/** Parses a JASC-PAL file: "JASC-PAL", "0100", count, then "r g b" lines. */
export function parseJascPalette(text: string): [number, number, number][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines[0] !== "JASC-PAL") throw new Error("Not a JASC palette");
  const count = Number(lines[2]);
  return lines
    .slice(3, 3 + count)
    .map((l) => l.split(/\s+/).map(Number) as [number, number, number]);
}

/**
 * Whether FR/LG draw a species differently from Emerald (other pixels or
 * palette). Only those get FR/LG sprites, which keeps the app smaller.
 */
export function differs(
  emerald: { png: Buffer; palette: string },
  frlg: { png: Buffer; palette: string },
): boolean {
  const a = readIndices(cropToFirstFrame(emerald.png));
  const b = readIndices(cropToFirstFrame(frlg.png));
  if (a.width !== b.width || a.height !== b.height) return true;
  if (a.indices.some((v, i) => v !== b.indices[i])) return true;
  return (
    JSON.stringify(parseJascPalette(emerald.palette)) !==
    JSON.stringify(parseJascPalette(frlg.palette))
  );
}

const FRLG_VARIANTS = [
  { dir: "frlg-front", palette: "normal.pal" },
  { dir: "frlg-front-shiny", palette: "shiny.pal" },
] as const;

/** "frlg-front-shiny" → "frlgFrontShiny". */
const camel = (dir: string) =>
  dir.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

// --- Build ------------------------------------------------------------------

function main() {
  const db = new Database(path.resolve("assets/db/gen3.db"), {
    readonly: true,
  });
  const pokemon = db
    .prepare("SELECT id, key FROM pokemon ORDER BY id")
    .all() as { id: number; key: string }[];
  db.close();

  rmSync(OUT, { recursive: true, force: true });
  for (const v of [...VARIANTS, ...FRLG_VARIANTS])
    mkdirSync(path.join(OUT, v.dir), { recursive: true });
  const frlgIds: number[] = [];

  for (const { id, key } of pokemon) {
    const name = key.replace(/^SPECIES_/, "").toLowerCase();
    const folders = FORM_FOLDERS[name] ?? { images: name, palettes: name };
    for (const v of VARIANTS) {
      const png = readFileSync(path.join(GRAPHICS, folders.images, v.image));
      const palette = parseJascPalette(
        readFileSync(path.join(GRAPHICS, folders.palettes, v.palette), "utf8"),
      );
      writeFileSync(
        path.join(OUT, v.dir, `${id}.png`),
        upscale(withPalette(cropToFirstFrame(png), palette), SPRITE_SCALE),
      );
    }

    const frlg = path.join(FRLG_GRAPHICS, folders.images, "front.png");
    const frlgPalettes = path.join(FRLG_GRAPHICS, folders.palettes);
    const read = (dir: string, file: string) =>
      readFileSync(path.join(dir, file), "utf8");
    if (
      differs(
        {
          png: readFileSync(path.join(GRAPHICS, folders.images, "front.png")),
          palette: read(path.join(GRAPHICS, folders.palettes), "normal.pal"),
        },
        { png: readFileSync(frlg), palette: read(frlgPalettes, "normal.pal") },
      )
    ) {
      frlgIds.push(id);
      for (const v of FRLG_VARIANTS) {
        const palette = parseJascPalette(read(frlgPalettes, v.palette));
        writeFileSync(
          path.join(OUT, v.dir, `${id}.png`),
          upscale(
            withPalette(cropToFirstFrame(readFileSync(frlg)), palette),
            SPRITE_SCALE,
          ),
        );
      }
    }
  }

  const entries = (dir: string, ids = pokemon) =>
    ids
      .map(
        ({ id }) =>
          `  ${id}: require("../../assets/sprites/${dir}/${id}.png"),`,
      )
      .join("\n");
  const source = `// Generated by scripts/sprites/build-sprites.ts. Do not edit.
import type { ImageSourcePropType } from "react-native";

type SpriteMap = Record<number, ImageSourcePropType>;

${VARIANTS.map(
  (v) =>
    `export const ${camel(v.dir)}Sprites: SpriteMap = {\n${entries(v.dir)}\n};`,
).join("\n\n")}

/** FireRed/LeafGreen's own sprites, only where they differ from Emerald's. */
${FRLG_VARIANTS.map(
  (v) =>
    `export const ${camel(v.dir)}Sprites: Partial<SpriteMap> = {\n${entries(
      v.dir,
      pokemon.filter((p) => frlgIds.includes(p.id)),
    )}\n};`,
).join("\n\n")}
`;
  mkdirSync(path.dirname(GENERATED), { recursive: true });
  writeFileSync(GENERATED, source);
  console.log(
    `✓ Wrote ${pokemon.length * VARIANTS.length} sprites (+${frlgIds.length * 2} FR/LG) to ${path.relative(process.cwd(), OUT)}`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename)
)
  main();
