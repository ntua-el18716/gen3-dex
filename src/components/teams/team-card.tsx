import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";

import { Sprite } from "@/components/sprite";
import { Card } from "@/components/ui";
import { purposeLabel } from "@/lib/team-labels";
import { teamIssues, type Team } from "@/lib/teams";
import { useColors } from "@/theme/theme";

/** A team in a list: name, what it's for, and its Pokémon. Opens the team. */
export function TeamCard({ team }: { team: Team }) {
  const colors = useColors();
  const issues = teamIssues(team).length;
  return (
    <Link href={{ pathname: "/teams/[id]", params: { id: team.id } }} asChild>
      <Pressable className="active:opacity-60">
        <Card className="gap-2 p-4">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text
                className="text-headline font-semibold text-ink"
                numberOfLines={1}
              >
                {team.name || "Untitled team"}
              </Text>
              <Text className="text-callout text-ink-muted" numberOfLines={1}>
                {purposeLabel(team)}
                {issues > 0 ? " · can't enter yet" : ""}
              </Text>
            </View>
            <SymbolView
              name={{
                ios: "chevron.right",
                android: "chevron_right",
                web: "chevron_right",
              }}
              tintColor={colors["ink-subtle"]}
              size={20}
            />
          </View>
          {team.members.length > 0 ? (
            <View className="flex-row gap-1">
              {team.members.map((m, i) => (
                <Sprite key={i} id={m.pokemonId} size={48} game={team.game} />
              ))}
            </View>
          ) : (
            <Text className="text-callout text-ink-subtle">No Pokémon yet</Text>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}
