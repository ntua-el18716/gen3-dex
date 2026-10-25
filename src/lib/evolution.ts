import type { EvolutionMethod } from "@/db/schema";

/**
 * How an evolution happens, in words. `level` is the level for level-based
 * methods and the Beauty threshold for Feebas; `item` is the item's name.
 */
export function evolutionLabel(
  method: EvolutionMethod,
  level: number | null,
  item: string | null,
): string {
  switch (method) {
    case "level":
      return `Lv ${level}`;
    case "level-attack-gt-defense":
      return `Lv ${level}, Attack > Defense`;
    case "level-attack-eq-defense":
      return `Lv ${level}, Attack = Defense`;
    case "level-attack-lt-defense":
      return `Lv ${level}, Attack < Defense`;
    // Wurmple: which one depends on its personality value.
    case "level-silcoon":
    case "level-cascoon":
      return `Lv ${level}, depends on personality`;
    case "level-ninjask":
      return `Lv ${level}`;
    // Shedinja appears alongside Ninjask.
    case "level-shedinja":
      return `Lv ${level}, with a free party slot and a Poké Ball`;
    case "item":
      return `Use ${item}`;
    case "trade":
      return "Trade";
    case "trade-item":
      return `Trade holding ${item}`;
    case "friendship":
      return "Level up with high friendship";
    case "friendship-day":
      return "Level up with high friendship (day)";
    case "friendship-night":
      return "Level up with high friendship (night)";
    case "beauty":
      return `Level up with Beauty ≥ ${level}`;
  }
}
