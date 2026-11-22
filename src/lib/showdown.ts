/**
 * Teams as text, in the format Pokémon Showdown and Smogon use:
 *
 *   Salamence @ Choice Band
 *   Ability: Intimidate
 *   Level: 50
 *   EVs: 252 Atk / 4 HP / 252 Spe
 *   Adamant Nature
 *   IVs: 30 HP
 *   - Earthquake
 *   - Dragon Claw
 *
 * Pokémon are separated by blank lines; "=== [format] Name ===" lines start
 * a new team. Names are matched loosely (case, spaces and punctuation are
 * ignored), so Gen 3 spellings ("ThunderPunch") and modern ones ("Thunder
 * Punch") both work. Pure functions: the names come from a NameIndex built
 * from gen3.db (src/db/team-queries.ts).
 */
import { STATS, type Stat } from "@/db/schema";

import { uniformSpread, type StatSpread } from "./stats";
import {
  evTotal,
  MAX_EV,
  MAX_EV_TOTAL,
  MAX_IV,
  MAX_MOVES,
  MAX_TEAM_SIZE,
  type TeamMember,
} from "./teams";

/** Names and ids of everything a set can mention. */
export type NameIndex = {
  species: { id: number; name: string; abilityIds: number[] }[];
  moves: { id: number; name: string }[];
  items: { id: number; name: string }[];
  abilities: { id: number; name: string }[];
  natures: { id: number; name: string }[];
};

/** Showdown's stat names, in its order. */
const STAT_TEXT: Record<Stat, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  spAttack: "SpA",
  spDefense: "SpD",
  speed: "Spe",
};
const SHOWDOWN_ORDER: Stat[] = [
  "hp",
  "attack",
  "defense",
  "spAttack",
  "spDefense",
  "speed",
];

/** Lower case, letters and digits only; ♀/♂ become f/m (Nidoran-F). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[^a-z0-9]/g, "");
}

/** Modern names of moves Gen 3 spells differently (normalised). */
const MOVE_ALIASES: Record<string, string> = {
  feintattack: "faintattack",
  highjumpkick: "hijumpkick",
  visegrip: "vicegrip",
  smellingsalts: "smellingsalt",
};

function finder<T extends { name: string }>(
  list: T[],
  aliases: Record<string, string> = {},
) {
  const byName = new Map(list.map((x) => [normalizeName(x.name), x]));
  return (name: string): T | undefined => {
    const key = normalizeName(name);
    return byName.get(aliases[key] ?? key);
  };
}

// --- Writing ----------------------------------------------------------------

function spreadLine(spread: StatSpread, skip: number): string {
  return SHOWDOWN_ORDER.filter((s) => spread[s] !== skip)
    .map((s) => `${spread[s]} ${STAT_TEXT[s]}`)
    .join(" / ");
}

/** One team member as a Showdown set. */
export function formatMember(member: TeamMember, index: NameIndex): string {
  const name = (list: { id: number; name: string }[], id: number | null) =>
    id === null ? undefined : list.find((x) => x.id === id)?.name;
  const species = name(index.species, member.pokemonId) ?? "Missingno";
  const item = name(index.items, member.itemId);
  const lines = [item ? `${species} @ ${item}` : species];
  const ability = name(index.abilities, member.abilityId);
  if (ability) lines.push(`Ability: ${ability}`);
  lines.push(`Level: ${member.level}`);
  if (evTotal(member.evs) > 0) lines.push(`EVs: ${spreadLine(member.evs, 0)}`);
  const nature = name(index.natures, member.natureId);
  if (nature) lines.push(`${nature} Nature`);
  if (STATS.some((s) => member.ivs[s] !== MAX_IV))
    lines.push(`IVs: ${spreadLine(member.ivs, MAX_IV)}`);
  for (const id of member.moveIds) {
    const move = name(index.moves, id);
    if (move) lines.push(`- ${move}`);
  }
  return lines.join("\n");
}

/** A whole team, with a "=== [gen3] Name ===" header. */
export function formatTeam(
  team: { name: string; members: TeamMember[] },
  index: NameIndex,
): string {
  return [
    `=== [gen3] ${team.name || "Untitled team"} ===`,
    ...team.members.map((m) => formatMember(m, index)),
  ].join("\n\n");
}

// --- Reading ----------------------------------------------------------------

export type ParsedTeam = { name: string; members: TeamMember[] };
export type ParseResult = {
  teams: ParsedTeam[];
  /** Things that were left out or changed, one sentence each. */
  warnings: string[];
};

function parseSpread(
  text: string,
  base: StatSpread,
  max: number,
): StatSpread | null {
  const spread = { ...base };
  for (const part of text.split("/")) {
    const match = part.trim().match(/^(\d+)\s+([A-Za-z]+)$/);
    if (!match) return null;
    const stat = SHOWDOWN_ORDER.find(
      (s) => STAT_TEXT[s].toLowerCase() === match[2]!.toLowerCase(),
    );
    if (!stat) return null;
    spread[stat] = Math.min(max, Number(match[1]));
  }
  return spread;
}

