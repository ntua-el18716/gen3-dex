import Database from "better-sqlite3";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { GAME_INFO } from "@/lib/games";

import {
  getLearnset,
  getPokedexEntries,
  getPokemonDetail,
  listPokemon,
} from "./queries";
import * as schema from "./schema";

const DB_PATH = path.resolve("assets/db/gen3.db");

describe.skipIf(!existsSync(DB_PATH))("queries", () => {
  const sqlite = new Database(DB_PATH, { readonly: true });
  const db = drizzle(sqlite, { schema });
  afterAll(() => sqlite.close());

  describe("listPokemon", () => {
    it("returns all 386 in National Dex order", () => {
      const list = listPokemon(db);
      expect(list).toHaveLength(386);
      expect(list.map((p) => p.id)).toEqual(
        Array.from({ length: 386 }, (_, i) => i + 1),
      );
    });

    it("has Gen 3 types (no Fairy)", () => {
      const list = listPokemon(db);
      expect(list[0]).toEqual({
        id: 1,
        name: "Bulbasaur",
        type1: "grass",
        type2: "poison",
      });
      // Clefairy is pure Normal and Marill pure Water before Gen 6.
      expect(list[34]).toMatchObject({ type1: "normal", type2: null });
      expect(list[182]).toMatchObject({ type1: "water", type2: null });
    });
  });

  describe("getPokemonDetail", () => {
    it("returns null for an unknown Pokémon", () => {
      expect(getPokemonDetail(db, 387, "emerald")).toBeNull();
    });

    it("lists abilities in slot order", () => {
      const gengar = getPokemonDetail(db, 94, "emerald")!;
      // Levitate only: Cursed Body is a Gen 5 ability.
      expect(gengar.abilities.map((a) => a.name)).toEqual(["Levitate"]);
      const ninetales = getPokemonDetail(db, 38, "emerald")!;
      expect(ninetales.abilities.map((a) => a.name)).toEqual(["Flash Fire"]);
      const gyarados = getPokemonDetail(db, 130, "emerald")!;
      expect(gyarados.abilities.map((a) => a.name)).toEqual(["Intimidate"]);
    });

    it("uses the game's Deoxys form", () => {
      expect(getPokemonDetail(db, 386, "ruby")).toMatchObject({
        formName: null,
        baseStats: { attack: 150, defense: 50, speed: 150 },
      });
      expect(getPokemonDetail(db, 386, "emerald")).toMatchObject({
        formName: "Speed Forme",
        baseStats: { speed: 180 },
      });
      expect(getPokemonDetail(db, 386, "leafgreen")).toMatchObject({
        formName: "Defense Forme",
        baseStats: { defense: 160 },
      });
    });

    it("gives held items of the game's version group", () => {
      const names = (game: schema.Game) =>
        getPokemonDetail(db, 25, game)!.heldItems;
      expect(names("emerald")).toEqual([
        { rarity: "common", name: "Oran Berry" },
        { rarity: "rare", name: "Light Ball" },
      ]);
      expect(names("firered")).toEqual([]);
    });
  });

  describe("getPokedexEntries", () => {
    it("merges games with the same text, in game order", () => {
      const entries = getPokedexEntries(db, 1);
      expect(entries.map((e) => e.games)).toEqual([
        ["ruby", "sapphire", "emerald"],
        ["firered"],
        ["leafgreen"],
      ]);
    });
  });

  describe("getLearnset", () => {
    it("groups moves by method in the games' order", () => {
      const sections = getLearnset(db, 1, "emerald");
      expect(sections.map((s) => [s.method, s.data.length])).toEqual([
        ["level", 11],
        ["machine", 19],
        ["tutor", 12],
        ["egg", 8],
      ]);
      const [level, machines] = sections.map((s) => s.data);
      expect(level?.slice(0, 3).map((m) => [m.level, m.name])).toEqual([
        [1, "Tackle"],
        [4, "Growl"],
        [7, "Leech Seed"],
      ]);
      const tms = machines?.map((m) => m.machineNumber) ?? [];
      expect(tms).toEqual([...tms].sort((a, b) => a! - b!));
      expect(machines?.[0]?.machine).toMatch(/^TM\d\d$/);
    });

    it("differs per game (FR/LG Deoxys)", () => {
      const moves = (game: schema.Game) =>
        getLearnset(db, 386, game)
          .find((s) => s.method === "level")!
          .data.map((m) => m.name);
      expect(moves("firered")).not.toEqual(moves("leafgreen"));
    });
  });

  it("GAME_INFO matches the game table", () => {
    const rows = db
      .select()
      .from(schema.game)
      .orderBy(asc(schema.game.sortOrder))
      .all();
    expect(rows.map((g) => [g.id, g.name, g.versionGroup])).toEqual(
      Object.entries(GAME_INFO).map(([id, g]) => [id, g.name, g.versionGroup]),
    );
  });
});
