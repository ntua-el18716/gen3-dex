import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";

import { Sprite } from "@/components/sprite";
import { TABULAR } from "@/components/ui";
import type { PlaceListItem } from "@/db/queries";
import { useColors } from "@/theme/theme";

/** Sprites shown per row before "+N". */
const PREVIEW = 4;

/** One place: its name and a strip of the Pokémon found there. */
export function PlaceRow({
  place,
  first,
  last,
  highlight = [],
}: {
  place: PlaceListItem;
  first: boolean;
  last: boolean;
  /** Searched-for Pokémon, shown first in the strip. */
  highlight?: number[];
}) {
  const colors = useColors();
  const ids = [
    ...place.pokemonIds.filter((id) => highlight.includes(id)),
    ...place.pokemonIds.filter((id) => !highlight.includes(id)),
  ];
  return (
    <Link href={{ pathname: "/places/[id]", params: { id: place.id } }} asChild>
      <Pressable
        className={`flex-row items-center gap-3 bg-surface py-2 pl-4 pr-3 active:bg-sunken ${
          first ? "rounded-t-card pt-3" : ""
        } ${last ? "rounded-b-card pb-3" : "border-b border-line"}`}
      >
        <View className="flex-1 gap-0.5">
          <Text className="text-body font-semibold text-ink" numberOfLines={1}>
            {place.name}
          </Text>
          <Text className="text-caption text-ink-muted" style={TABULAR}>
            {place.pokemonIds.length} Pokémon
          </Text>
        </View>
        <View className="flex-row items-center">
          {ids.slice(0, PREVIEW).map((id) => (
            <Sprite key={id} id={id} size={36} />
          ))}
          {ids.length > PREVIEW && (
            <Text
              className="ml-1 w-7 text-caption text-ink-subtle"
              style={TABULAR}
            >
              +{ids.length - PREVIEW}
            </Text>
          )}
        </View>
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          tintColor={colors["ink-subtle"]}
          size={18}
        />
      </Pressable>
    </Link>
  );
}
