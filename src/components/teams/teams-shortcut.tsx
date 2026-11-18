import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Divider, SectionTitle } from "@/components/ui";
import type { Game } from "@/db/schema";
import { isFrontier, type TeamPurpose } from "@/lib/teams";
import { useTeams } from "@/state/teams";

import { TeamCard } from "./team-card";

/**
 * "Your teams" for one purpose, where they're useful: on a Frontier
 * facility's screen, or on the League tab (walkthrough teams of the game).
 */
export function TeamsShortcut({
  purpose,
  game,
}: {
  purpose: TeamPurpose;
  /** The game new and listed walkthrough teams belong to. */
  game: Game;
}) {
  const { teams, createTeam } = useTeams();
  const mine = teams.filter(
    (t) => t.purpose === purpose && (isFrontier(purpose) || t.game === game),
  );
  const create = () =>
    router.push({
      pathname: "/teams/[id]",
      params: { id: createTeam(game, purpose) },
    });
  return (
    <View>
      <SectionTitle
        action={
          <Pressable
            onPress={create}
            role="button"
            hitSlop={8}
            className="active:opacity-60"
          >
            <Text className="text-body font-semibold text-accent">
              New team
            </Text>
          </Pressable>
        }
      >
        Your teams
      </SectionTitle>
      {mine.length === 0 ? (
        <Text className="px-1 pt-2 text-callout text-ink-muted">
          Nothing saved for this yet.
        </Text>
      ) : (
        mine.map((t, i) => (
          <View key={t.id}>
            {i > 0 && <Divider />}
            <TeamCard team={t} />
          </View>
        ))
      )}
    </View>
  );
}
