import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CollapsiblePager } from "@/components/collapsible-pager";
import { EvolutionPage } from "@/components/pokemon/evolution-page";
import { heroMetrics, HeroHeader } from "@/components/pokemon/hero-header";
import { LocationsPage } from "@/components/pokemon/locations-page";
import { MovesPage } from "@/components/pokemon/moves-page";
import { OverviewPage } from "@/components/pokemon/overview-page";
import { useDb } from "@/db";
import {
  getEvolutionChain,
  getFoundGames,
  getLearnset,
  getLocations,
  getPokedexEntries,
  getPokemonDetail,
  getStaticEncounters,
} from "@/db/queries";
import { useCurrentGame } from "@/state/current-game";

/** On big screens the page is a centred column this wide. */
const MAX_WIDTH = 768;
const TABS = ["Overview", "Moves", "Evolution", "Where"];

export default function PokemonScreen() {
  // The [id] in the file name: /pokemon/25 gives { id: "25" }.
  const { id } = useLocalSearchParams<{ id: string }>();
  const dexNumber = Number(id);
  const db = useDb();
  const { game } = useCurrentGame();
  const insets = useSafeAreaInsets();
  const width = Math.min(useWindowDimensions().width, MAX_WIDTH);

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
  const oneTime = useMemo(
    () => getStaticEncounters(db, dexNumber, game),
    [db, dexNumber, game],
  );
  const foundIn = useMemo(() => getFoundGames(db, dexNumber), [db, dexNumber]);

  if (!pokemon || !chain) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Not found" }} />
        <Text className="text-ink-muted">No Pokémon #{id}.</Text>
      </View>
    );
  }

  const { height, collapse } = heroMetrics(insets.top);
  return (
    <View className="flex-1 self-center" style={{ width }}>
      {/* The hero header replaces the navigator's. */}
      <Stack.Screen options={{ headerShown: false, title: pokemon.name }} />
      <CollapsiblePager
        // A new Pokémon (e.g. opened from its evolution line) starts on the
        // first page, expanded.
        key={dexNumber}
        width={width}
        headerHeight={height}
        collapse={collapse}
        pages={[
          {
            key: "overview",
            content: (
              <OverviewPage pokemon={pokemon} entries={entries} game={game} />
            ),
          },
          {
            key: "moves",
            content: <MovesPage sections={learnset} game={game} />,
          },
          {
            key: "evolution",
            content: <EvolutionPage chain={chain} currentId={dexNumber} />,
          },
          {
            key: "where",
            content: (
              <LocationsPage
                places={places}
                oneTime={oneTime}
                game={game}
                foundIn={foundIn}
              />
            ),
          },
        ]}
        renderHeader={(props) => (
          <HeroHeader
            {...props}
            pokemon={pokemon}
            tabs={TABS}
            top={insets.top}
            width={width}
          />
        )}
      />
    </View>
  );
}
