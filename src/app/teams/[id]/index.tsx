import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Field } from "@/components/frontier/controls";
import { MoveChip } from "@/components/move-chip";
import { Sprite } from "@/components/sprite";
import { TypeDot } from "@/components/type-badge";
import { Card, SectionTitle, Segmented, TABULAR } from "@/components/ui";
import { useDb } from "@/db";
import { GAMES } from "@/db/schema";
import { getTeamDetails, type TeamMemberDetail } from "@/db/team-queries";
import { GAME_INFO } from "@/lib/games";
import {
  issueText,
  natureEffect,
  purposeName,
  STAT_LABELS,
} from "@/lib/team-labels";
import {
  isFrontier,
  MAX_TEAM_SIZE,
  TEAM_PURPOSES,
  teamIssues,
  withPurpose,
  type Team,
  type TeamMember,
} from "@/lib/teams";
import { useTeam, useTeams } from "@/state/teams";
import { useColors } from "@/theme/theme";

const GAME_OPTIONS = GAMES.map((g) => ({
  value: g,
  label: GAME_INFO[g].short,
  a11yLabel: GAME_INFO[g].name,
}));

/** One team: its name and purpose, its Pokémon, and whether it can enter. */
export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = useTeam(id);
  if (!team) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Team" }} />
        <Text className="text-body text-ink-muted">
          This team no longer exists.
        </Text>
      </View>
    );
  }
  return <TeamEditor team={team} />;
}

