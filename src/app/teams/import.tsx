import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Sprite } from "@/components/sprite";
import { Card, Divider, Label, MONO, SectionTitle } from "@/components/ui";
import { useDb } from "@/db";
import { getNameIndex } from "@/db/team-queries";
import { parseShowdown } from "@/lib/showdown";
import { defaultLevel, newTeam, parseTeams, type Team } from "@/lib/teams";
import { useCurrentGame } from "@/state/current-game";
import { useTeams } from "@/state/teams";
import { useColors } from "@/theme/theme";

type Incoming = Omit<Team, "id" | "updatedAt">;

/**
 * Paste teams in: Showdown text (one team or several, e.g. from Smogon or
 * a friend) or a backup from "Back up teams". Shows what it found before
 * adding anything.
 */
export default function ImportScreen() {
  const db = useDb();
  const colors = useColors();
  const { game } = useCurrentGame();
  const { addTeams } = useTeams();
  const [text, setText] = useState("");
  const index = useMemo(() => getNameIndex(db), [db]);

  const { teams, warnings, kind } = useMemo((): {
    teams: Incoming[];
    warnings: string[];
    kind: "backup" | "showdown";
  } => {
    if (text.trim().startsWith("{")) {
      // A backup keeps everything; the teams get new ids when added.
      return { teams: parseTeams(text), warnings: [], kind: "backup" };
    }
    const blank = newTeam("", 0, game);
    const parsed = parseShowdown(text, index, defaultLevel(blank));
    return {
      teams: parsed.teams.map((t) => ({
        ...blank,
        name: t.name,
        members: t.members,
      })),
      warnings: parsed.warnings,
      kind: "showdown",
    };
  }, [text, index, game]);

  const add = () => {
    const ids = addTeams(teams);
    if (ids.length === 1)
      router.replace({ pathname: "/teams/[id]", params: { id: ids[0]! } });
    else router.back();
  };
  const name = (id: number) => index.species.find((s) => s.id === id)?.name;

  return (
    <ScrollView
      contentContainerClassName="gap-5 px-4 pb-12 pt-2"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Import teams" }} />
      <Text className="px-1 text-callout text-ink-muted">
        Paste Showdown sets (from Smogon, a forum or a friend) or a backup made
        with “Back up teams”.
      </Text>
      <TextInput
        className="min-h-40 rounded-card bg-surface p-4 text-callout text-ink outline-none"
        style={MONO}
        placeholder={
          "Salamence @ Choice Band\nAbility: Intimidate\nEVs: 252 Atk / 252 Spe\nAdamant Nature\n- Earthquake"
        }
        placeholderTextColor={colors["ink-subtle"]}
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
        autoCorrect={false}
        autoCapitalize="none"
      />

      {teams.length > 0 && (
        <View className="gap-2">
          <SectionTitle>
            {kind === "backup" ? "In this backup" : "Found"}
          </SectionTitle>
          <Card>
            {teams.map((t, i) => (
              <View key={i}>
                {i > 0 && <Divider className="ml-4" />}
                <View className="gap-1 p-4">
                  <Text className="text-body font-semibold text-ink">
                    {t.name || "Untitled team"}
                  </Text>
                  <View className="flex-row flex-wrap gap-1">
                    {t.members.map((m, j) => (
                      <Sprite
                        key={j}
                        id={m.pokemonId}
                        size={44}
                        game={t.game}
                      />
                    ))}
                  </View>
                  <Text className="text-caption text-ink-muted">
                    {t.members.map((m) => name(m.pokemonId)).join(", ")}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {warnings.length > 0 && (
        <View className="gap-1 rounded-card bg-amber-500/15 p-4">
          <Label>Left out or changed</Label>
          {warnings.map((w, i) => (
            <Text key={i} className="text-callout text-ink-muted">
              {w}
            </Text>
          ))}
        </View>
      )}

      {text.trim() !== "" && teams.length === 0 && (
        <Text className="px-1 text-callout text-ink-muted">
          No Pokémon found in this text yet.
        </Text>
      )}

      <Pressable
        onPress={add}
        disabled={teams.length === 0}
        role="button"
        aria-disabled={teams.length === 0}
        className={`h-12 items-center justify-center rounded-tile bg-accent active:opacity-60 ${
          teams.length === 0 ? "opacity-40" : ""
        }`}
      >
        <Text className="text-body font-semibold text-on-accent">
          {teams.length <= 1 ? "Add team" : `Add ${teams.length} teams`}
        </Text>
      </Pressable>
      {kind === "showdown" && teams.length > 0 && (
        <Text className="px-1 text-caption text-ink-subtle">
          Showdown text doesn’t say what a team is for: it’s added as a
          walkthrough team, which you can change on its page.
        </Text>
      )}
    </ScrollView>
  );
}
