import { describe, expect, it } from "vitest";

import { comparePlaceNames, isUnusedMap, placeKind } from "./places";

describe("places", () => {
  it("sorts numbers naturally", () => {
    const names = [
      "Route 110",
      "Route 2",
      "Route 10",
      "Mt. Pyre 6F",
      "Mt. Pyre 2F",
    ];
    expect([...names].sort(comparePlaceNames)).toEqual([
      "Mt. Pyre 2F",
      "Mt. Pyre 6F",
      "Route 2",
      "Route 10",
      "Route 110",
    ]);
  });

  it("tells routes, towns and other places apart", () => {
    expect(placeKind("MAP_ROUTE119", "Route 119")).toBe("route");
    expect(placeKind("MAP_UNDERWATER_ROUTE126", "Underwater Route 126")).toBe(
      "other",
    );
    expect(placeKind("MAP_LILYCOVE_CITY", "Lilycove City")).toBe("town");
    expect(placeKind("MAP_FIVE_ISLAND", "Five Island")).toBe("town");
    expect(
      placeKind(
        "MAP_FIVE_ISLAND_LOST_CAVE_ROOM1",
        "Five Island Lost Cave Room 1",
      ),
    ).toBe("other");
    expect(placeKind("MAP_GRANITE_CAVE_1F", "Granite Cave 1F")).toBe("other");
  });

  it("knows Emerald's unreachable maps", () => {
    expect(isUnusedMap("MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP1")).toBe(
      true,
    );
    expect(isUnusedMap("MAP_CAVE_OF_ORIGIN_1F")).toBe(false);
  });
});
