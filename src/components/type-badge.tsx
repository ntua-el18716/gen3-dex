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

export function TypeBadge({
  type,
  small = false,
}: {
  type: PokemonType;
  /** Narrower and smaller text, for move lists. */
  small?: boolean;
}) {
  return (
    <View
      className={`items-center rounded-full ${
        small ? "w-14 py-px" : "w-20 py-0.5"
      } ${BACKGROUND[type]}`}
    >
      <Text
        className={`font-bold uppercase text-white ${
          small ? "text-[10px]" : "text-xs"
        }`}
      >
        {type}
      </Text>
    </View>
  );
}