function TeamEditor({ team }: { team: Team }) {
  const db = useDb();
  const colors = useColors();
  const { updateTeam, deleteTeam } = useTeams();
  const change = (patch: Partial<Team>) =>
    updateTeam(team.id, (t) => ({ ...t, ...patch }));
  const details = useMemo(() => getTeamDetails(db, team), [db, team]);
  const issues = teamIssues(team);

  return (
    <ScrollView
      contentContainerClassName="gap-6 px-4 pb-12 pt-2"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: team.name || "New team" }} />

      <Card className="gap-5 p-4">
        <TextInput
          className="h-11 rounded-tile bg-sunken px-3 text-body text-ink outline-none"
          placeholder="Team name"
          placeholderTextColor={colors["ink-subtle"]}
          value={team.name}
          onChangeText={(name) => change({ name })}
          maxLength={40}
        />
        <Field label="This team is for">
          <View className="flex-row flex-wrap gap-2">
            {TEAM_PURPOSES.map((p) => {
              const on = p === team.purpose;
              return (
                <Pressable
                  key={p}
                  onPress={() => updateTeam(team.id, (t) => withPurpose(t, p))}
                  role="radio"
                  aria-checked={on}
                  className={`h-9 justify-center rounded-tile px-3 active:opacity-60 ${
                    on ? "bg-accent" : "bg-sunken"
                  }`}
                >
                  <Text
                    className={`text-callout font-semibold ${
                      on ? "text-on-accent" : "text-ink-muted"
                    }`}
                  >
                    {purposeName(p)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        {isFrontier(team.purpose) ? (
          <Field
            label="Level mode"
            note="The Battle Frontier is in Emerald, so this team uses Emerald's moves."
          >
            <Segmented
              options={[
                { value: "50", label: "Level 50" },
                { value: "open", label: "Open Level" },
              ]}
              value={team.levelMode}
              onChange={(levelMode) => change({ levelMode })}
              fill
            />
          </Field>
        ) : (
          <Field
            label="Game"
            note="Decides which moves each Pokémon can learn."
          >
            <Segmented
              options={GAME_OPTIONS}
              value={team.game}
              onChange={(game) => change({ game })}
              fill
            />
          </Field>
        )}
        <TextInput
          className="min-h-20 rounded-tile bg-sunken px-3 py-2.5 text-body text-ink outline-none"
          placeholder="Notes: leads, strategy, what to watch for"
          placeholderTextColor={colors["ink-subtle"]}
          value={team.note}
          onChangeText={(note) => change({ note })}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
      </Card>

      {issues.length > 0 && team.members.length > 0 && (
        <View className="gap-1.5 rounded-card bg-amber-500/15 p-4">
          <Text className="text-body font-semibold text-ink">
            This team can’t enter the {purposeName(team.purpose)} yet
          </Text>
          {issues.map((issue, i) => (
            <Text key={i} className="text-callout text-ink-muted">
              {issueText(issue, (slot) => details[slot]?.name ?? "A Pokémon")}
            </Text>
          ))}
        </View>
      )}

      <View className="gap-2">
        <SectionTitle>
          {`Pokémon (${team.members.length} of ${MAX_TEAM_SIZE})`}
        </SectionTitle>
        {team.members.map((member, slot) => (
          <MemberCard
            key={slot}
            team={team}
            slot={slot}
            member={member}
            detail={details[slot] ?? null}
          />
        ))}
        {team.members.length < MAX_TEAM_SIZE && (
          <Link
            href={{
              pathname: "/teams/[id]/pick",
              params: { id: team.id, field: "species", slot: "new" },
            }}
            asChild
          >
            <Pressable
              role="button"
              className="h-12 flex-row items-center justify-center gap-2 rounded-card bg-surface active:opacity-60"
            >
              <SymbolView
                name={{ ios: "plus", android: "add", web: "add" }}
                tintColor={colors.accent}
                size={20}
              />
              <Text className="text-body font-semibold text-accent">
                Add a Pokémon
              </Text>
            </Pressable>
          </Link>
        )}
      </View>

      <DeleteButton
        onDelete={() => {
          router.back();
          deleteTeam(team.id);
        }}
      />
    </ScrollView>
  );
}

/** A member in full; opens its editor. */
function MemberCard({
  team,
  slot,
  member,
  detail,
}: {
  team: Team;
  slot: number;
  member: TeamMember;
  detail: TeamMemberDetail | null;
}) {
  return (
    <Link
      href={{
        pathname: "/teams/[id]/member/[slot]",
        params: { id: team.id, slot },
      }}
      asChild
    >
      <Pressable className="active:opacity-60">
        <Card className="gap-3 p-4">
          <View className="flex-row items-center gap-3">
            <Sprite id={member.pokemonId} size={64} game={team.game} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text
                  className="flex-shrink text-headline font-bold text-ink"
                  numberOfLines={1}
                >
                  {detail?.name ?? "Unknown Pokémon"}
                </Text>
                <Text
                  className="text-caption font-medium text-ink-muted"
                  style={TABULAR}
                >
                  Lv {member.level}
                </Text>
                {detail && (
                  <View className="ml-auto flex-row gap-1">
                    <TypeDot type={detail.type1} size={20} />
                    {detail.type2 && <TypeDot type={detail.type2} size={20} />}
                  </View>
                )}
              </View>
              {detail && (
                <>
                  <Text className="text-callout text-ink-muted">
                    {detail.itemName ? (
                      <>
                        Holds{" "}
                        <Text className="font-semibold text-ink">
                          {detail.itemName}
                        </Text>
                      </>
                    ) : (
                      "No item"
                    )}
                    {detail.abilityName ? ` · ${detail.abilityName}` : ""}
                  </Text>
                  <Text className="text-callout text-ink-muted">
                    <Text className="font-semibold text-ink">
                      {detail.nature.name}
                    </Text>
                    {"  "}
                    {natureEffect(detail.nature)}
                  </Text>
                </>
              )}
            </View>
          </View>
          {detail &&
            (detail.moves.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {detail.moves.map((m) => (
                  <MoveChip key={m.id} name={m.name} type={m.type} wide />
                ))}
              </View>
            ) : (
              <Text className="text-callout text-ink-subtle">
                No moves chosen yet
              </Text>
            ))}
          {detail && (
            <View className="flex-row gap-1">
              {STAT_LABELS.map(([stat, label]) => {
                const up = detail.nature.increasedStat === stat;
                const down = detail.nature.decreasedStat === stat;
                return (
                  <View
                    key={stat}
                    className="flex-1 items-center rounded-lg bg-sunken py-1.5"
                  >
                    <Text className="text-micro font-medium text-ink-muted">
                      {label}
                    </Text>
                    <Text
                      className={`text-body font-bold ${
                        up && !down
                          ? "text-red-500"
                          : down && !up
                            ? "text-blue-500"
                            : "text-ink"
                      }`}
                      style={TABULAR}
                    >
                      {detail.stats[stat]}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}

/** Deleting can't be undone, so it asks once, in place. */
function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Pressable
        onPress={() => setAsking(true)}
        role="button"
        className="h-11 items-center justify-center active:opacity-60"
      >
        <Text className="text-body font-semibold text-red-500">
          Delete team
        </Text>
      </Pressable>
    );
  }
  return (
    <View className="items-center gap-3">
      <Text className="text-callout text-ink-muted">
        Delete this team for good?
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setAsking(false)}
          role="button"
          className="h-11 justify-center rounded-tile bg-sunken px-5 active:opacity-60"
        >
          <Text className="text-body font-semibold text-ink">Keep it</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          role="button"
          className="h-11 justify-center rounded-tile bg-red-500 px-5 active:opacity-60"
        >
          <Text className="text-body font-semibold text-white">
            Delete team
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
