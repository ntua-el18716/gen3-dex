import { describe, expect, it } from "vitest";

import { STATS } from "@/db/schema";

import {
  DISPLAY_STATS,
  natureTone,
  STAT_NAME,
  STAT_SHORT,
} from "./stat-labels";

describe("stat labels", () => {
  it("covers every stat once, with Speed last", () => {
    expect([...DISPLAY_STATS].sort()).toEqual([...STATS].sort());
    expect(DISPLAY_STATS.at(-1)).toBe("speed");
    for (const stat of STATS) {
      expect(STAT_SHORT[stat]).toBeTruthy();
      expect(STAT_NAME[stat]).toBeTruthy();
    }
  });

  it("says what a nature does to a stat", () => {
    const adamant = {
      increasedStat: "attack",
      decreasedStat: "spAttack",
    } as const;
    expect(natureTone("attack", adamant)).toBe("raised");
    expect(natureTone("spAttack", adamant)).toBe("lowered");
    expect(natureTone("speed", adamant)).toBeNull();
    // Hardy raises and lowers Attack; some places store that as null.
    const hardy = { increasedStat: "attack", decreasedStat: "attack" } as const;
    expect(natureTone("attack", hardy)).toBeNull();
    expect(
      natureTone("attack", { increasedStat: null, decreasedStat: null }),
    ).toBeNull();
  });
});
