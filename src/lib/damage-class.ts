import type { PokemonType } from "@/db/schema";

export type DamageClass = "physical" | "special" | "status";

/**
 * In Gen 3 a move's damage class comes from its type, not the move itself
 * (the per-move split arrived in Gen 4). So Shadow Ball is physical and
 * Crunch is special.
 */
const SPECIAL_TYPES: ReadonlySet<PokemonType> = new Set([
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
]);

export function damageClass(move: {
  type: PokemonType;
  power: number;
}): DamageClass {
  if (move.power === 0) return "status";
  return SPECIAL_TYPES.has(move.type) ? "special" : "physical";
}
