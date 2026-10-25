import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { PokemonListItem } from "@/db/queries";
import { useColors } from "@/theme/theme";

import { Sprite } from "./sprite";
import { TYPE_TINT, TypeBadge } from "./type-badge";

const ROW_HEIGHT = 88;

export function dexNumber(id: number) {
  return `#${String(id).padStart(3, "0")}`;
}

/** One Pokémon in the phone list: a card row that opens its page. */
export function PokemonRow({ pokemon }: { pokemon: PokemonListItem }) {
  const colors = useColors();
  return (
    <View className="px-4 py-1" style={{ height: ROW_HEIGHT }}>
      {/* asChild: Link passes its press handling to the Pressable. */}
      <Link
        href={{ pathname: "/pokemon/[id]", params: { id: pokemon.id } }}
        asChild
      >
        <Pressable
          android_ripple={{ color: colors.sunken, foreground: true }}
          className="flex-1 flex-row items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface px-2 active:opacity-80"
        >
          <View
            className={`h-16 w-16 items-center justify-center rounded-xl ${TYPE_TINT[pokemon.type1]}`}
          >
            <Sprite id={pokemon.id} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-semibold text-ink-subtle">
              {dexNumber(pokemon.id)}
            </Text>
            <Text className="text-lg font-bold text-ink">{pokemon.name}</Text>
          </View>
          <View className="gap-1 pr-2">
            <TypeBadge type={pokemon.type1} />
            {pokemon.type2 && <TypeBadge type={pokemon.type2} />}
          </View>
        </Pressable>
      </Link>
    </View>
  );
}
