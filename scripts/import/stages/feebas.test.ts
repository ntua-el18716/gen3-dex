import { describe, expect, it } from "vitest";

import { parseFeebas } from "./encounters";

const EMERALD = `
static const struct WildPokemon sWildFeebas = {20, 25, SPECIES_FEEBAS};

static bool8 CheckFeebas(void)
{
    if (gSaveBlock1Ptr->location.mapGroup == MAP_GROUP(MAP_ROUTE119)
     && gSaveBlock1Ptr->location.mapNum == MAP_NUM(MAP_ROUTE119))
    {
        // 50% chance of encountering Feebas (assuming this is a Feebas spot)
        if (Random() % 100 > 49)
            return FALSE;
        return TRUE;
    }
    else
        return FALSE;
}
`;

describe("parseFeebas", () => {
  it("reads the Pokémon, its map and the chance per bite", () => {
    expect(parseFeebas(EMERALD)).toEqual({
      species: "SPECIES_FEEBAS",
      minLevel: 20,
      maxLevel: 25,
      map: "MAP_ROUTE119",
      chance: 50,
    });
  });

  it("reads pokeruby's name for the Pokémon", () => {
    const ruby = EMERALD.replace(
      "static const struct WildPokemon sWildFeebas",
      "const struct WildPokemon gWildFeebasRoute119Data",
    );
    expect(parseFeebas(ruby).species).toBe("SPECIES_FEEBAS");
  });

  it("allows a comment after the check (pokeruby)", () => {
    const ruby = EMERALD.replace(
      "if (Random() % 100 > 49)",
      "if (Random() % 100 > 49) //50% chance of encountering Feebas",
    );
    expect(parseFeebas(ruby).chance).toBe(50);
  });

  it("fails if the rule changed shape", () => {
    expect(() =>
      parseFeebas(EMERALD.replace("% 100 > 49", "% 4 == 0")),
    ).toThrow(/Feebas/);
  });
});
