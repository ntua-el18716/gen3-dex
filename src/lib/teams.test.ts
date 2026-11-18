import { describe, expect, it } from "vitest";

import { uniformSpread } from "./stats";
import {
  defaultLevel,
  evTotal,
  newMember,
  newTeam,
  parseTeams,
  serializeTeams,
  teamIssues,
  TEAM_PURPOSES,
  withEv,
  withIv,
  withMove,
  withoutMove,
  withPurpose,
  withSpecies,
  type Team,
  type TeamMember,
} from "./teams";

const member = (pokemonId: number, over: Partial<TeamMember> = {}) => ({
  ...newMember(pokemonId, 1, 50),
  ...over,
});
const team = (over: Partial<Team> = {}): Team => ({
  ...newTeam("t1", 1000, "ruby", "tower"),
  ...over,
});

describe("teams", () => {
  it("offers every facility except the Factory (rentals only)", () => {
    expect(TEAM_PURPOSES).toEqual([
      "walkthrough",
      "tower",
      "dome",
      "palace",
      "arena",
      "pike",
      "pyramid",
    ]);
  });

  it("makes Frontier teams Emerald teams", () => {
    expect(newTeam("a", 0, "firered", "dome").game).toBe("emerald");
    expect(newTeam("a", 0, "firered").game).toBe("firered");
    const walkthrough = newTeam("a", 0, "leafgreen");
    expect(withPurpose(walkthrough, "pike").game).toBe("emerald");
    expect(withPurpose(walkthrough, "walkthrough").game).toBe("leafgreen");
  });

  it("starts new members at the level the purpose calls for", () => {
    expect(defaultLevel({ purpose: "tower", levelMode: "50" })).toBe(50);
    expect(defaultLevel({ purpose: "tower", levelMode: "open" })).toBe(100);
    expect(defaultLevel({ purpose: "walkthrough", levelMode: "open" })).toBe(
      50,
    );
  });

  it("clears moves and ability when the species changes", () => {
    const m = member(6, { moveIds: [1, 2], itemId: 9, natureId: 3 });
    expect(withSpecies(m, 6, 7)).toBe(m);
    expect(withSpecies(m, 9, 7)).toMatchObject({
      pokemonId: 9,
      abilityId: 7,
      moveIds: [],
      itemId: 9,
      natureId: 3,
    });
  });

  describe("moves", () => {
    const m = member(6, { moveIds: [10, 20, 30] });
    it("replaces a slot or appends after the last move", () => {
      expect(withMove(m, 1, 99).moveIds).toEqual([10, 99, 30]);
      expect(withMove(m, 3, 99).moveIds).toEqual([10, 20, 30, 99]);
      // A slot past the end can't leave a gap.
      expect(withMove(member(6), 3, 99).moveIds).toEqual([99]);
    });
    it("swaps instead of teaching a move twice", () => {
      expect(withMove(m, 0, 30).moveIds).toEqual([30, 20, 10]);
      expect(withMove(m, 3, 10).moveIds).toEqual([20, 30, 10]);
      expect(withMove(m, 1, 20)).toBe(m);
    });
    it("never holds more than four", () => {
      const full = member(6, { moveIds: [1, 2, 3, 4] });
      expect(withMove(full, 7, 5).moveIds).toEqual([1, 2, 3, 5]);
    });
    it("removes a move and closes the gap", () => {
      expect(withoutMove(m, 0).moveIds).toEqual([20, 30]);
    });
  });

  describe("EVs and IVs", () => {
    it("caps a stat at 255 and the total at 510", () => {
      let evs = uniformSpread(0);
      evs = withEv(evs, "attack", 999);
      expect(evs.attack).toBe(255);
      evs = withEv(evs, "speed", 255);
      evs = withEv(evs, "hp", 100);
      expect(evs.hp).toBe(0);
      expect(evTotal(evs)).toBe(510);
      // Lowering one stat frees points for another.
      evs = withEv(withEv(evs, "speed", 252), "hp", 100);
      expect(evs.hp).toBe(3);
    });
    it("treats junk as 0 and keeps IVs in 0–31", () => {
      expect(withEv(uniformSpread(0), "hp", Number.NaN).hp).toBe(0);
      expect(withEv(uniformSpread(0), "hp", -4).hp).toBe(0);
      expect(withIv(uniformSpread(31), "hp", 40).hp).toBe(31);
      expect(withIv(uniformSpread(31), "hp", -1).hp).toBe(0);
    });
  });

  describe("Frontier entry rules", () => {
    const legal = [member(6), member(9), member(3)];
    it("accepts three different Pokémon and ignores walkthrough teams", () => {
      expect(teamIssues(team({ members: legal }))).toEqual([]);
      expect(
        teamIssues(team({ purpose: "walkthrough", members: [member(150)] })),
      ).toEqual([]);
    });
    it("needs three eligible Pokémon", () => {
      expect(teamIssues(team({ members: legal.slice(0, 2) }))).toEqual([
        { kind: "too-few", eligible: 2 },
      ]);
    });
    it("bans the legendaries the game bans", () => {
      for (const id of [150, 151, 249, 250, 251, 382, 383, 384, 385, 386])
        expect(teamIssues(team({ members: [...legal, member(id)] }))).toEqual([
          { kind: "banned", slot: 3 },
        ]);
      // Not banned: the birds, beasts, Regis and Lati@s.
      for (const id of [144, 243, 377, 380, 381])
        expect(teamIssues(team({ members: [...legal, member(id)] }))).toEqual(
          [],
        );
    });
    it("caps Level 50 mode at Lv 50, but not Open Level", () => {
      const members = [...legal, member(1, { level: 51 })];
      expect(teamIssues(team({ members }))).toEqual([
        { kind: "over-level", slot: 3 },
      ]);
      expect(teamIssues(team({ members, levelMode: "open" }))).toEqual([]);
    });
    it("flags repeated species and repeated held items", () => {
      expect(
        teamIssues(
          team({
            members: [
              member(6, { itemId: 5 }),
              member(9, { itemId: 5 }),
              member(3),
              member(6),
              member(1),
            ],
          }),
        ),
      ).toEqual([
        { kind: "duplicate-item", slot: 1 },
        { kind: "duplicate-species", slot: 3 },
      ]);
    });
    it("allows no held items in the Battle Pyramid", () => {
      const members = [...legal, member(1, { itemId: 5 })];
      expect(teamIssues(team({ purpose: "pyramid", members }))).toEqual([
        { kind: "held-item", slot: 3 },
      ]);
      expect(teamIssues(team({ purpose: "pike", members }))).toEqual([]);
    });
  });

  describe("saving", () => {
    const saved = team({
      name: "Rain",
      note: "Lead with Kingdra",
      members: [member(230, { moveIds: [57, 58], itemId: 3 })],
    });
    it("round-trips", () => {
      expect(parseTeams(serializeTeams([saved]))).toEqual([saved]);
    });
    it("reads nothing from missing, broken or foreign data", () => {
      expect(parseTeams(null)).toEqual([]);
      expect(parseTeams("{not json")).toEqual([]);
      expect(parseTeams("[]")).toEqual([]);
      expect(
        parseTeams(JSON.stringify({ version: 99, teams: [saved] })),
      ).toEqual([]);
    });
    it("drops what is malformed and keeps the rest", () => {
      const json = JSON.stringify({
        version: 1,
        teams: [
          saved,
          { ...saved, id: "t2", purpose: "factory" },
          { ...saved, id: "t3", game: "gold" },
          { ...saved }, // same id again
          {
            ...saved,
            id: "t4",
            members: [
              saved.members[0],
              { ...saved.members[0], level: 101 },
              { ...saved.members[0], evs: uniformSpread(255) },
              { ...saved.members[0], ivs: { hp: 32 } },
              "nonsense",
            ],
          },
        ],
      });
      const teams = parseTeams(json);
      expect(teams.map((t) => t.id)).toEqual(["t1", "t4"]);
      expect(teams[1]!.members).toEqual([saved.members[0]]);
    });
    it("trims repeated moves and extra moves or members", () => {
      const json = JSON.stringify({
        version: 1,
        teams: [
          {
            ...saved,
            members: Array.from({ length: 8 }, () => ({
              ...saved.members[0],
              moveIds: [1, 1, 2, 3, 4, 5],
            })),
          },
        ],
      });
      const [t] = parseTeams(json);
      expect(t!.members).toHaveLength(6);
      expect(t!.members[0]!.moveIds).toEqual([1, 2, 3, 4]);
    });
  });
});
