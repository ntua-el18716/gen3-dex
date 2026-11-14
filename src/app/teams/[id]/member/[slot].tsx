import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Field, Stepper } from "@/components/frontier/controls";
import { Sprite } from "@/components/sprite";
import { TypeBadge, TypeDot } from "@/components/type-badge";
import {
  Card,
  Divider,
  Label,
  SectionTitle,
  Segmented,
  TABULAR,
} from "@/components/ui";
import { useDb } from "@/db";
import type { Stat } from "@/db/schema";
import { getTeamDetails } from "@/db/team-queries";
import { natureEffect, STAT_LABELS } from "@/lib/team-labels";
import {
  clampLevel,
  evTotal,
  MAX_EV_TOTAL,
  MAX_MOVES,
  withEv,
  withIv,
  withoutMove,
  type TeamMember,
} from "@/lib/teams";
import { useTeam, useTeams } from "@/state/teams";
import { useColors } from "@/theme/theme";

const FULL_STAT_NAMES: Record<Stat, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  spAttack: "Sp. Atk",
  spDefense: "Sp. Def",
  speed: "Speed",
};

/** One Pokémon of a team: level, ability, nature, item, moves, EVs and IVs. */
export default function MemberScreen() {
  const { id, slot: slotParam } = useLocalSearchParams<{
    id: string;
    slot: string;
  }>();
  const slot = Number(slotParam);
  const db = useDb();
  const colors = useColors();
  const team = useTeam(id);
  const { updateTeam } = useTeams();
  const member = team?.members[slot];
  const detail = useMemo(
    () => (team ? (getTeamDetails(db, team)[slot] ?? null) : null),
    [db, team, slot],
  );

  if (!team || !member || !detail) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Pokémon" }} />
        <Text className="text-body text-ink-muted">
          This Pokémon is no longer on the team.
        </Text>
      </View>
    );
  }

  const change = (edit: (member: TeamMember) => TeamMember) =>
    updateTeam(team.id, (t) => ({
      ...t,
      members: t.members.map((m, i) => (i === slot ? edit(m) : m)),
    }));
  const pick = (field: string, index?: number) =>
    ({
      pathname: "/teams/[id]/pick",
      params: {
        id: team.id,
        field,
        slot,
        ...(index !== undefined && { index }),
      },
    }) as const;
  const used = evTotal(member.evs);

  return (
    <ScrollView
      contentContainerClassName="gap-6 px-4 pb-12 pt-2"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: detail.name }} />

      <Card className="gap-5 p-4">
        <View className="flex-row items-center gap-3">
          <Sprite id={member.pokemonId} size={72} game={team.game} />
          <View className="flex-1 gap-1.5">
            <Text className="text-title font-bold tracking-tight text-ink">
              {detail.name}
            </Text>
            <View className="flex-row gap-1.5">
              <TypeBadge type={detail.type1} small />
              {detail.type2 && <TypeBadge type={detail.type2} small />}
            </View>
          </View>
          <Link href={pick("species")} asChild>
            <Pressable role="button" hitSlop={8} className="active:opacity-60">
              <Text className="text-body font-semibold text-accent">
                Change
              </Text>
            </Pressable>
          </Link>
        </View>
        <Stepper
          label="Level"
          value={member.level}
          min={1}
          max={100}
          big={10}
          onChange={(level) =>
            change((m) => ({ ...m, level: clampLevel(level) }))
          }
        />
        {detail.abilities.length > 1 && (
          <Field label="Ability">
            <Segmented
              options={detail.abilities.map((a) => ({
                value: a.id,
                label: a.name,
              }))}
              value={member.abilityId}
              onChange={(abilityId) => change((m) => ({ ...m, abilityId }))}
              fill
            />
          </Field>
        )}
      </Card>

      <Card>
        {detail.abilities.length === 1 && (
          <>
            <Row label="Ability" value={detail.abilities[0]!.name} />
            <Divider className="ml-4" />
          </>
        )}
        <Link href={pick("nature")} asChild>
          <Pressable className="active:bg-sunken">
            <Row
              label="Nature"
              value={detail.nature.name}
              note={natureEffect(detail.nature)}
              chevron
            />
          </Pressable>
        </Link>
        <Divider className="ml-4" />
        <Link href={pick("item")} asChild>
          <Pressable className="active:bg-sunken">
            <Row label="Held item" value={detail.itemName ?? "None"} chevron />
          </Pressable>
        </Link>
      </Card>

      <View className="gap-2">
        <SectionTitle>Moves</SectionTitle>
        <Card>
          {Array.from({ length: MAX_MOVES }, (_, i) => {
            const move = detail.moves[i];
            // Only the first empty slot is offered.
            if (!move && i > detail.moves.length) return null;
            return (
              <View key={i}>
                {i > 0 && <Divider className="ml-4" />}
                <View className="flex-row items-center">
                  <Link href={pick("move", i)} asChild>
                    <Pressable className="h-12 flex-1 flex-row items-center gap-3 pl-4 active:bg-sunken">
                      {move ? (
                        <>
                          <TypeDot type={move.type} size={22} />
                          <Text className="flex-1 text-body font-semibold text-ink">
                            {move.name}
                          </Text>
                        </>
                      ) : (
                        <Text className="flex-1 text-body font-semibold text-accent">
                          Add a move
                        </Text>
                      )}
                    </Pressable>
                  </Link>
                  {move && (
                    <Pressable
                      onPress={() => change((m) => withoutMove(m, i))}
                      aria-label={`Remove ${move.name}`}
                      role="button"
                      className="h-12 w-12 items-center justify-center active:opacity-60"
                    >
                      <SymbolView
                        name={{ ios: "xmark", android: "close", web: "close" }}
                        tintColor={colors["ink-subtle"]}
                        size={18}
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      </View>

      <View className="gap-2">
        <SectionTitle>Stats</SectionTitle>
        <Card className="gap-2.5 p-4">
          <View className="flex-row items-center gap-2">
            <Label className="flex-1">At Lv {member.level}</Label>
            <Label className="w-16 text-center">EVs</Label>
            <Label className="w-14 text-center">IVs</Label>
            <Label className="w-11 text-right">Stat</Label>
          </View>
          {STAT_LABELS.map(([stat]) => {
            const up = detail.nature.increasedStat === stat;
            const down = detail.nature.decreasedStat === stat;
            return (
              <View key={stat} className="flex-row items-center gap-2">
                <Text className="flex-1 text-body text-ink">
                  {FULL_STAT_NAMES[stat]}
                </Text>
                <NumberInput
                  className="w-16"
                  label={`${FULL_STAT_NAMES[stat]} EVs`}
                  value={member.evs[stat]}
                  onChange={(v) =>
                    change((m) => ({ ...m, evs: withEv(m.evs, stat, v) }))
                  }
                />
                <NumberInput
                  className="w-14"
                  label={`${FULL_STAT_NAMES[stat]} IV`}
                  value={member.ivs[stat]}
                  onChange={(v) =>
                    change((m) => ({ ...m, ivs: withIv(m.ivs, stat, v) }))
                  }
                />
                <Text
                  className={`w-11 text-right text-body font-bold ${
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
          <Divider />
          <Text className="text-caption text-ink-subtle" style={TABULAR}>
            {used} of {MAX_EV_TOTAL} EVs used. Each 4 EVs add a stat point at Lv
            100; IVs go from 0 to 31.
          </Text>
        </Card>
      </View>

      <Pressable
        onPress={() => {
          router.back();
          updateTeam(team.id, (t) => ({
            ...t,
            members: t.members.filter((_, i) => i !== slot),
          }));
        }}
        role="button"
        className="h-11 items-center justify-center active:opacity-60"
      >
        <Text className="text-body font-semibold text-red-500">
          Remove from team
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  note,
  chevron = false,
}: {
  label: string;
  value: string;
  note?: string;
  chevron?: boolean;
}) {
  const colors = useColors();
  return (
    <View className="min-h-12 flex-row items-center gap-3 px-4 py-2">
      <Text className="text-body text-ink-muted">{label}</Text>
      <View className="flex-1 items-end">
        <Text className="text-body font-semibold text-ink">{value}</Text>
        {note && <Text className="text-caption text-ink-subtle">{note}</Text>}
      </View>
      {chevron && (
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          tintColor={colors["ink-subtle"]}
          size={20}
        />
      )}
    </View>
  );
}

/** A small box for typing a whole number; the caller clamps it. */
function NumberInput({
  value,
  onChange,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  className: string;
}): ReactNode {
  return (
    <TextInput
      className={`h-9 rounded-lg bg-sunken text-center text-body text-ink outline-none ${className}`}
      style={TABULAR}
      aria-label={label}
      value={String(value)}
      onChangeText={(text) => onChange(Number(text.replace(/\D/g, "")))}
      keyboardType="number-pad"
      selectTextOnFocus
      maxLength={3}
    />
  );
}
