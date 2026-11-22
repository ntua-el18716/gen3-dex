import { describe, expect, it } from "vitest";

import { readIndices } from "../sprites/build-sprites";
import { drawText, encodePng, layoutRects } from "./build-town-map";

describe("Town Map build", () => {
  it("finds each area's rectangle across rows and layers", () => {
    const layout = `
      [LAYER_MAP] = {
        {MAPSEC_NONE, MAPSEC_ROUTE_1, MAPSEC_NONE},
        {MAPSEC_TOWN, MAPSEC_ROUTE_1, MAPSEC_NONE},
      },
      [LAYER_DUNGEON] = {
        {MAPSEC_NONE, MAPSEC_NONE, MAPSEC_CAVE},
        {MAPSEC_NONE, MAPSEC_NONE, MAPSEC_NONE},
      }`;
    const rects = layoutRects(layout, 2);
    expect(rects.get("MAPSEC_ROUTE_1")).toEqual({
      x: 1,
      y: 0,
      width: 1,
      height: 2,
    });
    expect(rects.get("MAPSEC_TOWN")).toEqual({
      x: 0,
      y: 1,
      width: 1,
      height: 1,
    });
    // The dungeon layer's rows start again at the top.
    expect(rects.get("MAPSEC_CAVE")).toEqual({
      x: 2,
      y: 0,
      width: 1,
      height: 1,
    });
    expect(rects.has("MAPSEC_NONE")).toBe(false);
  });

  it("draws 4-bit tiles with flips and palettes", () => {
    // One 8×8 tile whose pixel value is its x (0–7), as an indexed PNG.
    const tile = encodePng({
      width: 8,
      height: 8,
      pixels: Uint8Array.from({ length: 64 }, (_, i) => i % 8),
      palette: Array.from({ length: 16 }, (_, i) => [i, i, i]),
    });
    const map = Buffer.alloc(4);
    map.writeUInt16LE(0x0000, 0); // tile 0, palette 0
    map.writeUInt16LE(0x1400, 2); // tile 0, h-flip, palette 1
    const picture = drawText(tile, map, [], 2, {
      x: 0,
      y: 0,
      cols: 2,
      rows: 1,
    });
    expect([...picture.pixels.slice(0, 16)]).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 23, 22, 21, 20, 19, 18, 17, 16,
    ]);
  });

  it("scales pictures up by whole pixels", () => {
    const png = encodePng(
      {
        width: 2,
        height: 1,
        pixels: Uint8Array.from([0, 1]),
        palette: [
          [0, 0, 0],
          [255, 255, 255],
        ],
      },
      2,
    );
    const { width, height, indices } = readIndices(png);
    expect([width, height]).toEqual([4, 2]);
    expect([...indices]).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });
});
