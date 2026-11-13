import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { DATA_SRC_DIR } from "../import/sources";
import {
  cropToFirstFrame,
  differs,
  parseJascPalette,
  readIndices,
  upscale,
  withPalette,
} from "./build-sprites";

const GRAPHICS = path.resolve(DATA_SRC_DIR, "pokeemerald/graphics/pokemon");
const FRLG = path.resolve(DATA_SRC_DIR, "pokefirered/graphics/pokemon");
const hasSources = (() => {
  try {
    readFileSync(path.join(GRAPHICS, "gengar/front.png"));
    return true;
  } catch {
    return false;
  }
})();

/** Reads the chunks of a PNG into type → data. */
function chunks(png: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    out.set(type, out.has(type) ? Buffer.concat([out.get(type)!, data]) : data);
    offset += 12 + length;
  }
  return out;
}

describe("parseJascPalette", () => {
  it("reads colours", () => {
    expect(
      parseJascPalette("JASC-PAL\r\n0100\r\n2\r\n1 2 3\r\n255 0 128\r\n"),
    ).toEqual([
      [1, 2, 3],
      [255, 0, 128],
    ]);
  });
});

// skipIf still runs this callback to collect the tests, so files are read
// inside the tests, never at describe level.
describe.skipIf(!hasSources)("sprite conversion", () => {
  it("swaps the palette and keeps pixels and transparency", () => {
    const front = readFileSync(path.join(GRAPHICS, "gengar/front.png"));
    const shiny = parseJascPalette(
      readFileSync(path.join(GRAPHICS, "gengar/shiny.pal"), "utf8"),
    );
    const out = chunks(withPalette(front, shiny));
    const original = chunks(front);
    expect(out.get("PLTE")!.subarray(0, 6)).toEqual(
      Buffer.from(shiny.slice(0, 2).flat()),
    );
    expect(out.get("IDAT")).toEqual(original.get("IDAT"));
    expect(out.get("tRNS")).toEqual(original.get("tRNS"));
  });

  it("crops multi-frame strips to the first 64×64 frame", () => {
    const strip = readFileSync(path.join(GRAPHICS, "blaziken/front.png"));
    expect(strip.readUInt32BE(20)).toBe(256);
    const cropped = cropToFirstFrame(strip);
    expect(cropped.readUInt32BE(20)).toBe(64);
    // 64 rows of (1 filter byte + 32 bytes of 4-bit pixels).
    expect(inflateSync(chunks(cropped).get("IDAT")!).length).toBe(64 * 33);
  });

  it("upscales so each pixel becomes a block, keeping palette and transparency", () => {
    const front = readFileSync(path.join(GRAPHICS, "gengar/front.png"));
    const big = upscale(front, 4);
    const src = readIndices(front);
    const out = readIndices(big);
    expect([out.width, out.height]).toEqual([256, 256]);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++)
        expect(out.indices[y * 256 + x]).toBe(
          src.indices[Math.floor(y / 4) * 64 + Math.floor(x / 4)],
        );
    expect(chunks(big).get("PLTE")).toEqual(chunks(front).get("PLTE"));
    expect(chunks(big).get("tRNS")).toEqual(chunks(front).get("tRNS"));
  });

  it("spots sprites FireRed/LeafGreen redrew", () => {
    const load = (root: string, name: string) => ({
      png: readFileSync(path.join(root, name, "front.png")),
      palette: readFileSync(path.join(root, name, "normal.pal"), "utf8"),
    });
    expect(differs(load(GRAPHICS, "charizard"), load(FRLG, "charizard"))).toBe(
      true,
    );
    expect(differs(load(GRAPHICS, "blaziken"), load(FRLG, "blaziken"))).toBe(
      false,
    );
  });
});
