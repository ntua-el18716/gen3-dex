import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { TextExport } from "@/components/teams/text-export";
import { useDb } from "@/db";
import { getNameIndex } from "@/db/team-queries";
import { formatTeam } from "@/lib/showdown";
import { useTeam } from "@/state/teams";

/**
 * A team as Showdown text, to share or copy. Opens over the team page.
 */
export default function ExportTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const team = useTeam(id);
  const index = useMemo(() => getNameIndex(db), [db]);
  if (!team) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Share team" }} />
        <Text className="text-body text-ink-muted">
          This team no longer exists.
        </Text>
      </View>
    );
  }
  return (
    <TextExport
      title="Share team"
      text={formatTeam(team, index)}
      note="Showdown format: paste it into Pokémon Showdown, a forum post, or this app's import on another phone."
    />
  );
}
