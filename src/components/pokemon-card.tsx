import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { PokemonListItem } from "@/db/queries";
import { useColors } from "@/theme/theme";

import { dexNumber } from "./pokemon-row";
import { Sprite } from "./sprite";
import { TYPE_TINT, TypeBadge } from "./type-badge";

/** One Pokémon in the wide-screen grid: a tile that opens its page. */
export function PokemonCard({
  pokemon,
  width,
}: {
  pokemon: PokemonListItem;
  width: number;
}) {
  const colors = useColors();
  return (
    <Link
      href={{ pathname: "/pokemon/[id]", params: { id: pokemon.id } }}
      asChild
    >
      <Pressable
        android_ripple={{ color: colors.sunken, foreground: true }}
        className="overflow-hidden rounded-2xl border border-line bg-surface active:opacity-80"
        style={{ width }}
      >
        <View className={`items-center py-2 ${TYPE_TINT[pokemon.type1]}`}>
          <Text className="self-start px-3 text-xs font-semibold text-ink-muted">
            {dexNumber(pokemon.id)}
          </Text>
          {/* 2× keeps the pixel art evenly scaled. */}
          <Sprite id={pokemon.id} size={128} />
        </View>
        <View className="items-center gap-2 px-2 py-3">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>
            {pokemon.name}
          </Text>
          <View className="flex-row gap-1">
            <TypeBadge type={pokemon.type1} small />
            {pokemon.type2 && <TypeBadge type={pokemon.type2} small />}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
