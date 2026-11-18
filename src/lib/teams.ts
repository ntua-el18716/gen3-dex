/**
 * The user's own teams: the data, the rules for editing it, and the Battle
 * Frontier's entry rules. Pure functions, no storage and no database, so
 * everything here is unit-tested. Storage is in src/state/teams.tsx.
 *
 * A member refers to Pokémon, moves, items, natures and abilities by their
 * ids in gen3.db; names and stats are looked up when a team is shown.
 */
import {
  FRONTIER_LEVEL_MODES,
  GAMES,
  STATS,
  type FrontierFacility,
  type FrontierLevelMode,
  type Game,
  type Stat,
} from "@/db/schema";

import { LEVEL_50 } from "./frontier";
import { uniformSpread, type StatSpread } from "./stats";

/**
 * What a team is for: a playthrough, or one Frontier facility. The Factory
 * isn't here: you battle with rental Pokémon there, not your own.
 */
export const TEAM_PURPOSES = [
  "walkthrough",
  "tower",
  "dome",
  "palace",
  "arena",
  "pike",
  "pyramid",
] as const satisfies readonly ("walkthrough" | FrontierFacility)[];
export type TeamPurpose = (typeof TEAM_PURPOSES)[number];

export const MAX_TEAM_SIZE = 6;
export const MAX_MOVES = 4;
export const MAX_IV = 31;
/** Gen 3 limits: 255 per stat (only multiples of 4 count), 510 in total. */
export const MAX_EV = 255;
export const MAX_EV_TOTAL = 510;
export const MAX_LEVEL = 100;
/** Pokémon a Frontier challenge needs (the Tower's doubles take 4). */
export const FRONTIER_PARTY_SIZE = 3;

/**
 * National Dex numbers of gFrontierBannedSpecies (pokeemerald
 * frontier_util.c): Mewtwo, Mew, Lugia, Ho-Oh, Celebi, Kyogre, Groudon,
 * Rayquaza, Jirachi, Deoxys.
 */
export const FRONTIER_BANNED: ReadonlySet<number> = new Set([
  150, 151, 249, 250, 251, 382, 383, 384, 385, 386,
]);

export type TeamMember = {
  pokemonId: number;
  level: number;
  natureId: number;
  /** One of the species' abilities. */
  abilityId: number;
  itemId: number | null;
  /** Up to four, no repeats. */
  moveIds: number[];
  evs: StatSpread;
  ivs: StatSpread;
};

export type Team = {
  id: string;
  name: string;
  /** Whose moves and sprites apply. Frontier teams are always Emerald. */
  game: Game;
  purpose: TeamPurpose;
  /** Only matters for Frontier teams. */
  levelMode: FrontierLevelMode;
  note: string;
  members: TeamMember[];
  /** Milliseconds since 1970; the list shows recent teams first. */
  updatedAt: number;
};

export function isFrontier(
  purpose: TeamPurpose,
): purpose is Exclude<TeamPurpose, "walkthrough"> {
  return purpose !== "walkthrough";
}

/** The level a new member starts at. */
export function defaultLevel(team: Pick<Team, "purpose" | "levelMode">) {
  if (!isFrontier(team.purpose)) return LEVEL_50;
  return team.levelMode === "50" ? LEVEL_50 : MAX_LEVEL;
}

export function newTeam(
  id: string,
  now: number,
  game: Game,
  purpose: TeamPurpose = "walkthrough",
): Team {
  return {
    id,
    name: "",
    game: isFrontier(purpose) ? "emerald" : game,
    purpose,
    levelMode: "50",
    note: "",
    members: [],
    updatedAt: now,
  };
}

/** A member with no moves or item, perfect IVs and no EVs. */
export function newMember(
  pokemonId: number,
  abilityId: number,
  level: number,
): TeamMember {
  return {
    pokemonId,
    level,
    natureId: 0, // Hardy: neutral
    abilityId,
    itemId: null,
    moveIds: [],
    evs: uniformSpread(0),
    ivs: uniformSpread(MAX_IV),
  };
}

/**
 * A Frontier team is an Emerald team; switching to the Frontier (or
 * between level modes) keeps the members as they are.
 */
export function withPurpose(team: Team, purpose: TeamPurpose): Team {
  return {
    ...team,
    purpose,
    game: isFrontier(purpose) ? "emerald" : team.game,
  };
}

/**
 * A different species in the same slot: level, nature, item, EVs and IVs
 * stay, but the moves and the ability belong to the old species.
 */
export function withSpecies(
  member: TeamMember,
  pokemonId: number,
  abilityId: number,
): TeamMember {
  if (member.pokemonId === pokemonId) return member;
  return { ...member, pokemonId, abilityId, moveIds: [] };
}

/** Puts a move in a slot; a move already known moves there (swapping). */
export function withMove(
  member: TeamMember,
  index: number,
  moveId: number,
): TeamMember {
  const moves = [...member.moveIds];
  const at = Math.min(
    Math.max(index, 0),
    Math.min(moves.length, MAX_MOVES - 1),
  );
  const existing = moves.indexOf(moveId);
  if (existing === at) return member;
  if (existing >= 0) {
    if (at < moves.length) moves[existing] = moves[at]!;
    else moves.splice(existing, 1);
  }
  if (existing >= 0 && at >= moves.length) moves.push(moveId);
  else moves[at] = moveId;
  return { ...member, moveIds: moves };
}

export function withoutMove(member: TeamMember, index: number): TeamMember {
  return { ...member, moveIds: member.moveIds.filter((_, i) => i !== index) };
}

export function evTotal(evs: StatSpread): number {
  return STATS.reduce((sum, s) => sum + evs[s], 0);
}

/**
 * Sets one stat's EVs, as far as the limits allow: 0–255 for the stat, and
 * never more than 510 in total (the rest goes unused, like in the game).
 */
