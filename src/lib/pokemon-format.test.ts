import { describe, expect, it } from "vitest";

import { gamesLabel } from "./games";
import {
  formatHeight,
  formatWeight,
  genderLabel,
  titleCase,
} from "./pokemon-format";

describe("Pokédex formatting", () => {
  it("converts the games' units", () => {
    expect(formatHeight(7)).toBe("0.7 m"); // Bulbasaur
    expect(formatWeight(69)).toBe("6.9 kg");
  });

  it("uses the real Gen 3 gender odds (ratio / 256)", () => {
    expect(genderLabel(31)).toBe("87.9% ♂ · 12.1% ♀"); // starters
    expect(genderLabel(127)).toBe("50.4% ♂ · 49.6% ♀");
    expect(genderLabel(0)).toBe("Always male");
    expect(genderLabel(254)).toBe("Always female");
    expect(genderLabel(255)).toBe("Genderless");
  });

  it("title-cases kebab-case values", () => {
    expect(titleCase("water-1")).toBe("Water 1");
    expect(titleCase("medium-slow")).toBe("Medium Slow");
  });

  it("labels groups of games", () => {
    expect(gamesLabel(["ruby", "sapphire", "emerald"])).toBe("R/S/E");
    expect(gamesLabel(["firered"])).toBe("FR");
  });
});
