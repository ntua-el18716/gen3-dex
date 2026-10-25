import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { EvolutionPage } from "@/components/pokemon/evolution-page";
import { LocationsPage } from "@/components/pokemon/locations-page";
import { MovesPage } from "@/components/pokemon/moves-page";
import { OverviewPage } from "@/components/pokemon/overview-page";
import { SwipeTabs } from "@/components/swipe-tabs";
import { useDb } from "@/db";
import {
  getEvolutionChain,
  getLearnset,
  getLocations,
  getPokedexEntries,
  getPokemonDetail,
  getWildGames,
} from "@/db/queries";
import { useCurrentGame } from "@/state/current-game";

export default function PokemonScreen() {
  // The [id] in the file name: /pokemon/25 gives { id: "25" }.
  const { id } = useLocalSearchParams<{ id: string }>();
  const dexNumber = Number(id);
  const db = useDb();
  const { game } = useCurrentGame();

  const pokemon = useMemo(
    () => getPokemonDetail(db, dexNumber, game),
    [db, dexNumber, game],
  );
  const entries = useMemo(
    () => getPokedexEntries(db, dexNumber),
    [db, dexNumber],
  );
  const learnset = useMemo(
    () => getLearnset(db, dexNumber, game),
    [db, dexNumber, game],
  );
  const chain = useMemo(
    () => (pokemon ? getEvolutionChain(db, dexNumber) : null),
    [db, dexNumber, pokemon],
  );
  const places = useMemo(
    () => getLocations(db, dexNumber, game),
    [db, dexNumber, game],
  );
  const wildIn = useMemo(() => getWildGames(db, dexNumber), [db, dexNumber]);

  if (!pokemon || !chain) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Not found" }} />
        <Text className="text-ink-muted">No Pokémon #{id}.</Text>
      </View>
    );
  }

  return (
    // On big screens, a centred column of comfortable reading width.
    <View className="w-full max-w-3xl flex-1 self-center">
      <Stack.Screen options={{ title: pokemon.name }} />
      <View className="px-4 pt-3">
        <GamePicker />
      </View>
      <SwipeTabs
        // A new Pokémon (e.g. opened from its evolution line) starts on the
        // first page again.
        key={dexNumber}
        tabs={[
          {
            title: "Overview",
            content: (
              <OverviewPage pokemon={pokemon} entries={entries} game={game} />
            ),
          },
          {
            title: "Moves",
            content: <MovesPage sections={learnset} game={game} />,
          },
          {
            title: "Evolution",
            content: <EvolutionPage chain={chain} currentId={dexNumber} />,
          },
          {
            title: "Locations",
            content: (
              <LocationsPage places={places} game={game} wildIn={wildIn} />
            ),
          },
        ]}
      />
    </View>
  );
}
