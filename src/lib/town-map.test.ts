import { describe, expect, it } from "vitest";

import { areaFor, areasAt, REGION_MAPS, TOWN_MAPS } from "./town-map";

describe("Town Map", () => {
  it("places areas where pret puts them (+1 for the picture's margin)", () => {
    expect(areaFor("hoenn", "MAPSEC_ROUTE_119")).toMatchObject({
      name: "Route 119",
      map: "hoenn",
      x: 12,
      y: 1,
      width: 1,
      height: 6,
    });
    expect(areaFor("kanto", "MAPSEC_PALLET_TOWN")).toMatchObject({
      map: "kanto",
      x: 5,
      y: 12,
    });
    // FR/LG's Sevii Islands are on their own maps.
    expect(areaFor("kanto", "MAPSEC_ONE_ISLAND")?.map).toBe("sevii-123");
  });

  it("has no spot for places off the map", () => {
    expect(areaFor("hoenn", "MAPSEC_NAVEL_ROCK")).toBeNull();
  });

  it("lists a cave before the route it's drawn on", () => {
    const granite = areaFor("hoenn", "MAPSEC_GRANITE_CAVE")!;
    const names = areasAt("hoenn", "hoenn", granite.x, granite.y).map(
      (a) => a.name,
    );
    expect(names[0]).toBe("Granite Cave");
    expect(names.length).toBeGreaterThan(1);
  });

  it("keeps every area inside its picture", () => {
    for (const maps of Object.values(REGION_MAPS))
      for (const { id } of maps) {
        const { cols, rows } = TOWN_MAPS[id];
        for (let col = 0; col < cols; col++)
          for (let row = 0; row < rows; row++)
            for (const a of areasAt(
              id === "hoenn" ? "hoenn" : "kanto",
              id,
              col,
              row,
            )) {
              expect(a.x + a.width).toBeLessThanOrEqual(cols);
              expect(a.y + a.height).toBeLessThanOrEqual(rows);
            }
      }
  });
});