/**
 * Reads Showdown text into teams. Pokémon without a Level line get
 * `defaultLevel` (Showdown would assume 100; Frontier sets usually mean 50).
 * Anything that can't be matched is left out with a warning, never an
 * error, so a half-right paste still imports what it can.
 */
export function parseShowdown(
  text: string,
  index: NameIndex,
  defaultLevel: number,
): ParseResult {
  const findSpecies = finder(index.species);
  const findMove = finder(index.moves, MOVE_ALIASES);
  const findItem = finder(index.items);
  const findAbility = finder(index.abilities);
  const findNature = finder(index.natures);
  const warnings: string[] = [];
  const teams: ParsedTeam[] = [];
  let current: ParsedTeam | null = null;

  const blocks: { header?: string; lines: string[] }[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length > 0) blocks.push({ lines });
    lines = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const header = line.match(/^===\s*(?:\[[^\]]*\])?\s*(.*?)\s*===$/);
    if (header) {
      flush();
      blocks.push({ header: header[1] ?? "", lines: [] });
    } else if (line === "") flush();
    else lines.push(line);
  }
  flush();

  for (const block of blocks) {
    if (block.header !== undefined) {
      current = { name: block.header, members: [] };
      teams.push(current);
      continue;
    }
    if (!current) {
      current = { name: "", members: [] };
      teams.push(current);
    }
    const member = parseMember(block.lines);
    if (!member) continue;
    if (current.members.length >= MAX_TEAM_SIZE) {
      warnings.push(
        `${index.species.find((s) => s.id === member.pokemonId)?.name} left out: a team holds ${MAX_TEAM_SIZE} Pokémon.`,
      );
      continue;
    }
    current.members.push(member);
  }
  return { teams: teams.filter((t) => t.members.length > 0), warnings };

  function parseMember(block: string[]): TeamMember | null {
    // "Nickname (Species) (F) @ Item", "Species (M)", "Species @ Item"…
    const [first, ...rest] = block;
    const [left, itemText] = first!.split(/\s+@\s+/);
    const parts = left!
      .replace(/\((M|F)\)\s*$/, "")
      .trim()
      .match(/^(.*?)(?:\s*\(([^)]+)\))?$/)!;
    const speciesText = parts[2] ?? parts[1]!;
    const species =
      findSpecies(speciesText) ??
      // Forms: "Deoxys-Speed", "Castform-Sunny", "Unown-B".
      findSpecies(speciesText.split("-")[0]!);
    if (!species) {
      warnings.push(`“${speciesText}” isn’t a Gen 3 Pokémon; left out.`);
      return null;
    }
    const member: TeamMember = {
      pokemonId: species.id,
      level: defaultLevel,
      natureId: 0,
      abilityId: species.abilityIds[0]!,
      itemId: null,
      moveIds: [],
      evs: uniformSpread(0),
      ivs: uniformSpread(MAX_IV),
    };
    if (itemText) {
      const item = findItem(itemText);
      if (item) member.itemId = item.id;
      else warnings.push(`${species.name}: no item “${itemText}” in Gen 3.`);
    }
    for (const line of rest) {
      const [key, ...value] = line.split(":");
      const val = value.join(":").trim();
      if (line.startsWith("-")) {
        // "Hidden Power [Fire]": the type comes from the IVs in Gen 3.
        const moveText = line
          .slice(1)
          .trim()
          .replace(/\s*\[.*\]$/, "");
        const move = findMove(moveText);
        if (!move)
          warnings.push(`${species.name}: no move “${moveText}” in Gen 3.`);
        else if (member.moveIds.includes(move.id)) continue;
        else if (member.moveIds.length >= MAX_MOVES)
          warnings.push(`${species.name}: only ${MAX_MOVES} moves kept.`);
        else member.moveIds.push(move.id);
      } else if (/^\w+ Nature$/i.test(line)) {
        const nature = findNature(line.replace(/\s*Nature$/i, ""));
        if (nature) member.natureId = nature.id;
        else warnings.push(`${species.name}: unknown nature in “${line}”.`);
      } else if (/^ability$/i.test(key!.trim())) {
        const ability = findAbility(val);
        if (ability && species.abilityIds.includes(ability.id))
          member.abilityId = ability.id;
        else
          warnings.push(
            `${species.name} can’t have “${val}” in Gen 3; it gets its first ability.`,
          );
      } else if (/^level$/i.test(key!.trim())) {
        const level = Number(val);
        if (Number.isInteger(level) && level >= 1 && level <= 100)
          member.level = level;
      } else if (/^evs$/i.test(key!.trim())) {
        const evs = parseSpread(val, member.evs, MAX_EV);
        if (!evs) warnings.push(`${species.name}: couldn’t read “${line}”.`);
        else if (evTotal(evs) > MAX_EV_TOTAL)
          warnings.push(
            `${species.name}: EVs add up to more than ${MAX_EV_TOTAL}; left at 0.`,
          );
        else member.evs = evs;
      } else if (/^ivs$/i.test(key!.trim())) {
        const ivs = parseSpread(val, member.ivs, MAX_IV);
        if (ivs) member.ivs = ivs;
        else warnings.push(`${species.name}: couldn’t read “${line}”.`);
      }
      // Shiny, Happiness, Tera Type and the like don't exist here; skipped.
    }
    return member;
  }
}
