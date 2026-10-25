import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { MovesPage } from "@/components/pokemon/moves-page";
import { OverviewPage } from "@/components/pokemon/overview-page";
import { SwipeTabs } from "@/components/swipe-tabs";
import { useDb } from "@/db";
import { getLearnset, getPokedexEntries, getPokemonDetail } from "@/db/queries";
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

  if (!pokemon) {
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
        ]}
      />
    </View>
  );
}
