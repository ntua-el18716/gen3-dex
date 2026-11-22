import {
  STAGE_STATS,
  type DamageResult,
  type DamageSummary,
  type SideConditions,
  type Status,
} from "./damage";
import { STAT_SHORT } from "./stat-labels";

/** The words the Matchup screen uses for the numbers in lib/damage.ts. */

/** "42–50%", or "100%" when both ends round to the same number. */
export function shareRange(summary: DamageSummary): string {
  const low = Math.floor(summary.minShare * 100);
  const high = Math.floor(summary.maxShare * 100);
  return low === high ? `${low}%` : `${low}–${high}%`;
}

/** How soon the move knocks the target out from full HP. */
export function koText(summary: DamageSummary): string {
  if (summary.koChance === 1) return "Knocks out in one turn";
  if (summary.koChance === null) return "Can knock out in one turn";
  if (summary.koChance > 0) {
    // Never "0%" or "100%" for something that's merely unlikely or likely.
    const percent = Math.min(
      99,
      Math.max(1, Math.round(summary.koChance * 100)),
    );
    return `${percent}% to knock out in one turn`;
  }
  return summary.fewestUses === summary.mostUses
    ? `Knocks out in ${summary.fewestUses} turns`
    : `Knocks out in ${summary.fewestUses}–${summary.mostUses} turns`;
}

/** "2×", "½×"… or null for neutral hits. */
export function effectivenessLabel(effectiveness: number): string | null {
  switch (effectiveness) {
    case 4:
      return "4×";
    case 2:
      return "2×";
    case 0.5:
      return "½×";
    case 0.25:
      return "¼×";
    default:
      return null;
  }
}

/** What to say when a move has no damage range to show. */
export function noDamageText(
  result: Exclude<DamageResult, { kind: "damage" }>,
): string {
  switch (result.kind) {
    case "status":
      return "Status move";
    case "immune":
      return result.by === "type"
        ? "Doesn’t affect its type"
        : "Blocked by its ability";
    case "varies":
      return result.why === "one-hit-ko"
        ? "Knocks out if it lands"
        : result.why === "battle"
          ? "Depends on the battle"
          : "Power varies";
  }
}

export const STATUS_LABELS: Record<Status, string> = {
  none: "Healthy",
  burn: "Burned",
  poison: "Poisoned",
  paralysis: "Paralysed",
  sleep: "Asleep",
  freeze: "Frozen",
};

/** "+2" / "−1" / "0". */
export function stageLabel(stage: number): string {
  return stage > 0 ? `+${stage}` : stage < 0 ? `−${-stage}` : "0";
}

/** One line for a side's conditions, e.g. "50% HP · Burned · Atk +2". */
export function describeSide(side: SideConditions): string {
  const parts: string[] = [];
  if (side.hpPercent < 100) parts.push(`${side.hpPercent}% HP`);
  if (side.status !== "none") parts.push(STATUS_LABELS[side.status]);
  for (const stat of STAGE_STATS) {
    const stage = side.stages[stat] ?? 0;
    if (stage !== 0) parts.push(`${STAT_SHORT[stat]} ${stageLabel(stage)}`);
  }
  if (side.reflect) parts.push("Reflect");
  if (side.lightScreen) parts.push("Light Screen");
  return parts.length > 0
    ? parts.join(" · ")
    : "Full HP, healthy, no stat changes";
}
