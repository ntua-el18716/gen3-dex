import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Sprite } from "@/components/sprite";
import { Card } from "@/components/ui";
import { purposeLabel } from "@/lib/team-labels";
import { MAX_TEAM_SIZE, teamIssues, type Team } from "@/lib/teams";

import { PurposeIcon } from "./purpose-icon";

/**
 * A team in a list: what it's for, its name, and its party as six slots
 * (empty ones stay visible, so a half-built team reads as one).
 */
export function TeamCard({ team }: { team: Team }) {
  const blocked = team.members.length > 0 && teamIssues(team).length > 0;
  return (
    <Link href={{ pathname: "/teams/[id]", params: { id: team.id } }} asChild>
      <Pressable className="active:opacity-60">
        <Card className="gap-4 p-4">
          <View className="flex-row items-center gap-3">
            <PurposeIcon purpose={team.purpose} game={team.game} />
            <View className="flex-1 gap-0.5">
              <Text
                className="text-headline font-semibold text-ink"
                numberOfLines={1}
              >
                {team.name || "Untitled team"}
              </Text>
              <Text className="text-callout text-ink-muted" numberOfLines={1}>
                {purposeLabel(team)}
              </Text>
            </View>
            {blocked && (
              <View className="rounded-md bg-amber-500/20 px-2 py-0.5">
                <Text className="text-micro font-semibold text-amber-700 dark:text-amber-400">
                  Can’t enter yet
                </Text>
              </View>
            )}
          </View>
          <View className="flex-row justify-between">
            {Array.from({ length: MAX_TEAM_SIZE }, (_, i) => {
              const member = team.members[i];
              return (
                <View
                  key={i}
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    member ? "bg-sunken" : "border border-dashed border-line"
                  }`}
                >
                  {member && (
                    <Sprite id={member.pokemonId} size={44} game={team.game} />
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
