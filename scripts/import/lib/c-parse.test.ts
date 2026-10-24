import { describe, expect, it } from "vitest";

import {
  evalExpression,
  expandListMacros,
  parseConstants,
  parseDesignatedArray,
  parseList,
  parseListMacros,
  parseStringDeclarations,
  parseStringLiteral,
  parseStructFields,
  preprocess,
  splitTopLevel,
  stripComments,
} from "./c-parse";

describe("stripComments", () => {
  it("removes line and block comments but keeps strings", () => {
    const src = 'a = 1; // comment\nb = "not // a comment"; /* gone */ c = 2;';
    expect(stripComments(src)).toBe('a = 1; \nb = "not // a comment";  c = 2;');
  });
});

describe("splitTopLevel", () => {
  it("ignores separators inside brackets and strings", () => {
    expect(splitTopLevel('a, {b, c}, f(d, e), "x, y"')).toEqual([
      "a",
      "{b, c}",
      "f(d, e)",
      '"x, y"',
    ]);
  });
});

describe("parseConstants", () => {
  it("reads #defines, enums and expressions in any order", () => {
    const constants = parseConstants([
      "#define SPECIES_EGG (NUM_SPECIES + 1)\n#define NUM_SPECIES 411",
      "enum { TYPE_NORMAL, TYPE_FIGHTING, TYPE_MYSTERY = 9, TYPE_FIRE };",
      "#define F_BIT (1 << 3)",
    ]);
    expect(constants.get("SPECIES_EGG")).toBe(412);
    expect(constants.get("TYPE_FIGHTING")).toBe(1);
    expect(constants.get("TYPE_FIRE")).toBe(10);
    expect(constants.get("F_BIT")).toBe(8);
  });

  it("refuses to evaluate unknown identifiers", () => {
    expect(evalExpression("UNKNOWN + 1", new Map())).toBeUndefined();
  });
});

describe("designated initializers", () => {
  const src = `
    const struct SpeciesInfo gSpeciesInfo[] = {
      [SPECIES_GENGAR] = {
        .baseHP = 60,
        .types = { TYPE_GHOST, TYPE_POISON },
        .abilities = {ABILITY_LEVITATE, ABILITY_NONE},
      },
      [SPECIES_ONIX] = { .baseHP = 35 },
    };`;

  it("finds entries and fields", () => {
    const entries = parseDesignatedArray(src, "gSpeciesInfo");
    expect(entries.map((e) => e.key)).toEqual([
      "SPECIES_GENGAR",
      "SPECIES_ONIX",
    ]);
    const gengar = parseStructFields(entries[0]!.body);
    expect(gengar.baseHP).toBe("60");
    expect(parseList(gengar.types!)).toEqual(["TYPE_GHOST", "TYPE_POISON"]);
  });

  it("joins pokeruby's brace-less lists into the previous field", () => {
    const f = parseStructFields(
      "{ .level = 14, .moves = MOVE_TACKLE, MOVE_DEFENSE_CURL, MOVE_NONE, MOVE_NONE }",
    );
    expect(parseList(f.moves!)).toEqual([
      "MOVE_TACKLE",
      "MOVE_DEFENSE_CURL",
      "MOVE_NONE",
      "MOVE_NONE",
    ]);
  });
});

describe("strings", () => {
  it("joins adjacent literals and line breaks", () => {
    expect(
      parseStringLiteral(
        '_(\n "A strong electrical attack\\n"\n "that may paralyze the foe.")',
      ),
    ).toBe("A strong electrical attack\nthat may paralyze the foe.");
  });

  it("collects named string declarations", () => {
    const strings = parseStringDeclarations(
      'static const u8 sLevitateDescription[] = _("Not hit by GROUND attacks.");',
    );
    expect(strings.get("sLevitateDescription")).toBe(
      "Not hit by GROUND attacks.",
    );
  });
});

describe("preprocess", () => {
  const src = [
    "a",
    "#ifdef SAPPHIRE",
    "sapphire",
    "#else",
    "ruby",
    "#endif",
    "#if defined(FIRERED)",
    "fr",
    "#elif defined(LEAFGREEN)",
    "lg",
    "#endif",
  ].join("\n");

  it("keeps only the active branches", () => {
    const keep = (defines: string[]) =>
      preprocess(src, new Set(defines))
        .split("\n")
        .filter((l) => l !== "");
    expect(keep(["SAPPHIRE"])).toEqual(["a", "sapphire"]);
    expect(keep(["RUBY"])).toEqual(["a", "ruby"]);
    expect(keep(["LEAFGREEN"])).toEqual(["a", "ruby", "lg"]);
  });
});

describe("list macros", () => {
  it("expands nested and parameterised macros with ## pasting", () => {
    const macros = parseListMacros(
      [
        "#define SETS_A \\",
        "    MON_X_1, \\",
        "    MON_Y_1",
        "#define SETS_B(lastmon) SETS_A, MON_##lastmon##_2, -1",
      ].join("\n"),
    );
    expect(expandListMacros(["SETS_B(TYRANITAR)"], macros)).toEqual([
      "MON_X_1",
      "MON_Y_1",
      "MON_TYRANITAR_2",
      "-1",
    ]);
  });
});
