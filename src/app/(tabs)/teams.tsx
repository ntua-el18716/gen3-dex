import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PokeballMark } from "@/components/pokeball-mark";
import { ScreenHeader } from "@/components/screen-header";
import { TeamCard } from "@/components/teams/team-card";
import { Divider, IconButton, SectionTitle } from "@/components/ui";
import { purposeName } from "@/lib/team-labels";
import { TEAM_PURPOSES } from "@/lib/teams";
import { useCurrentGame } from "@/state/current-game";
import { useTeams } from "@/state/teams";
import { useColors } from "@/theme/theme";

/** The user's saved teams, grouped by what they're for. */
export default function TeamsScreen() {
  const { teams, createTeam } = useTeams();
  const { game } = useCurrentGame();
  const colors = useColors();
  const create = () =>
    router.push({ pathname: "/teams/[id]", params: { id: createTeam(game) } });

  return (
    <ScrollView contentContainerClassName="pb-10">
      <ScreenHeader
        title="Teams"
        subtitle="Your teams for playthroughs and the Frontier"
        actions={
          <>
            <IconButton
              name={{
                ios: "square.and.arrow.down",
                android: "download",
                web: "download",
              }}
              label="Import teams"
              onPress={() => router.push("/teams/import")}
            />
            <IconButton
              name={{ ios: "plus", android: "add", web: "add" }}
              label="New team"
              onPress={create}
            />
          </>
        }
      />
      {teams.length === 0 ? (
        <View className="items-center gap-2 px-8 pt-10">
          <PokeballMark size={132} opacity={0.08} />
          <Text className="mt-4 text-title font-bold tracking-tight text-ink">
            No teams yet
          </Text>
          <Text className="text-center text-body text-ink-muted">
            Save the teams you play with: every Pokémon’s moves, item, nature,
            EVs and IVs, with its real stats.
          </Text>
          <Pressable
            onPress={() => router.push("/teams/import")}
            role="button"
            className="h-11 justify-center active:opacity-60"
          >
            <Text className="text-body font-semibold text-accent">
              Or import from text
            </Text>
          </Pressable>
          <Pressable
            onPress={create}
            role="button"
            className="mt-4 h-12 flex-row items-center gap-2 rounded-full bg-accent pl-4 pr-5 active:opacity-60"
          >
            <SymbolView
              name={{ ios: "plus", android: "add", web: "add" }}
              tintColor={colors["on-accent"]}
              size={20}
            />
            <Text className="text-body font-semibold text-on-accent">
              Create a team
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-5 px-4 pt-2">
          {TEAM_PURPOSES.map((purpose) => {
            const group = teams.filter((t) => t.purpose === purpose);
            if (group.length === 0) return null;
            return (
              <View key={purpose}>
                <SectionTitle>{purposeName(purpose)}</SectionTitle>
                {group.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 && <Divider />}
                    <TeamCard team={t} />
                  </View>
                ))}
              </View>
            );
          })}
          <Pressable
            onPress={() => router.push("/teams/backup")}
            role="button"
            className="h-11 items-center justify-center active:opacity-60"
          >
            <Text className="text-body font-semibold text-accent">
              Back up all teams
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
