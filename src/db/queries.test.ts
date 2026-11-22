import Database from "better-sqlite3";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { GAME_INFO } from "@/lib/games";
import { REGION } from "@/lib/league";
import { areaFor } from "@/lib/town-map";

import {
  getEvolutionChain,
  getFoundGames,
  getLearnset,
  getLocations,
  getPokedexEntries,
  getPlace,
  getPokemonDetail,
  getStaticEncounters,
  getWildGames,
  listPlaces,
  listPokemon,
  type EvolutionNode,
} from "./queries";
import * as schema from "./schema";
import { GAMES } from "./schema";

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
    it("gives evolved Pokémon their earlier stages' egg moves", () => {
      const egg = (id: number, game: "emerald" | "firered" = "emerald") =>
        getLearnset(db, id, game).find((s) => s.method === "egg")?.data ?? [];
      // Charizard's come from Charmander, named as such.
      const charizard = egg(6);
      expect(charizard.map((m) => m.name)).toEqual(egg(4).map((m) => m.name));
      expect(charizard.every((m) => m.from === "Charmander")).toBe(true);
      expect(charizard.map((m) => m.name)).toContain("Dragon Dance");
      // A first stage's own egg moves aren't marked.
      expect(egg(4).every((m) => m.from === null)).toBe(true);
      // Pikachu's come from Pichu; each move only once.
      const pikachu = egg(25);
      expect(pikachu.length).toBeGreaterThan(0);
      expect(new Set(pikachu.map((m) => m.moveId)).size).toBe(pikachu.length);
      expect(pikachu.every((m) => m.from === "Pichu")).toBe(true);
      // Pokémon that don't breed have none.
      expect(egg(150)).toEqual([]);
    });

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

  describe("getEvolutionChain", () => {
    /** "Pichu > Pikachu (Use Thunderstone) > …" style outline of a tree. */
    const outline = (n: EvolutionNode): string[] =>
      n.evolutions
        .map(
          (e) =>
            `${n.name} > ${e.into.name} [${e.method}${e.level ? ` ${e.level}` : ""}${e.item ? ` ${e.item}` : ""}]`,
        )
        .concat(n.evolutions.flatMap((e) => outline(e.into)));

    it("starts from the first stage, whichever member is asked for", () => {
      const fromRaichu = getEvolutionChain(db, 26);
      expect(fromRaichu.name).toBe("Pichu");
      expect(outline(fromRaichu)).toEqual([
        "Pichu > Pikachu [friendship]",
        "Pikachu > Raichu [item ThunderStone]",
      ]);
      expect(getEvolutionChain(db, 172)).toEqual(fromRaichu);
    });

    it("keeps every branch", () => {
      expect(
        getEvolutionChain(db, 133).evolutions.map((e) => e.into.name),
      ).toEqual(["Vaporeon", "Jolteon", "Flareon", "Espeon", "Umbreon"]);
      expect(outline(getEvolutionChain(db, 292))).toEqual([
        "Nincada > Ninjask [level-ninjask 20]",
        "Nincada > Shedinja [level-shedinja 20]",
      ]);
    });

    it("is a single node for Pokémon that don't evolve", () => {
      expect(getEvolutionChain(db, 214)).toMatchObject({
        name: "Heracross",
        evolutions: [],
      });
    });
  });

  describe("getLocations", () => {
    it("groups encounters by place, per game", () => {
      expect(getLocations(db, 25, "firered")).toEqual([
        {
          locationId: expect.any(Number),
          name: "Viridian Forest",
          encounters: [{ method: "grass", minLevel: 3, maxLevel: 5, rate: 5 }],
        },
        {
          locationId: expect.any(Number),
          name: "Power Plant",
          encounters: [
            { method: "grass", minLevel: 22, maxLevel: 26, rate: 25 },
          ],
        },
      ]);
      expect(getLocations(db, 25, "emerald").map((p) => p.name)).toEqual([
        "Safari Zone South",
        "Safari Zone Southwest",
      ]);
    });

    it("lists methods in a fixed order and is empty when not wild", () => {
      const route102 = getLocations(db, 129, "emerald")[0];
      expect(route102?.encounters.map((e) => e.method)).toEqual([
        "old-rod",
        "good-rod",
      ]);
      expect(getLocations(db, 1, "emerald")).toEqual([]);
    });

    it("lists the games where a Pokémon is wild, in game order", () => {
      expect(getWildGames(db, 25)).toEqual([
        "ruby",
        "sapphire",
        "emerald",
        "firered",
        "leafgreen",
      ]);
      expect(getWildGames(db, 1)).toEqual([]);
    });
  });

  describe("getStaticEncounters", () => {
    it("lists gifts with their place, level and held item", () => {
      expect(getStaticEncounters(db, 351, "emerald")).toEqual([
        {
          id: expect.any(Number),
          kind: "gift",
          place: "Route 119 Weather Institute 2F",
          level: 25,
          count: 1,
          heldItem: "Mystic Water",
          tradeFor: null,
          nickname: null,
          note: expect.stringContaining("Weather Institute"),
        },
      ]);
    });

    it("lists starters first, and roamers without a place", () => {
      expect(
        getStaticEncounters(db, 1, "firered").map((e) => [e.kind, e.place]),
      ).toEqual([["starter", "Pallet Town Professor Oak's Lab"]]);
      const latios = getStaticEncounters(db, 381, "emerald");
      expect(latios.map((e) => [e.kind, e.place, e.level])).toEqual([
        ["static", "Southern Island Interior", 50],
        ["roaming", null, 40],
      ]);
    });

    it("gives trades the requested Pokémon and nickname", () => {
      const [trade] = getStaticEncounters(db, 122, "leafgreen");
      expect(trade).toMatchObject({
        kind: "trade",
        level: null,
        tradeFor: "Abra",
        nickname: "Mimien",
      });
    });

    it("counts Pokémon found several times in one place", () => {
      expect(
        getStaticEncounters(db, 101, "emerald").map((e) => [e.place, e.count]),
      ).toEqual([["Aqua Hideout B1F", 2]]);
    });

    it("lists the games where a Pokémon can be found at all", () => {
      expect(getFoundGames(db, 1)).toEqual(["firered", "leafgreen"]);
      expect(getFoundGames(db, 382)).toEqual(["sapphire", "emerald"]);
      expect(getFoundGames(db, 2)).toEqual([]);
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

  describe("places", () => {
    it("lists routes first, in natural order, then towns, then the rest", () => {
      const places = listPlaces(db, "emerald");
      const kinds = places.map((p) => p.kind);
      expect(kinds.indexOf("town")).toBeGreaterThan(kinds.lastIndexOf("route"));
      expect(kinds.indexOf("other")).toBeGreaterThan(kinds.lastIndexOf("town"));
      const routes = places
        .filter((p) => p.kind === "route")
        .map((p) => p.name);
      expect(routes.slice(0, 3)).toEqual([
        "Route 101",
        "Route 102",
        "Route 103",
      ]);
      expect(routes.indexOf("Route 110")).toBeGreaterThan(
        routes.indexOf("Route 109"),
      );
      // Emerald's unreachable Cave of Origin maps are left out.
      expect(places.some((p) => p.name.includes("Unused"))).toBe(false);
    });

    it("puts every place on the Town Map but the few with no spot", () => {
      const offMap = new Set<string>();
      for (const game of GAMES)
        for (const p of listPlaces(db, game))
          if (!areaFor(REGION[game], p.mapSection)) offMap.add(p.name);
      // Islands reached by ticket, and caves that move around.
      expect([...offMap].sort()).toEqual([
        "Birth Island Exterior",
        "Faraway Island Interior",
        "Marine Cave End",
        "Navel Rock Bottom",
        "Navel Rock Top",
        "Terra Cave End",
      ]);
    });

    it("counts one-time encounters too (the starters on Route 101)", () => {
      const r101 = listPlaces(db, "emerald").find(
        (p) => p.name === "Route 101",
      )!;
      expect(r101.pokemonIds).toEqual(
        expect.arrayContaining([252, 255, 258, 261, 263, 265]),
      );
    });

    it("adds up a species' slots per method", () => {
      const r101 = listPlaces(db, "emerald").find(
        (p) => p.name === "Route 101",
      )!;
      const place = getPlace(db, r101.id, "emerald")!;
      expect(
        place.methods.map((m) => [
          m.method,
          m.mons.map((x) => [x.name, x.minLevel, x.maxLevel, x.rate]),
        ]),
      ).toEqual([
        [
          "grass",
          [
            ["Poochyena", 2, 3, 45],
            ["Wurmple", 2, 3, 45],
            ["Zigzagoon", 2, 3, 10],
          ],
        ],
      ]);
      for (const m of place.methods)
        expect(m.mons.reduce((sum, x) => sum + x.rate, 0)).toBe(100);
    });

    it("lists the place's one-time encounters", () => {
      const r120 = listPlaces(db, "emerald").find(
        (p) => p.name === "Route 120",
      )!;
      expect(getPlace(db, r120.id, "emerald")!.oneTime).toEqual([
        expect.objectContaining({ name: "Kecleon", kind: "static", count: 6 }),
      ]);
      expect(getPlace(db, 99999, "emerald")).toBeNull();
    });
  });
});
