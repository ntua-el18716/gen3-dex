import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { PlaceRow } from "@/components/places/place-row";
import { Sprite } from "@/components/sprite";
import { TownMap } from "@/components/town-map";
import { Pills, SectionTitle } from "@/components/ui";
import { useDb } from "@/db";
import { getPokemonDetail, listPlaces } from "@/db/queries";
import { GAME_INFO } from "@/lib/games";
import { REGION } from "@/lib/league";
import {
  areaFor,
  areasAt,
  REGION_MAPS,
  type TownMapArea,
  type TownMapId,
} from "@/lib/town-map";
import { useCurrentGame } from "@/state/current-game";

/**
 * The game's Town Map. Tap an area to see its places and their Pokémon;
 * opened with `?pokemon=` it marks every area where that Pokémon is found.
 */
export default function MapScreen() {
  const params = useLocalSearchParams<{ pokemon?: string }>();
  const pokemonId = params.pokemon ? Number(params.pokemon) : null;
  const db = useDb();
  const { game } = useCurrentGame();
  const region = REGION[game];
  const maps = REGION_MAPS[region];
  const places = useMemo(() => listPlaces(db, game), [db, game]);
  const pokemon = useMemo(
    () => (pokemonId ? getPokemonDetail(db, pokemonId, game) : null),
    [db, pokemonId, game],
  );

  // Places by area; areas the game gives no spot are listed separately.
  const byArea = new Map<string, typeof places>();
  const offMap: typeof places = [];
  for (const p of places) {
    const area = areaFor(region, p.mapSection);
    if (!area) offMap.push(p);
    else byArea.set(area.key, [...(byArea.get(area.key) ?? []), p]);
  }
  const lives = (p: (typeof places)[number]) =>
    pokemonId !== null && p.pokemonIds.includes(pokemonId);
  const markedAreas = pokemonId
    ? [...byArea]
        .filter(([, ps]) => ps.some(lives))
        .map(([key]) => areaFor(region, key.split(":")[1]!)!)
    : [];

  const [chosenMap, setChosenMap] = useState<TownMapId | null>(null);
  // The map shown: the one picked, else the first with a marked area.
  const map: TownMapId =
    chosenMap && maps.some((m) => m.id === chosenMap)
      ? chosenMap
      : (markedAreas[0]?.map ?? maps[0]!.id);
  const [tapped, setTapped] = useState<TownMapArea[]>([]);
  const selected = tapped.filter(
    (a) => a.map === map && a.key.startsWith(region),
  );

  const onTapTile = (col: number, row: number) =>
    // Only areas that have places with Pokémon.
    setTapped(areasAt(region, map, col, row).filter((a) => byArea.has(a.key)));

  const title = pokemon ? `Where to find ${pokemon.name}` : "Town Map";
  const listed: { area: TownMapArea; places: typeof places }[] = selected.length
    ? selected.map((area) => ({ area, places: byArea.get(area.key)! }))
    : markedAreas
        .filter((a) => a.map === map)
        .map((area) => ({
          area,
          places: byArea.get(area.key)!.filter(lives),
        }));

  // Areas sharing a spot and a name (the seven Tanoby chambers) are one.
  const merged: typeof listed = [];
  for (const entry of listed) {
    const same = merged.find(
      (m) =>
        m.area.name === entry.area.name &&
        m.area.x === entry.area.x &&
        m.area.y === entry.area.y,
    );
    if (same) same.places = [...same.places, ...entry.places];
    else merged.push({ ...entry });
  }

  return (
    <ScrollView contentContainerClassName="gap-4 px-4 pb-12 pt-2">
      <Stack.Screen options={{ title }} />
      <GamePicker />
      {maps.length > 1 && (
        <Pills
          options={maps.map((m) => {
            const n = markedAreas.filter((a) => a.map === m.id).length;
            return { value: m.id, label: n ? `${m.label} · ${n}` : m.label };
          })}
          value={map}
          onChange={(id) => {
            setChosenMap(id);
            setTapped([]);
          }}
        />
      )}
      <TownMap
        map={map}
        marked={markedAreas.filter((a) => a.map === map)}
        selected={selected}
        onTapTile={onTapTile}
      />

      {pokemon && (
        <View className="flex-row items-center gap-3 px-1">
          <Sprite id={pokemon.id} size={40} />
          <Text className="flex-1 text-callout text-ink-muted">
            {markedAreas.length || offMap.some(lives)
              ? `${pokemon.name} is found in the marked areas in ${GAME_INFO[game].name}.`
              : `${pokemon.name} can't be caught or received in ${GAME_INFO[game].name}.`}
          </Text>
        </View>
      )}
      {!pokemon && selected.length === 0 && (
        <Text className="px-1 text-callout text-ink-muted">
          Tap a route, town or cave to see its Pokémon. Pinch or double-tap to
          zoom.
        </Text>
      )}

      {merged.map(({ area, places: ps }) => (
        <View key={area.key} className="gap-2">
          <SectionTitle>{area.name}</SectionTitle>
          <View>
            {ps.map((p, i) => (
              <PlaceRow
                key={p.id}
                place={p}
                first={i === 0}
                last={i === ps.length - 1}
                highlight={pokemonId ? [pokemonId] : []}
              />
            ))}
          </View>
        </View>
      ))}

      {selected.length === 0 &&
        offMap.filter((p) => !pokemonId || lives(p)).length > 0 && (
          <View className="gap-2">
            <SectionTitle>Not on the Town Map</SectionTitle>
            <View>
              {offMap
                .filter((p) => !pokemonId || lives(p))
                .map((p, i, all) => (
                  <PlaceRow
                    key={p.id}
                    place={p}
                    first={i === 0}
                    last={i === all.length - 1}
                    highlight={pokemonId ? [pokemonId] : []}
                  />
                ))}
            </View>
          </View>
        )}
    </ScrollView>
  );
}
