import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import type { PokemonListItem } from "@/db/queries";
import { useColors } from "@/theme/theme";

import { PokeballMark } from "./pokeball-mark";
import { dexNumber, useTypeGradient } from "./pokemon-row";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";

/** One Pokémon in the wide-screen grid: a tile that opens its page. */
export function PokemonCard({
  pokemon,
  width,
}: {
  pokemon: PokemonListItem;
  width: number;
}) {
  const colors = useColors();
  const gradient = useTypeGradient(pokemon);
  return (
    <Link
      href={{ pathname: "/pokemon/[id]", params: { id: pokemon.id } }}
      asChild
    >
      <Pressable
        android_ripple={{ color: colors.sunken, foreground: true }}
        className="overflow-hidden rounded-card active:opacity-80"
        style={{ width }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View className="items-center overflow-hidden py-2">
          <PokeballMark
            size={150}
            style={{ position: "absolute", right: -30, bottom: -30 }}
          />
          <Text className="self-start px-3 text-caption font-semibold text-ink-subtle">
            {dexNumber(pokemon.id)}
          </Text>
          {/* 2× keeps the pixel art evenly scaled. */}
          <Sprite id={pokemon.id} size={128} />
        </View>
        <View className="items-center gap-2 px-2 py-3">
          <Text className="text-headline font-bold text-ink" numberOfLines={1}>
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
