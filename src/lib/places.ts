import type { EncounterMethod, StaticEncounterKind } from "@/db/schema";

/** Words for the encounter tables and one-time encounters, shared by screens. */

export const METHOD_LABELS: Record<EncounterMethod, string> = {
  grass: "Walking",
  surf: "Surfing",
  "rock-smash": "Rock Smash",
  "old-rod": "Old Rod",
  "good-rod": "Good Rod",
  "super-rod": "Super Rod",
};

export const KIND_LABELS: Record<StaticEncounterKind, string> = {
  starter: "Starter",
  gift: "Gift",
  egg: "Egg",
  static: "One-time",
  roaming: "Roaming",
  trade: "Trade",
  prize: "Prize",
};

/**
 * Maps the game data has but the game never uses: Emerald keeps Ruby and
 * Sapphire's old Cave of Origin rooms and their encounter tables, which
 * can't be reached.
 */
export function isUnusedMap(key: string): boolean {
  return key.includes("UNUSED");
}

export type PlaceKind = "route" | "town" | "other";

/** Routes, towns and cities (including the Sevii Islands' towns), the rest. */
export function placeKind(key: string, name: string): PlaceKind {
  if (/^MAP_ROUTE\d+$/.test(key)) return "route";
  if (/\b(City|Town|Island)$/.test(name)) return "town";
  return "other";
}

export const PLACE_KIND_TITLES: Record<PlaceKind, string> = {
  route: "Routes",
  town: "Towns and cities",
  other: "Caves, forests and more",
};

/** Natural order: "Route 2" before "Route 10", "Mt. Pyre 2F" before "6F". */
export function comparePlaceNames(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** "Lv 25 · Holds Mystic Water", "Trade for Ralts · Nicknamed Dots"… */
export function staticDetails(e: {
  kind: StaticEncounterKind;
  level: number | null;
  count: number;
  heldItem: string | null;
  tradeFor: string | null;
  nickname: string | null;
}): string {
  const parts: string[] = [];
  if (e.kind === "trade") {
    parts.push(`Trade for ${e.tradeFor}`);
    if (e.nickname) parts.push(`Nicknamed ${e.nickname}`);
  } else if (e.kind === "egg") {
    parts.push(`Hatches at Lv ${e.level}`);
  } else {
    parts.push(`Lv ${e.level}`);
  }
  if (e.count > 1) parts.push(`${e.count} of them`);
  if (e.heldItem) parts.push(`Holds ${e.heldItem}`);
  return parts.join(" · ");
}
