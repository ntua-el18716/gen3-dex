import type { LearnMethod } from "@/db/schema";

/** Words for the move, ability and item pages. */

export const LEARN_METHOD_LABELS: Record<LearnMethod, string> = {
  level: "Level up",
  machine: "TM/HM",
  tutor: "Tutor",
  egg: "Egg",
};

/** Who a move hits (pret MOVE_TARGET_…), as it plays out in a battle. */
const TARGET_LABELS: Record<string, string> = {
  MOVE_TARGET_SELECTED: "One target",
  MOVE_TARGET_USER: "Self",
  MOVE_TARGET_BOTH: "Both foes",
  MOVE_TARGET_FOES_AND_ALLY: "Everyone else",
  MOVE_TARGET_RANDOM: "A random foe",
  MOVE_TARGET_OPPONENTS_FIELD: "Foes' side",
  MOVE_TARGET_DEPENDS: "Varies",
};

export const targetLabel = (target: string) => TARGET_LABELS[target] ?? null;

/** "+1", "−6": a move's priority (0 → null). */
export function priorityLabel(priority: number): string | null {
  if (priority === 0) return null;
  return priority > 0 ? `Priority +${priority}` : `Priority −${-priority}`;
}

export const POCKET_LABELS = {
  items: "Items",
  "poke-balls": "Poké Balls",
  "tms-hms": "TMs & HMs",
  berries: "Berries",
  "key-items": "Key Items",
} as const;

/** Wild Pokémon hold their common item 50% of the time, their rare one 5%. */
export const HELD_CHANCE = { common: 50, rare: 5 } as const;

/**
 * An item's price as the shop shows it, and what a shop pays (half). 0
 * means it isn't sold, and can't be sold.
 */
export function priceText(price: number): string {
  if (price === 0) return "Not sold in shops";
  return `Buy ₽${price.toLocaleString("en")} · Sells for ₽${Math.floor(price / 2).toLocaleString("en")}`;
}
