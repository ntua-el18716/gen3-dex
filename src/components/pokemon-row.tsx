import { Image, Text, View } from "react-native";

import type { PokemonListItem } from "@/db/queries";
import { frontSprites } from "@/generated/sprites";

import { TypeBadge } from "./type-badge";

/** Fixed so the list can skip measuring rows (FlatList getItemLayout). */
export const POKEMON_ROW_HEIGHT = 72;

export function PokemonRow({ pokemon }: { pokemon: PokemonListItem }) {
  return (
    <View
      className="flex-row items-center gap-3 border-b border-neutral-200 bg-white px-4"
      style={{ height: POKEMON_ROW_HEIGHT }}
    >
      {/* Sprites are 64×64; showing them at native size keeps the pixels sharp. */}
      <Image
        source={frontSprites[pokemon.id]}
        style={{ width: 64, height: 64 }}
      />
      <View className="flex-1">
        <Text className="text-xs text-neutral-500">
          #{String(pokemon.id).padStart(3, "0")}
        </Text>
        <Text className="text-base font-semibold text-neutral-900">
          {pokemon.name}
        </Text>
      </View>
      <View className="gap-1">
        <TypeBadge type={pokemon.type1} />
        {pokemon.type2 && <TypeBadge type={pokemon.type2} />}
      </View>
    </View>
  );
}
