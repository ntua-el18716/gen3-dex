import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { GamePicker } from "@/components/game-picker";
import { PokemonCard } from "@/components/pokemon-card";
import { PokemonRow } from "@/components/pokemon-row";
import { useDb } from "@/db";
import { listPokemon } from "@/db/queries";
import { useColors } from "@/theme/theme";

/** Content never gets wider than this, so big screens get margins. */
const MAX_WIDTH = 1200;
/** Below this width the list shows rows; above it, a grid of cards. */
const GRID_BREAKPOINT = 640;
const CARD_MIN_WIDTH = 176;
const GAP = 12;
const PADDING = 16;

export default function PokedexScreen() {
  const db = useDb();
  const colors = useColors();
  const all = useMemo(() => listPokemon(db), [db]);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter((p) => p.name.toLowerCase().includes(q) || String(p.id) === q)
    : all;

  // How many cards fit across, and how wide each one is.
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WIDTH);
  const columns =
    width < GRID_BREAKPOINT
      ? 1
      : Math.floor((contentWidth - 2 * PADDING + GAP) / (CARD_MIN_WIDTH + GAP));
  const cardWidth =
    (contentWidth - 2 * PADDING - (columns - 1) * GAP) / columns;

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Pokédex" }} />
      <FlatList
        // numColumns can't change on a mounted list, so remount when it does.
        key={columns}
        data={shown}
        numColumns={columns}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) =>
          columns === 1 ? (
            <PokemonRow pokemon={item} />
          ) : (
            <PokemonCard pokemon={item} width={cardWidth} />
          )
        }
        columnWrapperStyle={
          columns > 1 ? { gap: GAP, paddingHorizontal: PADDING } : undefined
        }
        contentContainerStyle={{
          width: contentWidth,
          alignSelf: "center",
          paddingBottom: 32,
          gap: columns > 1 ? GAP : 0,
        }}
        ListHeaderComponent={
          <View className="gap-3 px-4 pb-2 pt-3">
            {/* Wide screens: search and game picker share a row. */}
            <View
              className={
                columns > 1 ? "flex-row-reverse items-center gap-3" : "gap-3"
              }
            >
              <View className={columns > 1 ? "w-80" : ""}>
                <GamePicker />
              </View>
              <TextInput
                className={`rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink ${
                  columns > 1 ? "flex-1" : ""
                }`}
                placeholder="Search by name or number"
                placeholderTextColor={colors["ink-subtle"]}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              {shown.length === all.length
                ? `${all.length} Pokémon`
                : `${shown.length} of ${all.length}`}
            </Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text className="p-8 text-center text-ink-muted">
            No Pokémon match “{query}”.
          </Text>
        }
      />
    </View>
  );
}
