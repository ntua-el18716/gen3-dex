import { Text, View } from "react-native";

import type { PokemonType } from "@/db/schema";

// Tailwind only generates classes it finds written out in full, so the class
// names can't be built with a template string.
const BACKGROUND: Record<PokemonType, string> = {
  normal: "bg-type-normal",
  fighting: "bg-type-fighting",
  flying: "bg-type-flying",
  poison: "bg-type-poison",
  ground: "bg-type-ground",
  rock: "bg-type-rock",
  bug: "bg-type-bug",
  ghost: "bg-type-ghost",
  steel: "bg-type-steel",
  "???": "bg-type-mystery",
  fire: "bg-type-fire",
  water: "bg-type-water",
  grass: "bg-type-grass",
  electric: "bg-type-electric",
  psychic: "bg-type-psychic",
  ice: "bg-type-ice",
  dragon: "bg-type-dragon",
  dark: "bg-type-dark",
};

/** A faint wash of the type's colour, for backgrounds behind sprites. */
export const TYPE_TINT: Record<PokemonType, string> = {
  normal: "bg-type-normal/20",
  fighting: "bg-type-fighting/20",
  flying: "bg-type-flying/20",
  poison: "bg-type-poison/20",
  ground: "bg-type-ground/20",
  rock: "bg-type-rock/20",
  bug: "bg-type-bug/20",
  ghost: "bg-type-ghost/20",
  steel: "bg-type-steel/20",
  "???": "bg-type-mystery/20",
  fire: "bg-type-fire/20",
  water: "bg-type-water/20",
  grass: "bg-type-grass/20",
  electric: "bg-type-electric/20",
  psychic: "bg-type-psychic/20",
  ice: "bg-type-ice/20",
  dragon: "bg-type-dragon/20",
  dark: "bg-type-dark/20",
};

export function TypeBadge({
  type,
  small = false,
}: {
  type: PokemonType;
  /** Narrower and smaller text, for move lists and cards. */
  small?: boolean;
}) {
  return (
    <View
      className={`items-center rounded-full ${
        small ? "w-14 py-px" : "w-20 py-0.5"
      } ${BACKGROUND[type]}`}
    >
      <Text
        className={`font-bold uppercase tracking-wide text-white ${
          small ? "text-[10px]" : "text-xs"
        }`}
      >
        {type}
      </Text>
    </View>
  );
}
