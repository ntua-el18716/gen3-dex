import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { GamePicker } from "@/components/game-picker";
import { PokemonCard } from "@/components/pokemon-card";
import { PokemonRow } from "@/components/pokemon-row";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/ui";
import { useDb } from "@/db";
import { listPokemon } from "@/db/queries";
import { GAME_INFO } from "@/lib/games";
import { useCurrentGame } from "@/state/current-game";
import { useListLayout, type ListLayout } from "@/state/list-layout";
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
  const { game } = useCurrentGame();
  const all = useMemo(() => listPokemon(db), [db]);
  const [query, setQuery] = useState("");
  const { layout, setLayout } = useListLayout();

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

  const count =
    shown.length === all.length
      ? `${all.length} Pokémon`
      : `${shown.length} of ${all.length}`;

  return (
    <View className="flex-1">
      {/* Outside the list, so search stays in reach while scrolling. */}
      <View className="self-center" style={{ width: contentWidth }}>
        <ScreenHeader
          title="Pokédex"
          subtitle={`${count} in ${GAME_INFO[game].name}`}
          actions={
            columns === 1 && (
              <LayoutToggle layout={layout} onChange={setLayout} />
            )
          }
        >
          {/* Wide screens: search and game picker share a row. */}
          <View
            className={
              columns > 1 ? "flex-row-reverse items-center gap-3" : "gap-3"
            }
          >
            <View className={columns > 1 ? "w-80" : ""}>
              <GamePicker />
            </View>
            <SearchBox
              value={query}
              onChange={setQuery}
              className={columns > 1 ? "flex-1" : ""}
            />
          </View>
        </ScreenHeader>
      </View>
      <FlatList
        // numColumns can't change on a mounted list, so remount when it does.
        key={columns}
        data={shown}
        numColumns={columns}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) =>
          columns === 1 ? (
            <PokemonRow pokemon={item} layout={layout} />
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
          paddingTop: 4,
          paddingBottom: 24,
          gap: columns > 1 ? GAP : 0,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text className="p-8 text-center text-body text-ink-muted">
            No Pokémon match “{query}”.
          </Text>
        }
      />
    </View>
  );
}

/** A search field with a magnifier and a clear button. */
function SearchBox({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (text: string) => void;
  className?: string;
}) {
  const colors = useColors();
  return (
    <View
      className={`h-11 flex-row items-center gap-2 rounded-tile bg-sunken px-3 ${className}`}
    >
      <SymbolView
        name={{ ios: "magnifyingglass", android: "search", web: "search" }}
        tintColor={colors["ink-subtle"]}
        size={20}
      />
      <TextInput
        className="h-11 flex-1 text-body text-ink outline-none"
        placeholder="Name or number"
        placeholderTextColor={colors["ink-subtle"]}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value !== "" && (
        <Pressable
          onPress={() => onChange("")}
          aria-label="Clear search"
          role="button"
          hitSlop={8}
        >
          <SymbolView
            name={{
              ios: "xmark.circle.fill",
              android: "cancel",
              web: "cancel",
            }}
            tintColor={colors["ink-subtle"]}
            size={20}
          />
        </Pressable>
      )}
    </View>
  );
}

/** Header button that moves the list's sprites to the other side. */
function LayoutToggle({
  layout,
  onChange,
}: {
  layout: ListLayout;
  onChange: (layout: ListLayout) => void;
}) {
  const next = layout === "sprite-right" ? "sprite-left" : "sprite-right";
  return (
    <IconButton
      name={{
        ios: "arrow.left.arrow.right",
        android: "swap_horiz",
        web: "swap_horiz",
      }}
      label={`Show sprites on the ${next === "sprite-left" ? "left" : "right"}`}
      onPress={() => onChange(next)}
    />
  );
}
