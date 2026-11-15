import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { calculateDamage, summarize } from "@/lib/damage";
import { frontierStats } from "@/lib/frontier";
import { uniformSpread } from "@/lib/stats";
import { newMember } from "@/lib/teams";

import {
  getSetCombatant,
  getTeamCombatants,
  getTypeChart,
} from "./damage-queries";
import { getSetDetails } from "./frontier-queries";
import * as schema from "./schema";
import { listHoldItems, listMoves, listNatures } from "./team-queries";

const DB_PATH = path.resolve("assets/db/gen3.db");

describe.skipIf(!existsSync(DB_PATH))("damage queries", () => {
  const sqlite = new Database(DB_PATH, { readonly: true });
  const db = drizzle(sqlite, { schema });
  afterAll(() => sqlite.close());
  const chart = getTypeChart(db);
  const moveId = (name: string) =>
    listMoves(db).find((m) => m.name === name)!.id;

  it("reads the type chart in the game's order", () => {
    expect(chart).toHaveLength(110);
    // pret's gTypeEffectiveness starts with Normal vs Rock and Steel.
    expect(chart.slice(0, 2)).toEqual([
      { attackingType: "normal", defendingType: "rock", multiplier: 0.5 },
      { attackingType: "normal", defendingType: "steel", multiplier: 0.5 },
    ]);
  });

  it("builds a Frontier set with the same stats the set cards show", () => {
    for (const id of [1, 90, 400, 800]) {
      const [detail] = getSetDetails(db, [id]);
      const c = getSetCombatant(db, id, 50, 21)!;
      expect(c.name).toBe(detail!.species);
      expect(c.battler.stats).toEqual(frontierStats(detail!, 50, 21));
      expect(c.moves.map((m) => m.name)).toEqual(detail!.moves);
      expect(c.battler.ivs).toEqual(uniformSpread(21));
    }
    expect(getSetCombatant(db, 99999, 50, 31)).toBeNull();
  });

  describe("a real matchup", () => {
    // Adamant Choice Band Salamence, 252 Atk / 252 Spe, Lv 50.
    const salamence = {
      ...newMember(373, 22, 50),
      natureId: listNatures(db).find((n) => n.name === "Adamant")!.id,
      itemId: listHoldItems(db).find((i) => i.name === "Choice Band")!.id,
      moveIds: [
        moveId("Earthquake"),
        moveId("Aerial Ace"),
        moveId("Flamethrower"),
      ],
      evs: { ...uniformSpread(0), attack: 252, speed: 252 },
    };
    const [mine] = getTeamCombatants(db, {
      game: "emerald",
      members: [salamence],
    });
    const hit = (target: number, moveName: string) => {
      const foe = getSetCombatant(db, target, 50, 31)!;
      const move = mine!.moves.find((m) => m.name === moveName)!;
      const result = calculateDamage(mine!.battler, foe.battler, move, chart, {
        frontier: true,
      });
      return { foe, result };
    };
    /** A Frontier set of this species. */
    const setOf = (pokemonId: number) =>
      (
        sqlite
          .prepare("select id from frontier_set where pokemon_id = ? limit 1")
          .get(pokemonId) as { id: number }
      ).id;

    it("has the team member's real stats and item", () => {
      expect(mine!.battler.stats.attack).toBe(205);
      expect(mine!.battler.item).toEqual({
        key: "ITEM_CHOICE_BAND",
        holdEffect: "HOLD_EFFECT_CHOICE_BAND",
      });
      expect(mine!.battler.ability).toBe("ABILITY_INTIMIDATE");
    });

    it("Earthquake: 4× on Aggron, nothing on a Flying type or Levitate", () => {
      const aggron = hit(setOf(306), "Earthquake");
      expect(aggron.result).toMatchObject({ kind: "damage", effectiveness: 4 });
      if (aggron.result.kind === "damage")
        expect(
          summarize(aggron.result, aggron.foe.battler.stats.hp).koChance,
        ).toBe(1);
      expect(hit(setOf(227), "Earthquake").result).toEqual({
        kind: "immune",
        by: "type",
      });
      // Flygon is Ground/Dragon: only Levitate saves it.
      expect(hit(setOf(330), "Earthquake").result).toEqual({
        kind: "immune",
        by: "ability",
      });
    });

    it("Flamethrower into Flash Fire does nothing", () => {
      const ninetales = getSetCombatant(db, setOf(38), 50, 31)!;
      expect(ninetales.abilities.map((a) => a.key)).toEqual([
        "ABILITY_FLASH_FIRE",
      ]);
      expect(hit(setOf(38), "Flamethrower").result).toEqual({
        kind: "immune",
        by: "ability",
      });
    });
  });
});
