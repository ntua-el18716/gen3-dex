/** Game rules the importer re-implements from pret's C code. */
import { describe, expect, it } from "vitest";

import { frontierEvs } from "./frontier";
import { defaultMoveset } from "./trainers";

describe("defaultMoveset (GiveBoxMonInitialMoveset)", () => {
  const gengar: [number, string][] = [
    [1, "HYPNOSIS"],
    [1, "LICK"],
    [1, "SPITE"],
    [8, "SPITE"],
    [13, "MEAN_LOOK"],
    [16, "CURSE"],
    [21, "NIGHT_SHADE"],
  ];

  it("takes moves up to the level", () => {
    expect(defaultMoveset(gengar, 1)).toEqual(["HYPNOSIS", "LICK", "SPITE"]);
  });

  it("skips moves already known", () => {
    expect(defaultMoveset(gengar, 8)).toEqual(["HYPNOSIS", "LICK", "SPITE"]);
  });

  it("forgets the oldest move once four are known", () => {
    expect(defaultMoveset(gengar, 13)).toEqual([
      "HYPNOSIS",
      "LICK",
      "SPITE",
      "MEAN_LOOK",
    ]);
    expect(defaultMoveset(gengar, 21)).toEqual([
      "SPITE",
      "MEAN_LOOK",
      "CURSE",
      "NIGHT_SHADE",
    ]);
  });
});

describe("frontierEvs (CreateMonWithEVSpread)", () => {
  it("splits 510 between two stats", () => {
    expect(frontierEvs(0b000011)).toMatchObject({
      evHp: 255,
      evAttack: 255,
      evSpeed: 0,
    });
  });

  it("splits 510 between three stats", () => {
    expect(frontierEvs(0b101010)).toMatchObject({
      evAttack: 170,
      evSpeed: 170,
      evSpDefense: 170,
      evHp: 0,
    });
  });

  it("wraps a single-stat spread to 254, like the game's u8 field", () => {
    expect(frontierEvs(0b000001).evHp).toBe(254);
  });
});
