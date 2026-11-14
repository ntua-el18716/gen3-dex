import type { Stat } from "@/db/schema";

import { facilityInfo } from "./frontier-facilities";
import { GAME_INFO } from "./games";
import {
  FRONTIER_PARTY_SIZE,
  isFrontier,
  type Team,
  type TeamIssue,
  type TeamPurpose,
} from "./teams";

/** The words the Teams screens use for the data in lib/teams.ts. */

export const STAT_LABELS: [Stat, string][] = [
  ["hp", "HP"],
  ["attack", "Atk"],
  ["defense", "Def"],
  ["spAttack", "SpA"],
  ["spDefense", "SpD"],
  ["speed", "Spe"],
];
const STAT_LABEL = Object.fromEntries(STAT_LABELS) as Record<Stat, string>;

/** "Walkthrough", "Battle Tower"… */
export function purposeName(purpose: TeamPurpose): string {
  return isFrontier(purpose)
    ? (facilityInfo(purpose)?.name ?? purpose)
    : "Walkthrough";
}

/** "Emerald walkthrough", "Battle Tower, Level 50". */
export function purposeLabel(
  team: Pick<Team, "purpose" | "game" | "levelMode">,
): string {
  if (!isFrontier(team.purpose))
    return `${GAME_INFO[team.game].name} walkthrough`;
  return `${purposeName(team.purpose)}, ${
    team.levelMode === "50" ? "Level 50" : "Open Level"
  }`;
}

/** "+Atk −Def", or "No stat change". */
export function natureEffect(nature: {
  increasedStat: Stat | null;
  decreasedStat: Stat | null;
}): string {
  return nature.increasedStat &&
    nature.decreasedStat &&
    nature.increasedStat !== nature.decreasedStat
    ? `+${STAT_LABEL[nature.increasedStat]} −${STAT_LABEL[nature.decreasedStat]}`
    : "No stat change";
}

/** One sentence per entry rule a Frontier team breaks. */
export function issueText(issue: TeamIssue, name: (slot: number) => string) {
  switch (issue.kind) {
    case "banned":
      return `${name(issue.slot)} can't enter the Battle Frontier.`;
    case "over-level":
      return `${name(issue.slot)} is above Lv 50, the limit in Level 50 mode.`;
    case "duplicate-species":
      return `Only one ${name(issue.slot)} can enter.`;
    case "duplicate-item":
      return `${name(issue.slot)} holds the same item as another Pokémon.`;
    case "held-item":
      return `${name(issue.slot)} can't hold an item in the Battle Pyramid.`;
    case "too-few":
      return `A challenge needs ${FRONTIER_PARTY_SIZE} Pokémon that can enter (4 for the Tower's doubles); this team has ${issue.eligible}.`;
  }
}
