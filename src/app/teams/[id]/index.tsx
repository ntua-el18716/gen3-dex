import { LinearGradient } from "expo-linear-gradient";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { PokeballMark } from "@/components/pokeball-mark";
import { useTypeGradient } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { StatCells } from "@/components/stat-cells";
import { PurposeIcon } from "@/components/teams/purpose-icon";
import { TypeDot } from "@/components/type-badge";
import { Pills, SectionTitle, Segmented, TABULAR } from "@/components/ui";
import { useDb } from "@/db";
import { GAMES } from "@/db/schema";
import { getTeamDetails, type TeamMemberDetail } from "@/db/team-queries";
import { GAME_INFO } from "@/lib/games";
import { issueText, natureEffect, purposeName } from "@/lib/team-labels";
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
      <Stack.Screen options={{ title: "" }} />

      <View className="gap-4">
        <TextInput
          className="h-11 px-1 text-title font-bold tracking-tight text-ink outline-none"
          placeholder="Name this team"
          placeholderTextColor={colors["ink-subtle"]}
          value={team.name}
          onChangeText={(name) => change({ name })}
          maxLength={40}
        />
        <Pills
          options={TEAM_PURPOSES.map((p) => ({
            value: p,
            label: purposeName(p).replace("Battle ", ""),
            a11yLabel: purposeName(p),
            left: <PurposeIcon purpose={p} game={team.game} size={32} />,
          }))}
          value={team.purpose}
          onChange={(p) => updateTeam(team.id, (t) => withPurpose(t, p))}
        />
        {isFrontier(team.purpose) ? (
          <Segmented
            options={[
              { value: "50", label: "Level 50" },
              { value: "open", label: "Open Level" },
            ]}
            value={team.levelMode}
            onChange={(levelMode) => change({ levelMode })}
            fill
          />
        ) : (
          <Segmented
            options={GAME_OPTIONS}
            value={team.game}
            onChange={(game) => change({ game })}
            tone="accent"
            fill
          />
        )}
      </View>

      {issues.length > 0 && team.members.length > 0 && (
        <View className="flex-row gap-3 rounded-card bg-amber-500/15 p-4">
          <SymbolView
            name={{
              ios: "exclamationmark.triangle.fill",
              android: "warning",
              web: "warning",
            }}
            tintColor="#D97706"
            size={22}
          />
          <View className="flex-1 gap-1">
            <Text className="text-body font-semibold text-ink">
              Can’t enter the {purposeName(team.purpose)} yet
            </Text>
            {issues.map((issue, i) => (
              <Text key={i} className="text-callout text-ink-muted">
                {issueText(issue, (slot) => details[slot]?.name ?? "A Pokémon")}
              </Text>
            ))}
          </View>
        </View>
      )}

      <View className="gap-2">
        <SectionTitle
          action={
            <Text className="text-callout text-ink-subtle" style={TABULAR}>
              {team.members.length} of {MAX_TEAM_SIZE}
            </Text>
          }
        >
          Pokémon
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
              className="h-16 flex-row items-center justify-center gap-2 rounded-card border border-dashed border-ink-subtle/50 active:opacity-60"
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

      <View className="gap-2">
        <SectionTitle>Notes</SectionTitle>
        <TextInput
          className="min-h-24 rounded-card bg-surface p-4 text-body text-ink outline-none"
          placeholder="Leads, strategy, what to watch for"
          placeholderTextColor={colors["ink-subtle"]}
          value={team.note}
          onChangeText={(note) => change({ note })}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
      </View>

      {team.members.length > 0 && (
        <Link
          href={{ pathname: "/teams/[id]/export", params: { id: team.id } }}
          asChild
        >
          <Pressable
            role="button"
            className="h-12 flex-row items-center justify-center gap-2 rounded-tile bg-surface active:opacity-60"
          >
            <SymbolView
              name={{
                ios: "square.and.arrow.up",
                android: "share",
                web: "share",
              }}
              tintColor={colors.ink}
              size={20}
            />
            <Text className="text-body font-semibold text-ink">
              Share as text
            </Text>
          </Pressable>
        </Link>
      )}

      <DeleteButton
        onDelete={() => {
          router.back();
          deleteTeam(team.id);
        }}
      />
    </ScrollView>
  );
}

/** A member in full, tinted in its own colours; opens its editor. */
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
  const gradient = useTypeGradient({
    id: member.pokemonId,
    type1: detail?.type1 ?? "normal",
    type2: detail?.type2 ?? null,
  });
  return (
    <Link
      href={{
        pathname: "/teams/[id]/member/[slot]",
        params: { id: team.id, slot },
      }}
      asChild
    >
      <Pressable className="overflow-hidden rounded-card active:opacity-70">
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <PokeballMark
          size={120}
          style={{ position: "absolute", left: -22, top: -22 }}
        />
        <View className="gap-3 p-4">
          <View className="flex-row items-center gap-3">
            <Sprite id={member.pokemonId} size={72} game={team.game} />
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className="flex-shrink text-headline font-bold text-ink"
                  numberOfLines={1}
                >
                  {detail?.name ?? "Unknown Pokémon"}
                </Text>
                <View className="rounded-md bg-surface/70 px-1.5 py-0.5">
                  <Text
                    className="text-micro font-semibold text-ink-muted"
                    style={TABULAR}
                  >
                    Lv {member.level}
                  </Text>
                </View>
                {detail && (
                  <View className="ml-auto flex-row gap-1">
                    <TypeDot type={detail.type1} size={22} />
                    {detail.type2 && <TypeDot type={detail.type2} size={22} />}
                  </View>
                )}
              </View>
              {detail && (
                <>
                  <Text
                    className="text-callout text-ink-muted"
                    numberOfLines={1}
                  >
                    {detail.itemName ? (
                      <Text className="font-semibold text-ink">
                        {detail.itemName}
                      </Text>
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
                  <View
                    key={m.id}
                    className="w-[48.5%] flex-row items-center gap-1.5 rounded-lg bg-surface/70 py-1 pl-1 pr-2.5"
                  >
                    <TypeDot type={m.type} size={18} />
                    <Text
                      className="flex-1 text-callout font-semibold text-ink"
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-callout text-ink-muted">
                No moves yet. Tap to choose them.
              </Text>
            ))}
          {detail && (
            <StatCells stats={detail.stats} nature={detail.nature} strip />
          )}
        </View>
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
          className="h-11 justify-center rounded-full bg-surface px-5 active:opacity-60"
        >
          <Text className="text-body font-semibold text-ink">Keep it</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          role="button"
          className="h-11 justify-center rounded-full bg-red-500 px-5 active:opacity-60"
        >
          <Text className="text-body font-semibold text-white">
            Delete team
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
