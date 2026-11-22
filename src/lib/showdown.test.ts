import { describe, expect, it } from "vitest";

import {
  formatMember,
  formatTeam,
  normalizeName,
  parseShowdown,
  type NameIndex,
} from "./showdown";
import { uniformSpread } from "./stats";
import type { TeamMember } from "./teams";

const INDEX: NameIndex = {
  species: [
    { id: 373, name: "Salamence", abilityIds: [22] },
    { id: 29, name: "Nidoran♀", abilityIds: [38] },
    { id: 122, name: "Mr. Mime", abilityIds: [43] },
    { id: 386, name: "Deoxys", abilityIds: [46] },
    { id: 65, name: "Alakazam", abilityIds: [28, 39] },
  ],
  moves: [
    { id: 89, name: "Earthquake" },
    { id: 337, name: "Dragon Claw" },
    { id: 9, name: "ThunderPunch" },
    { id: 185, name: "Faint Attack" },
    { id: 237, name: "Hidden Power" },
    { id: 94, name: "Psychic" },
    { id: 7, name: "Fire Punch" },
    { id: 8, name: "Ice Punch" },
    { id: 105, name: "Recover" },
  ],
  items: [
    { id: 187, name: "Choice Band" },
    { id: 202, name: "TwistedSpoon" },
  ],
  abilities: [
    { id: 22, name: "Intimidate" },
    { id: 28, name: "Synchronize" },
    { id: 39, name: "Inner Focus" },
    { id: 38, name: "Poison Point" },
    { id: 43, name: "Soundproof" },
    { id: 46, name: "Pressure" },
  ],
  natures: [
    { id: 0, name: "Hardy" },
    { id: 3, name: "Adamant" },
    { id: 15, name: "Modest" },
  ],
};

const salamence: TeamMember = {
  pokemonId: 373,
  level: 50,
  natureId: 3,
  abilityId: 22,
  itemId: 187,
  moveIds: [89, 337],
  evs: { ...uniformSpread(0), hp: 4, attack: 252, speed: 252 },
  ivs: { ...uniformSpread(31), hp: 30 },
};

describe("normalizeName", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normalizeName("Thunder Punch")).toBe(normalizeName("ThunderPunch"));
    expect(normalizeName("Mr. Mime")).toBe("mrmime");
    expect(normalizeName("Nidoran-F")).toBe(normalizeName("Nidoran♀"));
    expect(normalizeName("Pokémon")).toBe("pokemon");
  });
});

describe("formatMember", () => {
  it("writes a Showdown set", () => {
    expect(formatMember(salamence, INDEX)).toBe(
      [
        "Salamence @ Choice Band",
        "Ability: Intimidate",
        "Level: 50",
        "EVs: 4 HP / 252 Atk / 252 Spe",
        "Adamant Nature",
        "IVs: 30 HP",
        "- Earthquake",
        "- Dragon Claw",
      ].join("\n"),
    );
  });
  it("leaves out empty EVs, perfect IVs and a missing item", () => {
    const plain = {
      ...salamence,
      itemId: null,
      evs: uniformSpread(0),
      ivs: uniformSpread(31),
    };
    expect(formatMember(plain, INDEX)).not.toMatch(/@|EVs|IVs/);
  });
});

describe("parseShowdown", () => {
  it("round-trips what it writes", () => {
    const text = formatTeam({ name: "Dragons", members: [salamence] }, INDEX);
    expect(parseShowdown(text, INDEX, 100)).toEqual({
      teams: [{ name: "Dragons", members: [salamence] }],
      warnings: [],
    });
  });

  it("reads a typical Smogon set with modern spellings", () => {
    const text = `
Spoony (Alakazam) (M) @ Twisted Spoon
Ability: Inner Focus
Shiny: Yes
EVs: 4 HP / 252 SpA / 252 Spe
Modest Nature
IVs: 2 Atk / 30 Def
- Psychic
- Thunder Punch
- Feint Attack
- Hidden Power [Fire]
`;
    const { teams, warnings } = parseShowdown(text, INDEX, 50);
    expect(warnings).toEqual([]);
    expect(teams).toHaveLength(1);
    expect(teams[0]!.members[0]).toEqual({
      pokemonId: 65,
      level: 50, // no Level line: the default
      natureId: 15,
      abilityId: 39,
      itemId: 202,
      moveIds: [94, 9, 185, 237],
      evs: { ...uniformSpread(0), hp: 4, spAttack: 252, speed: 252 },
      ivs: { ...uniformSpread(31), attack: 2, defense: 30 },
    });
  });

  it("matches tricky species names and forms", () => {
    const text = "Nidoran-F\n\nMr. Mime\n\nDeoxys-Speed";
    const { teams } = parseShowdown(text, INDEX, 50);
    expect(teams[0]!.members.map((m) => m.pokemonId)).toEqual([29, 122, 386]);
  });

  it("splits teams on === headers", () => {
    const text =
      "=== [gen3ou] One ===\n\nSalamence\n\n=== [gen3ou] Two ===\n\nAlakazam\n\nMr. Mime";
    const { teams } = parseShowdown(text, INDEX, 50);
    expect(teams.map((t) => [t.name, t.members.length])).toEqual([
      ["One", 1],
      ["Two", 2],
    ]);
  });

  it("keeps what it can and says what it left out", () => {
    const text = `
Garchomp @ Choice Scarf

Alakazam @ Life Orb
Ability: Magic Guard
EVs: 252 SpA / 252 Spe / 252 HP
- Psychic
- Psychic
- Focus Blast
- Fire Punch
- Ice Punch
- Recover
`;
    const { teams, warnings } = parseShowdown(text, INDEX, 50);
    const zam = teams[0]!.members[0]!;
    expect(teams[0]!.members).toHaveLength(1);
    expect(zam.abilityId).toBe(28); // its first ability
    expect(zam.itemId).toBeNull();
    expect(zam.evs).toEqual(uniformSpread(0));
    expect(zam.moveIds).toEqual([94, 7, 8, 105]);
    expect(warnings).toEqual([
      "“Garchomp” isn’t a Gen 3 Pokémon; left out.",
      "Alakazam: no item “Life Orb” in Gen 3.",
      "Alakazam can’t have “Magic Guard” in Gen 3; it gets its first ability.",
      "Alakazam: EVs add up to more than 510; left at 0.",
      "Alakazam: no move “Focus Blast” in Gen 3.",
    ]);
  });

  it("stops at six Pokémon a team", () => {
    const text = Array(7).fill("Salamence").join("\n\n");
    const { teams, warnings } = parseShowdown(text, INDEX, 50);
    expect(teams[0]!.members).toHaveLength(6);
    expect(warnings).toEqual(["Salamence left out: a team holds 6 Pokémon."]);
  });

  it("reads nothing from empty or unrelated text", () => {
    expect(parseShowdown("", INDEX, 50)).toEqual({ teams: [], warnings: [] });
    expect(parseShowdown("hello world", INDEX, 50).teams).toEqual([]);
  });
});
