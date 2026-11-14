import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { TeamCard } from "@/components/teams/team-card";
import { IconButton, SectionTitle } from "@/components/ui";
import { purposeName } from "@/lib/team-labels";
import { TEAM_PURPOSES } from "@/lib/teams";
import { useCurrentGame } from "@/state/current-game";
import { useTeams } from "@/state/teams";

/** The user's saved teams, grouped by what they're for. */
export default function TeamsScreen() {
  const { teams, createTeam } = useTeams();
  const { game } = useCurrentGame();
  const create = () =>
    router.push({ pathname: "/teams/[id]", params: { id: createTeam(game) } });

  return (
    <ScrollView contentContainerClassName="pb-10">
      <ScreenHeader
        title="Teams"
        subtitle="Your teams for playthroughs and the Frontier"
        actions={
          <IconButton
            name={{ ios: "plus", android: "add", web: "add" }}
            label="New team"
            onPress={create}
          />
        }
      />
      {teams.length === 0 ? (
        <View className="items-center gap-4 px-8 pt-16">
          <Text className="text-center text-body text-ink-muted">
            Save the teams you play with: each Pokémon’s moves, item, nature,
            EVs and IVs, with its real stats.
          </Text>
          <Pressable
            onPress={create}
            role="button"
            className="h-11 justify-center rounded-tile bg-accent px-5 active:opacity-60"
          >
            <Text className="text-body font-semibold text-on-accent">
              Create a team
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-7 px-4 pt-2">
          {TEAM_PURPOSES.map((purpose) => {
            const group = teams.filter((t) => t.purpose === purpose);
            if (group.length === 0) return null;
            return (
              <View key={purpose} className="gap-2">
                <SectionTitle>{purposeName(purpose)}</SectionTitle>
                {group.map((t) => (
                  <TeamCard key={t.id} team={t} />
                ))}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
