import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Sprite } from "@/components/sprite";
import { TypeDot } from "@/components/type-badge";
import type { PokemonType } from "@/db/schema";

/**
 * A Pokémon in a list (who learns a move, has an ability, holds an item):
 * sprite, name, types, an optional line under the name and something on
 * the right. Rows join into one card: `first` and `last` round its ends.
 */
export function PokemonLinkRow({
  pokemonId,
  name,
  type1,
  type2,
  sub,
  right,
  first,
  last,
}: {
  pokemonId: number;
  name: string;
  type1: PokemonType;
  type2: PokemonType | null;
  sub?: string | null;
  right?: ReactNode;
  first: boolean;
  last: boolean;
}) {
  return (
    <Link
      href={{ pathname: "/pokemon/[id]", params: { id: pokemonId } }}
      asChild
    >
      <Pressable
        className={`flex-row items-center gap-3 bg-surface py-1.5 pl-2 pr-4 active:bg-sunken ${
          first ? "rounded-t-card pt-2.5" : ""
        } ${last ? "rounded-b-card pb-2.5" : "border-b border-line"}`}
      >
        <Sprite id={pokemonId} size={44} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="shrink text-body font-semibold text-ink"
              numberOfLines={1}
            >
              {name}
            </Text>
            <TypeDot type={type1} size={16} />
            {type2 && <TypeDot type={type2} size={16} />}
          </View>
          {sub ? (
            <Text className="text-caption text-ink-subtle">{sub}</Text>
          ) : null}
        </View>
        {right}
      </Pressable>
    </Link>
  );
}
