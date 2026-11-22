import { Link } from "expo-router";
import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { TrainerCard } from "@/components/league/trainer-card";
import { ScreenHeader } from "@/components/screen-header";
import { Sprite } from "@/components/sprite";
import { TeamsShortcut } from "@/components/teams/teams-shortcut";
import { Divider, Label, SectionTitle } from "@/components/ui";
import { useDb } from "@/db";
import { getTrainerTeams, pickForStarter } from "@/db/league-queries";
import { GAME_INFO } from "@/lib/games";
import { leagueFor, REGION, STARTERS, type Region } from "@/lib/league";
import { readPreference, writePreference } from "@/lib/preferences";
import { useCurrentGame } from "@/state/current-game";
import { useColors } from "@/theme/theme";

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
        <TeamsShortcut purpose="walkthrough" game={game} />
        <PlacesLink />
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

/** Opens the Town Map and the list of places with their wild Pokémon. */
function PlacesLink() {
  return (
    <View className="overflow-hidden rounded-card bg-surface">
      <LinkRow
        href="/map"
        icon={{ ios: "map", android: "map", web: "map" }}
        title="Town Map"
        subtitle="Tap an area to see its Pokémon"
      />
      <Divider className="ml-[68px]" />
      <LinkRow
        href="/places"
        icon={{ ios: "list.bullet", android: "list", web: "list" }}
        title="Wild Pokémon by place"
        subtitle="Routes, caves and towns, with levels and rates"
      />
    </View>
  );
}

function LinkRow({
  href,
  icon,
  title,
  subtitle,
}: {
  href: "/map" | "/places";
  icon: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  title: string;
  subtitle: string;
}) {
  const colors = useColors();
  return (
    <Link href={href} asChild>
      <Pressable className="flex-row items-center gap-3 px-4 py-3.5 active:bg-sunken">
        <View className="h-10 w-10 items-center justify-center rounded-tile bg-accent">
          <SymbolView name={icon} tintColor={colors["on-accent"]} size={22} />
        </View>
        <View className="flex-1">
          <Text className="text-body font-semibold text-ink">{title}</Text>
          <Text className="text-caption text-ink-muted">{subtitle}</Text>
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