export function withEv(evs: StatSpread, stat: Stat, value: number): StatSpread {
  const others = evTotal(evs) - evs[stat];
  const clamped = Math.min(
    Math.max(Math.trunc(value) || 0, 0),
    MAX_EV,
    MAX_EV_TOTAL - others,
  );
  return { ...evs, [stat]: clamped };
}

export function withIv(ivs: StatSpread, stat: Stat, value: number): StatSpread {
  return {
    ...ivs,
    [stat]: Math.min(Math.max(Math.trunc(value) || 0, 0), MAX_IV),
  };
}

export function clampLevel(level: number): number {
  return Math.min(Math.max(Math.trunc(level) || 1, 1), MAX_LEVEL);
}

// --- Frontier entry rules ---------------------------------------------------

export type TeamIssue =
  | { kind: "banned"; slot: number }
  | { kind: "over-level"; slot: number }
  | { kind: "duplicate-species"; slot: number }
  | { kind: "duplicate-item"; slot: number }
  | { kind: "held-item"; slot: number }
  | { kind: "too-few"; eligible: number };

/**
 * Why a Frontier team (or some of its Pokémon) can't enter, following
 * pokeemerald's CheckPartyIneligibility / AppendIfValid: banned species,
 * above Lv 50 in Level 50 mode, a species or held item another eligible
 * member already has, any held item in the Battle Pyramid; and at least
 * three eligible Pokémon. Walkthrough teams have no rules.
 */
export function teamIssues(team: Team): TeamIssue[] {
  if (!isFrontier(team.purpose)) return [];
  const issues: TeamIssue[] = [];
  const species = new Set<number>();
  const items = new Set<number>();
  team.members.forEach((m, slot) => {
    if (FRONTIER_BANNED.has(m.pokemonId)) {
      issues.push({ kind: "banned", slot });
    } else if (team.levelMode === "50" && m.level > LEVEL_50) {
      issues.push({ kind: "over-level", slot });
    } else if (team.purpose === "pyramid" && m.itemId !== null) {
      issues.push({ kind: "held-item", slot });
    } else if (species.has(m.pokemonId)) {
      issues.push({ kind: "duplicate-species", slot });
    } else if (m.itemId !== null && items.has(m.itemId)) {
      issues.push({ kind: "duplicate-item", slot });
    } else {
      species.add(m.pokemonId);
      if (m.itemId !== null) items.add(m.itemId);
    }
  });
  if (species.size < FRONTIER_PARTY_SIZE)
    issues.push({ kind: "too-few", eligible: species.size });
  return issues;
}

// --- Saving and loading -----------------------------------------------------

/** Bumped when the saved shape changes in a way old data must be converted. */
export const TEAMS_VERSION = 1;

export function serializeTeams(teams: Team[]): string {
  return JSON.stringify({ version: TEAMS_VERSION, teams });
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

function parseSpread(v: unknown, max: number): StatSpread | null {
  if (!isObject(v)) return null;
  const out = uniformSpread(0);
  for (const s of STATS) {
    const n = v[s];
    if (!isCount(n) || n > max) return null;
    out[s] = n;
  }
  return out;
}

function parseMember(v: unknown): TeamMember | null {
  if (!isObject(v)) return null;
  const evs = parseSpread(v.evs, MAX_EV);
  const ivs = parseSpread(v.ivs, MAX_IV);
  if (
    !isCount(v.pokemonId) ||
    !isCount(v.level) ||
    v.level < 1 ||
    v.level > MAX_LEVEL ||
    !isCount(v.natureId) ||
    !isCount(v.abilityId) ||
    !(v.itemId === null || isCount(v.itemId)) ||
    !Array.isArray(v.moveIds) ||
    !v.moveIds.every(isCount) ||
    !evs ||
    !ivs ||
    evTotal(evs) > MAX_EV_TOTAL
  )
    return null;
  return {
    pokemonId: v.pokemonId,
    level: v.level,
    natureId: v.natureId,
    abilityId: v.abilityId,
    itemId: v.itemId,
    moveIds: [...new Set(v.moveIds)].slice(0, MAX_MOVES),
    evs,
    ivs,
  };
}

function parseTeam(v: unknown): Team | null {
  if (!isObject(v)) return null;
  const game = GAMES.find((g) => g === v.game);
  const purpose = TEAM_PURPOSES.find((p) => p === v.purpose);
  const levelMode = FRONTIER_LEVEL_MODES.find((m) => m === v.levelMode);
  if (
    typeof v.id !== "string" ||
    v.id === "" ||
    typeof v.name !== "string" ||
    !game ||
    !purpose ||
    !levelMode ||
    !Array.isArray(v.members)
  )
    return null;
  return {
    id: v.id,
    name: v.name,
    game,
    purpose,
    levelMode,
    note: typeof v.note === "string" ? v.note : "",
    // A member that doesn't parse is dropped; the rest of the team is kept.
    members: v.members
      .map(parseMember)
      .filter((m) => m !== null)
      .slice(0, MAX_TEAM_SIZE),
    updatedAt: isCount(v.updatedAt) ? v.updatedAt : 0,
  };
}

/**
 * Reads saved teams. Saved data is never trusted: anything that isn't a
 * well-formed team is left out instead of crashing the app (a half-written
 * save, an older version, an edited file).
 */
export function parseTeams(json: string | null): Team[] {
  if (!json) return [];
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!isObject(data) || data.version !== TEAMS_VERSION) return [];
  if (!Array.isArray(data.teams)) return [];
  const seen = new Set<string>();
  return data.teams
    .map(parseTeam)
    .filter(
      (t): t is Team => t !== null && !seen.has(t.id) && !!seen.add(t.id),
    );
}
