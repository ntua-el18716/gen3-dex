import { describe, expect, it } from "vitest";

import { gameText, mapName, titleCase } from "./text";

describe("titleCase", () => {
  it.each([
    ["GENGAR", "Gengar"],
    ["MR. MIME", "Mr. Mime"],
    ["HO-OH", "Ho-Oh"],
    ["FARFETCH'D", "Farfetch'd"],
    ["NIDORAN♀", "Nidoran♀"],
    ["DOUBLE-EDGE", "Double-Edge"],
    ["KING'S ROCK", "King's Rock"],
    ["POKé BALL", "Poké Ball"],
    ["TM26", "TM26"],
    ["HP UP", "HP Up"],
    ["S.S. TICKET", "S.S. Ticket"],
    ["PKMN TRAINER", "Pokémon Trainer"],
    ["THUNDERPUNCH", "ThunderPunch"],
    ["BLACKGLASSES", "BlackGlasses"],
  ])("%s → %s", (input, expected) => {
    expect(titleCase(input)).toBe(expected);
  });
});

describe("gameText", () => {
  it("joins line breaks and softens the games' capitals", () => {
    expect(gameText("Not hit by GROUND\nattacks.")).toBe(
      "Not hit by Ground attacks.",
    );
    expect(gameText("Helps repel wild POKéMON.")).toBe(
      "Helps repel wild Pokémon.",
    );
    expect(gameText("it must be GENGAR's doing.")).toBe(
      "it must be Gengar's doing.",
    );
  });

  it("keeps HP and PP upper case", () => {
    expect(gameText("Restores HP and PP.")).toBe("Restores HP and PP.");
  });
});

describe("mapName", () => {
  it.each([
    ["MAP_ROUTE101", "Route 101"],
    ["MAP_GRANITE_CAVE_B1F", "Granite Cave B1F"],
    ["MAP_MT_PYRE_1F", "Mt. Pyre 1F"],
    ["MAP_SS_ANNE_EXTERIOR", "S.S. Anne Exterior"],
    ["MAP_POKEMON_TOWER_3F", "Pokémon Tower 3F"],
  ])("%s → %s", (input, expected) => {
    expect(mapName(input)).toBe(expected);
  });
});
