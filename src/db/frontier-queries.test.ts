import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { frontierStats } from "@/lib/frontier";

import {
  getFrontierBrain,
  getPossibleSets,
  getSetDetails,
  getTrainersForBattle,
} from "./frontier-queries";
import * as schema from "./schema";

const DB_PATH = path.resolve("assets/db/gen3.db");
const METAGROSS = 376;
const DRAGONITE = 149;

describe.skipIf(!existsSync(DB_PATH))("Battle Frontier queries", () => {
  const sqlite = new Database(DB_PATH, { readonly: true });
  const db = drizzle(sqlite, { schema });
  afterAll(() => sqlite.close());

  describe("getTrainersForBattle", () => {
    const ids = (battle: number) =>
      getTrainersForBattle(db, battle).trainers.map((t) => t.id);
    const span = (battle: number) => {
      const all = ids(battle);
      return [all[0], all.at(-1), all.length];
    };

    it("uses the challenge's range, and a harder one for its 7th battle", () => {
      expect(span(1)).toEqual([0, 99, 100]);
      expect(span(6)).toEqual([0, 99, 100]);
      expect(span(7)).toEqual([100, 119, 20]);
      expect(span(8)).toEqual([80, 119, 40]);
      expect(span(14)).toEqual([120, 139, 20]);
    });

    it("stays on the last range from the 8th challenge on", () => {
      expect(span(57)).toEqual([200, 299, 100]);
      expect(span(63)).toEqual([200, 299, 100]);
      expect(span(500)).toEqual([200, 299, 100]);
    });

    it("gives early trainers low IVs", () => {
      const { trainers } = getTrainersForBattle(db, 1);
      expect(new Set(trainers.map((t) => t.fixedIv))).toEqual(new Set([3]));
      expect(trainers[0]).toMatchObject({ name: "Brady", fixedIv: 3 });
    });
  });

  describe("getPossibleSets", () => {
    it("finds nothing when no trainer of that battle uses the species", () => {
      expect(
        getPossibleSets(db, {
          battle: 1,
          levelMode: "50",
          pokemonId: METAGROSS,
        }),
      ).toEqual([]);
    });

    it("lists late-streak Metagross sets with their possible IVs", () => {
      const sets = getPossibleSets(db, {
        battle: 60,
        levelMode: "50",
        pokemonId: METAGROSS,
      });
      expect(sets).toHaveLength(8);
      for (const set of sets) {
        expect(set.species).toBe("Metagross");
        expect(set.trainerIds.every((t) => t >= 200 && t <= 299)).toBe(true);
        expect([21, 31]).toEqual(expect.arrayContaining(set.possibleIvs));
      }
    });

    it("keeps high-tier sets out of Level 50", () => {
      const at = (levelMode: "50" | "open") =>
        getPossibleSets(db, { battle: 60, levelMode, pokemonId: DRAGONITE });
      expect(at("50").some((s) => s.openLevelOnly)).toBe(false);
      expect(at("open").some((s) => s.openLevelOnly)).toBe(true);
      expect(at("open").length).toBeGreaterThan(at("50").length);
    });

    it("narrows to one trainer, and only if they can appear", () => {
      const brady = getPossibleSets(db, {
        battle: 1,
        levelMode: "50",
        trainerId: 0,
      });
      expect(brady.length).toBeGreaterThan(0);
      expect(brady.every((s) => s.trainerIds.join() === "0")).toBe(true);
      expect(
        getPossibleSets(db, { battle: 60, levelMode: "50", trainerId: 0 }),
      ).toEqual([]);
    });
  });

  describe("getSetDetails + frontierStats", () => {
    it("reproduces a known Lv 50 stat line", () => {
      // FRONTIER_MON_METAGROSS_1 (Adamant, 170 Atk/Spe/SpD) with 31 IVs, as
      // in src/lib/stats.test.ts.
      const [set] = getSetDetails(db, [466]);
      expect(set).toMatchObject({ species: "Metagross", nature: "Adamant" });
      expect(frontierStats(set!, 50, 31)).toEqual({
        hp: 155,
        attack: 193,
        defense: 150,
        speed: 111,
        spAttack: 103,
        spDefense: 131,
      });
    });
  });

  describe("getFrontierBrain", () => {
    it("has Anabel's teams and schedule", () => {
      const anabel = getFrontierBrain(db, "tower")!;
      expect(anabel).toMatchObject({
        name: "Anabel",
        trainerClass: "Salon Maiden",
        silverAt: 35,
        goldAt: 70,
      });
      expect(anabel.silver.map((m) => m.species)).toEqual([
        "Alakazam",
        "Entei",
        "Snorlax",
      ]);
      expect(anabel.gold.map((m) => m.species)).toEqual([
        "Raikou",
        "Latios",
        "Snorlax",
      ]);
      expect(anabel.silver[0]).toMatchObject({
        item: "BrightPowder",
        nature: "Modest",
        fixedIv: 24,
        moves: ["ThunderPunch", "Fire Punch", "Ice Punch", "Disable"],
      });
    });

    it("has no fixed team for the Factory's Brain", () => {
      const noland = getFrontierBrain(db, "factory")!;
      expect(noland.name).toBe("Noland");
      expect(noland.silver).toEqual([]);
      expect(noland.gold).toEqual([]);
    });
  });
});
