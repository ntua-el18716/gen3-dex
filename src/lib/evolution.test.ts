import { describe, expect, it } from "vitest";

import { evolutionLabel } from "./evolution";

describe("evolutionLabel", () => {
  it("describes each kind of method", () => {
    expect(evolutionLabel("level", 16, null)).toBe("Lv 16");
    expect(evolutionLabel("item", null, "ThunderStone")).toBe(
      "Use ThunderStone",
    );
    expect(evolutionLabel("trade-item", null, "King's Rock")).toBe(
      "Trade holding King's Rock",
    );
    expect(evolutionLabel("level-attack-gt-defense", 20, null)).toBe(
      "Lv 20, Attack > Defense",
    );
    expect(evolutionLabel("beauty", 170, null)).toBe(
      "Level up with Beauty ≥ 170",
    );
    expect(evolutionLabel("friendship-night", null, null)).toBe(
      "Level up with high friendship (night)",
    );
  });
});
