import { Link, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { Sprite } from "@/components/sprite";
import { SearchField, SectionTitle, TABULAR } from "@/components/ui";
import { useDb } from "@/db";
import { listPlaces, listPokemon, type PlaceListItem } from "@/db/queries";
import { GAME_INFO } from "@/lib/games";
import { PLACE_KIND_TITLES, type PlaceKind } from "@/lib/places";
import { useCurrentGame } from "@/state/current-game";
import { useColors } from "@/theme/theme";

/** Sprites shown per row before "+N". */
const PREVIEW = 4;

/**
 * Every place with Pokémon in the current game: routes, towns, caves.
 * Search by a place's name, or by a Pokémon's to see where it lives.
 */
export default function PlacesScreen() {
  const db = useDb();
  const { game } = useCurrentGame();
  const [query, setQuery] = useState("");
  const places = useMemo(() => listPlaces(db, game), [db, game]);
  const names = useMemo(
    () => new Map(listPokemon(db).map((p) => [p.id, p.name])),
    [db],
  );

  const q = query.trim().toLowerCase();
  // A query that names a Pokémon also finds the places it lives in.
  const matchingIds = q
    ? [...names]
        .filter(([, n]) => n.toLowerCase().includes(q))
        .map(([id]) => id)
    : [];
  const shown = q
    ? places.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.pokemonIds.some((id) => matchingIds.includes(id)),
      )
    : places;
  const sections = (["route", "town", "other"] as PlaceKind[])
    .map((kind) => ({
      kind,
      title: PLACE_KIND_TITLES[kind],
      data: shown.filter((p) => p.kind === kind),
    }))
    .filter((s) => s.data.length > 0);

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Wild Pokémon" }} />
      <SectionList
        sections={sections}
        keyExtractor={(p) => String(p.id)}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // NativeWind doesn't style a SectionList's content container on web.
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
        ListHeaderComponent={
          <View className="gap-3 pb-2 pt-2">
            <GamePicker />
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Place or Pokémon"
              clearable
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="pb-2 pt-5">
            <SectionTitle>{section.title}</SectionTitle>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <PlaceRow
            place={item}
            first={index === 0}
            last={index === section.data.length - 1}
            highlight={matchingIds}
          />
        )}
        ListEmptyComponent={
          <Text className="p-8 text-center text-body text-ink-muted">
            {q
              ? `Nothing in ${GAME_INFO[game].name} matches “${query}”.`
              : `No places with Pokémon in ${GAME_INFO[game].name}.`}
          </Text>
        }
      />
    </View>
  );
}

/** One place: its name and a strip of the Pokémon found there. */
function PlaceRow({
  place,
  first,
  last,
  highlight,
}: {
  place: PlaceListItem;
  first: boolean;
  last: boolean;
  /** Searched-for Pokémon, shown first in the strip. */
  highlight: number[];
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
