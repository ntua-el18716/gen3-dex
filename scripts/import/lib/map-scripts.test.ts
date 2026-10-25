import { describe, expect, it } from "vitest";

import { parseScriptFile, ScriptGraph } from "./map-scripts";

const NONE = new Set<string>();

describe("parseScriptFile", () => {
  it("reads labels and commands, dropping comments and inactive branches", () => {
    const src = [
      "Map_EventScript_Gift::",
      "\tlock @ comment",
      "\t.ifdef FIRERED",
      "\tgivemon SPECIES_ABRA, 9",
      "\t.else",
      "\tgivemon SPECIES_ABRA, 7",
      "\t.endif",
      "\tend",
    ].join("\n");
    const [label] = parseScriptFile(src, "MAP_A", new Set(["FIRERED"]));
    expect(label).toMatchObject({ name: "Map_EventScript_Gift", map: "MAP_A" });
    expect(label!.commands.map((c) => [c.name, c.args])).toEqual([
      ["lock", []],
      ["givemon", ["SPECIES_ABRA", "9"]],
      ["end", []],
    ]);
  });
});

describe("ScriptGraph", () => {
  const shared = [
    "EventScript_Battle::",
    "\tsetwildbattle SPECIES_KECLEON, 30",
    "\tend",
    "EventScript_Unused::",
    "\tgiveegg SPECIES_PICHU",
    "\tend",
  ].join("\n");
  const map = [
    "Route_EventScript_A::",
    "\tsetvar VAR_TEMP_1, SPECIES_HITMONLEE",
    "\tgoto Route_EventScript_Give",
    "Route_EventScript_B::",
    "\tsetvar VAR_TEMP_1, SPECIES_HITMONCHAN",
    "\tgoto Route_EventScript_Give",
    "Route_EventScript_Give::",
    "\tgivemon VAR_TEMP_1, 25",
    "\tend",
    "Route_EventScript_Kecleon::",
    "\tgoto EventScript_Battle",
    "Route_Text_Hello:",
    '\t.string "Hello$"',
    "Route_EventScript_AfterText::",
    "\tend",
  ].join("\n");
  const prizes = [
    "Prize_EventScript_Choose::",
    "\tswitch VAR_TEMP_1",
    "\tcase SPECIES_ABRA, Prize_EventScript_GiveAbra",
    "\tcase SPECIES_PINSIR, Prize_EventScript_GivePinsir",
    "\tend",
    "Prize_EventScript_SetAbra::",
    "\tsetvar VAR_TEMP_1, SPECIES_ABRA",
    "\tgoto Prize_EventScript_Choose",
    "Prize_EventScript_GiveAbra::",
    "\tgivemon VAR_TEMP_1, 9",
    "\tend",
    "Prize_EventScript_GivePinsir::",
    "\tgivemon VAR_TEMP_1, 18",
    "\tend",
  ].join("\n");
  const graph = new ScriptGraph(
    [
      { src: shared, map: null },
      { src: map, map: "MAP_ROUTE" },
      { src: prizes, map: "MAP_PRIZES" },
    ],
    new Map([
      ["MAP_ROUTE", ["Route_EventScript_Kecleon", "Route_EventScript_Kecleon"]],
      ["MAP_OTHER", ["EventScript_Battle"]],
    ]),
    NONE,
  );

  it("traces shared scripts to the maps whose events reach them", () => {
    expect([...graph.maps("EventScript_Battle")]).toEqual([
      ["MAP_OTHER", 1],
      ["MAP_ROUTE", 2],
    ]);
    expect(graph.maps("EventScript_Unused").size).toBe(0);
  });

  it("resolves a variable from the setvars that lead to the command", () => {
    expect(graph.values("VAR_TEMP_1", "Route_EventScript_Give")).toEqual([
      "SPECIES_HITMONLEE",
      "SPECIES_HITMONCHAN",
    ]);
  });

  it("prefers the switch case that jumps to the command", () => {
    expect(graph.values("VAR_TEMP_1", "Prize_EventScript_GivePinsir")).toEqual([
      "SPECIES_PINSIR",
    ]);
  });

  it("doesn't fall through from text into the next label", () => {
    expect(graph.ancestors("Route_EventScript_AfterText")).toEqual(
      new Set(["Route_EventScript_AfterText"]),
    );
  });
});
