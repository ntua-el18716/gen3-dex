import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { leagueFor, REGION, STARTERS } from "@/lib/league";

import { getTrainerTeams, pickForStarter } from "./league-queries";
import { GAMES } from "./schema";
import * as schema from "./schema";

const DB_PATH = path.resolve("assets/db/gen3.db");

describe.skipIf(!existsSync(DB_PATH))("League", () => {
  const sqlite = new Database(DB_PATH, { readonly: true });
  const db = drizzle(sqlite, { schema });
  afterAll(() => sqlite.close());

  // The trainer lists are hand-written: every key must exist, with a team.
  it.each(GAMES)("has every listed trainer in %s", (game) => {
    const keys = leagueFor(game).flatMap((s) =>
      s.trainers.flatMap((t) => t.variants.flatMap((v) => v.keys)),
    );
    const teams = getTrainerTeams(db, game, keys);
    expect(keys.filter((k) => !teams.has(k))).toEqual([]);
    for (const t of teams.values()) expect(t.team.length).toBeGreaterThan(0);
  });

  it.each(GAMES)("finds the rival's team for every starter in %s", (game) => {
    for (const section of leagueFor(game))
      for (const trainer of section.trainers)
        for (const variant of trainer.variants) {
          if (variant.keys.length === 1) continue;
          const teams = [...getTrainerTeams(db, game, variant.keys).values()];
          const picked = STARTERS[REGION[game]].map(
            (s) => pickForStarter(teams, s)?.key,
          );
          // Each starter gets a different team.
          expect(new Set(picked).size, trainer.place).toBe(3);
          expect(picked).not.toContain(undefined);
        }
  });

  it("gives the rival the starter that beats yours", () => {
    const teams = [
      ...getTrainerTeams(db, "emerald", [
        "TRAINER_BRENDAN_ROUTE_103_TREECKO",
        "TRAINER_BRENDAN_ROUTE_103_TORCHIC",
        "TRAINER_BRENDAN_ROUTE_103_MUDKIP",
      ]).values(),
    ];
    // You pick Treecko → Brendan/May has Torchic.
    expect(pickForStarter(teams, 252)?.team[0]?.name).toBe("Torchic");
    // FireRed: you pick Charmander → your rival has Squirtle.
    const kanto = [
      ...getTrainerTeams(db, "firered", [
        "TRAINER_RIVAL_OAKS_LAB_BULBASAUR",
        "TRAINER_RIVAL_OAKS_LAB_CHARMANDER",
        "TRAINER_RIVAL_OAKS_LAB_SQUIRTLE",
      ]).values(),
    ];
    expect(pickForStarter(kanto, 4)?.team[0]?.name).toBe("Squirtle");
  });

  it("writes Tate & Liza the way people do", () => {
    const teams = getTrainerTeams(db, "ruby", ["TRAINER_TATE_AND_LIZA"]);
    expect(teams.get("TRAINER_TATE_AND_LIZA")?.name).toBe("Tate & Liza");
  });
});
