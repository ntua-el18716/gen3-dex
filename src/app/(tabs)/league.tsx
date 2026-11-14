import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { TrainerCard } from "@/components/league/trainer-card";
import { ScreenHeader } from "@/components/screen-header";
import { Sprite } from "@/components/sprite";
import { Label, SectionTitle } from "@/components/ui";
import { useDb } from "@/db";
import { getTrainerTeams, pickForStarter } from "@/db/league-queries";
import { GAME_INFO } from "@/lib/games";
import { leagueFor, REGION, STARTERS, type Region } from "@/lib/league";
import { readPreference, writePreference } from "@/lib/preferences";
import { useCurrentGame } from "@/state/current-game";

/** Your starter decides your rival's team; remembered per region. */
function useStarter(region: Region) {
  const key = `starter.${region}`;
  const [starters, setStarters] = useState<Record<Region, number>>(() => ({
    hoenn: Number(readPreference("starter.hoenn")) || STARTERS.hoenn[0]!,
    kanto: Number(readPreference("starter.kanto")) || STARTERS.kanto[0]!,
  }));
  const setStarter = (id: number) => {
    setStarters((s) => ({ ...s, [region]: id }));
    writePreference(key, String(id));
  };
  return [starters[region], setStarter] as const;
}

/** Gym Leaders, Elite Four, Champion and rivals of the current game. */
export default function LeagueScreen() {
  const db = useDb();
  const { game } = useCurrentGame();
  const region = REGION[game];
  const [starter, setStarter] = useStarter(region);

  const sections = useMemo(() => leagueFor(game), [game]);
  const teams = useMemo(
    () =>
      getTrainerTeams(
        db,
        game,
        sections.flatMap((s) =>
          s.trainers.flatMap((t) => t.variants.flatMap((v) => v.keys)),
        ),
      ),
    [db, game, sections],
  );
  const pick = (keys: string[]) =>
    pickForStarter(
      keys.map((k) => teams.get(k)).filter((t) => t !== undefined),
      starter,
    );

  return (
    <ScrollView contentContainerClassName="pb-10">
      <ScreenHeader
        title="League"
        subtitle={`Every team you face in ${GAME_INFO[game].name}`}
      >
        <GamePicker />
      </ScreenHeader>
      <View className="gap-7 px-4 pt-2">
        {sections.map((section) => (
          <View key={section.title} className="gap-2">
            <SectionTitle
              action={
                section.kind === "rival" && (
                  <StarterPicker
                    region={region}
                    value={starter}
                    onChange={setStarter}
                  />
                )
              }
            >
              {section.title}
            </SectionTitle>
            {section.trainers.map((entry, i) => (
              <TrainerCard
                key={`${game}-${section.title}-${i}`}
                entry={entry}
                kind={section.kind}
                pick={pick}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function StarterPicker({
  region,
  value,
  onChange,
}: {
  region: Region;
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Label className="mr-1">Your starter</Label>
      {STARTERS[region].map((id) => {
        const on = id === value;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            role="radio"
            aria-checked={on}
            className={`h-10 w-10 items-center justify-center rounded-full border-2 active:opacity-60 ${
              on ? "border-accent bg-surface" : "border-transparent bg-sunken"
            }`}
          >
            <Sprite id={id} size={36} />
          </Pressable>
        );
      })}
    </View>
  );
}
