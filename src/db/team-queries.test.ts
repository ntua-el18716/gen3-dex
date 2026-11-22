import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { uniformSpread } from "@/lib/stats";
import { formatTeam, parseShowdown } from "@/lib/showdown";
import { newMember } from "@/lib/teams";

import * as schema from "./schema";
import {
  getNameIndex,
  getTeachableMoves,
  getTeamDetails,
  listHoldItems,
  listMoves,
  listNatures,
} from "./team-queries";

const DB_PATH = path.resolve("assets/db/gen3.db");

describe.skipIf(!existsSync(DB_PATH))("team queries", () => {
  const sqlite = new Database(DB_PATH, { readonly: true });
  const db = drizzle(sqlite, { schema });
  afterAll(() => sqlite.close());

  const moveId = (name: string) =>
    listMoves(db).find((m) => m.name === name)!.id;
  const itemId = (name: string) =>
    listHoldItems(db).find((i) => i.name === name)!.id;
  const natureId = (name: string) =>
    listNatures(db).find((n) => n.name === name)!.id;

  describe("getTeachableMoves", () => {
    const charizard = getTeachableMoves(db, 6, "emerald");
    const how = (name: string) => charizard.find((m) => m.name === name)?.how;

    it("lists each move once, by name, with how it's learned", () => {
      const names = charizard.map((m) => m.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(how("Wing Attack")).toBe("Lv 36");
      expect(how("Earthquake")).toBe("TM26");
      expect(how("Fly")).toBe("HM02");
    });

    it("prefers the Pokémon's own way and its lowest level", () => {
      // Charmander also learns Ember (Lv 7); Charizard starts with it.
      expect(how("Ember")).toBe("Lv 1");
    });

    it("includes egg moves, which only the first stage lists", () => {
      expect(how("Belly Drum")).toBe("As Charmander");
      expect(how("Dragon Dance")).toBe("As Charmander");
    });

    it("follows the game: FireRed's tutors aren't in Ruby", () => {
      const names = (game: "firered" | "ruby") =>
        getTeachableMoves(db, 6, game).map((m) => m.name);
      expect(names("firered")).toContain("Seismic Toss");
      expect(names("ruby")).not.toContain("Seismic Toss");
    });

    it("walks back through every stage, including branches", () => {
      // Shedinja keeps what Nincada knew.
      const shedinja = getTeachableMoves(db, 292, "emerald");
      expect(shedinja.some((m) => m.how === "As Nincada")).toBe(true);
    });
  });

  it("offers held items but no Balls, TMs or Key Items", () => {
    const names = listHoldItems(db).map((i) => i.name);
    expect(names).toContain("Leftovers");
    expect(names).toContain("Lum Berry");
    expect(names).not.toContain("Poké Ball");
    expect(names).not.toContain("Mach Bike");
    expect(names.some((n) => /^TM\d/.test(n))).toBe(false);
  });

  it("has the 25 natures", () => {
    expect(listNatures(db)).toHaveLength(25);
  });

  describe("getTeamDetails", () => {
    it("computes real stats for the level, nature, IVs and EVs", () => {
      // Salamence, Adamant, 31 IVs, 252 Atk / 252 Spe / 4 HP at Lv 100.
      const salamence = {
        ...newMember(373, 22, 100),
        natureId: natureId("Adamant"),
        itemId: itemId("Choice Band"),
        moveIds: [moveId("Earthquake"), moveId("Dragon Claw")],
        evs: { ...uniformSpread(0), attack: 252, speed: 252, hp: 4 },
      };
      const [d] = getTeamDetails(db, {
        game: "emerald",
        members: [salamence],
      });
      expect(d).toMatchObject({
        name: "Salamence",
        type1: "dragon",
        type2: "flying",
        abilityName: "Intimidate",
        itemName: "Choice Band",
        nature: { name: "Adamant" },
        stats: {
          hp: 332,
          attack: 405,
          defense: 196,
          spAttack: 230,
          spDefense: 196,
          speed: 299,
        },
      });
      expect(d!.moves.map((m) => m.name)).toEqual([
        "Earthquake",
        "Dragon Claw",
      ]);
      expect(d!.abilities.map((a) => a.name)).toEqual(["Intimidate"]);
    });

    it("uses the team's game for Deoxys' form", () => {
      const deoxys = [newMember(386, 46, 100)];
      const attack = (game: "firered" | "leafgreen") =>
        getTeamDetails(db, { game, members: deoxys })[0]!.baseStats.attack;
      expect(attack("firered")).toBe(180);
      expect(attack("leafgreen")).toBe(70);
    });

    it("keeps slots in place when a Pokémon is unknown", () => {
      const details = getTeamDetails(db, {
        game: "emerald",
        members: [newMember(9999, 1, 50), newMember(25, 9, 50)],
      });
      expect(details[0]).toBeNull();
      expect(details[1]!.name).toBe("Pikachu");
      expect(getTeamDetails(db, { game: "emerald", members: [] })).toEqual([]);
    });
  });

  describe("Showdown text with the real names", () => {
    const index = getNameIndex(db);

    it("finds every species, move, item and ability by its own name", () => {
      const all = (list: { id: number; name: string }[]) =>
        list.map((x) => x.name).join("\n\n");
      const { teams } = parseShowdown(all(index.species), index, 50);
      expect(teams[0]!.members).toHaveLength(6);
      // Each name, one team per species, matched back to the same id.
      for (const sp of index.species) {
        const { teams: t } = parseShowdown(sp.name, index, 50);
        expect(t[0]!.members[0]!.pokemonId).toBe(sp.id);
      }
      for (const mv of index.moves) {
        const { teams: t } = parseShowdown(`Mew\n- ${mv.name}`, index, 50);
        expect(t[0]!.members[0]!.moveIds).toEqual([mv.id]);
      }
    });

    it("round-trips a team", () => {
      const members = [
        {
          ...newMember(373, 22, 50),
          natureId: listNatures(db).find((n) => n.name === "Adamant")!.id,
          itemId: itemId("Choice Band"),
          moveIds: [moveId("Earthquake"), moveId("Dragon Claw")],
          evs: { ...uniformSpread(0), attack: 252, speed: 252, hp: 4 },
        },
        { ...newMember(65, 28, 100), moveIds: [moveId("ThunderPunch")] },
      ];
      const text = formatTeam({ name: "Test", members }, index);
      expect(parseShowdown(text, index, 50)).toEqual({
        teams: [{ name: "Test", members }],
        warnings: [],
      });
    });

    it("reads a Smogon Gen 3 set", () => {
      const text = `Metagross @ Choice Band
Ability: Clear Body
EVs: 252 HP / 252 Atk / 4 Def
Adamant Nature
- Meteor Mash
- Earthquake
- Explosion
- Rock Slide`;
      const { teams, warnings } = parseShowdown(text, index, 50);
      expect(warnings).toEqual([]);
      expect(teams[0]!.members[0]).toMatchObject({ pokemonId: 376, level: 50 });
    });
  });
});
