import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import type { PokemonListItem } from "@/db/queries";
import type { ListLayout } from "@/state/list-layout";
import { hexToRgb, mix, typeColor } from "@/theme/colors";
import { useColors, usePalette } from "@/theme/theme";

import { PokeballMark } from "./pokeball-mark";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";

/** Card height plus the gap around it; every row is exactly this tall. */
export const ROW_HEIGHT = 80;

export function dexNumber(id: number) {
  return `#${String(id).padStart(3, "0")}`;
}

/**
 * The card's background: its first type's colour fading into its second
 * (or a paler first), blended over the surface so it works in both themes.
 */
export function useTypeGradient(pokemon: PokemonListItem) {
  const { surface } = usePalette();
  return [
    mix(hexToRgb(typeColor(pokemon.type1)), surface, 0.3),
    mix(hexToRgb(typeColor(pokemon.type2 ?? pokemon.type1)), surface, 0.14),
  ] as const;
}

/** One Pokémon in the phone list: a card washed in its types' colours. */
export function PokemonRow({
  pokemon,
  layout,
}: {
  pokemon: PokemonListItem;
  layout: ListLayout;
}) {
  const colors = useColors();
  const gradient = useTypeGradient(pokemon);
  const left = layout === "sprite-left";
  return (
    <View className="px-4 py-1" style={{ height: ROW_HEIGHT }}>
      {/* asChild: Link passes its press handling to the Pressable. */}
      <Link
        href={{ pathname: "/pokemon/[id]", params: { id: pokemon.id } }}
        asChild
      >
        <Pressable
          android_ripple={{ color: colors.sunken, foreground: true }}
          className="flex-1 overflow-hidden rounded-[18px] active:opacity-80"
        >
          <LinearGradient
            colors={gradient}
            // The colour runs away from the sprite.
            start={left ? { x: 1, y: 0.3 } : { x: 0, y: 0.3 }}
            end={left ? { x: 0, y: 0.7 } : { x: 1, y: 0.7 }}
            style={{ position: "absolute", inset: 0 }}
          />
          <PokeballMark
            size={96}
            style={{
              position: "absolute",
              top: -12,
              [left ? "left" : "right"]: -16,
            }}
          />
          <View
            className={`flex-1 items-center ${left ? "flex-row-reverse pr-4" : "flex-row pl-4"}`}
          >
            <View className="flex-1 gap-1.5">
              <View
                className={`flex-row items-baseline gap-2 ${left ? "justify-between" : ""}`}
              >
                <Text
                  className="text-base font-black text-ink"
                  numberOfLines={1}
                >
                  {pokemon.name}
                </Text>
                <Text className="text-xs font-bold text-ink-subtle">
                  {dexNumber(pokemon.id)}
                </Text>
              </View>
              <View className="flex-row gap-1.5">
                <TypeBadge type={pokemon.type1} small />
                {pokemon.type2 && <TypeBadge type={pokemon.type2} small />}
              </View>
            </View>
            <View className="mx-2.5">
              <Sprite id={pokemon.id} size={72} />
            </View>
          </View>
        </Pressable>
      </Link>
    </View>
  );
}
