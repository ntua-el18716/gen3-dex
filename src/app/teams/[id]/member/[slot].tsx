import { LinearGradient } from "expo-linear-gradient";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { PokeballMark } from "@/components/pokeball-mark";
import { useTypeGradient } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { TypeBadge, TypeDot } from "@/components/type-badge";
import {
  Card,
  Divider,
  Field,
  Label,
  SectionTitle,
  Segmented,
  Stepper,
  TABULAR,
} from "@/components/ui";
import { useDb } from "@/db";
import { getTeamDetails, type TeamMemberDetail } from "@/db/team-queries";
import { DISPLAY_STATS, natureTone, STAT_NAME } from "@/lib/stat-labels";
import { natureEffect } from "@/lib/team-labels";
import {
  clampLevel,
  evTotal,
  MAX_EV_TOTAL,
  MAX_MOVES,
  withEv,
  withIv,
  withoutMove,
  type Team,
  type TeamMember,
} from "@/lib/teams";
import { hexToRgb, mix, typeColor } from "@/theme/colors";
import { useTeam, useTeams } from "@/state/teams";
import { useColors, usePalette } from "@/theme/theme";

/** One Pokémon of a team: level, ability, nature, item, moves, EVs and IVs. */
export default function MemberScreen() {
  const { id, slot: slotParam } = useLocalSearchParams<{
    id: string;
    slot: string;
  }>();
  const slot = Number(slotParam);
  const db = useDb();
  const team = useTeam(id);
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
  return <Editor team={team} slot={slot} member={member} detail={detail} />;
}

function Editor({
  team,
  slot,
  member,
  detail,
}: {
  team: Team;
  slot: number;
  member: TeamMember;
  detail: TeamMemberDetail;
}) {
  const colors = useColors();
  const { surface } = usePalette();
  const { updateTeam } = useTeams();
  const gradient = useTypeGradient({
    id: member.pokemonId,
    type1: detail.type1,
    type2: detail.type2,
  });

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
  // Bars share one scale per level, so stats compare at a glance.
  const barScale = member.level * 3.6 + 20;

  return (
    <ScrollView
      contentContainerClassName="gap-6 px-4 pb-12 pt-2"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "" }} />

      {/* The Pokémon, in its own colours. */}
      <View className="items-center overflow-hidden rounded-card pb-5 pt-3">
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <PokeballMark
          size={200}
          opacity={0.05}
          style={{ position: "absolute", top: -24 }}
        />
        <Link href={pick("species")} asChild>
          <Pressable
            role="button"
            hitSlop={8}
            className="absolute right-3 top-3 h-9 flex-row items-center gap-1.5 rounded-full bg-surface/70 pl-2.5 pr-3.5 active:opacity-60"
          >
            <SymbolView
              name={{
                ios: "arrow.left.arrow.right",
                android: "swap_horiz",
                web: "swap_horiz",
              }}
              tintColor={colors.ink}
              size={16}
            />
            <Text className="text-callout font-semibold text-ink">Change</Text>
          </Pressable>
        </Link>
        <Sprite id={member.pokemonId} size={128} game={team.game} />
        <Text className="text-title font-bold tracking-tight text-ink">
          {detail.name}
        </Text>
        <View className="mt-2 flex-row gap-1.5">
          <TypeBadge type={detail.type1} small />
          {detail.type2 && <TypeBadge type={detail.type2} small />}
        </View>
      </View>

      <Card>
        <View className="gap-5 p-4">
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
        </View>
        <Divider className="ml-4" />
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
        <SectionTitle
          action={
            <Text className="text-callout text-ink-subtle" style={TABULAR}>
              {detail.moves.length} of {MAX_MOVES}
            </Text>
          }
        >
          Moves
        </SectionTitle>
        {/* Always four tiles: the moves, then the empty slots. */}
        <View className="flex-row flex-wrap justify-between gap-y-2">
          {Array.from({ length: MAX_MOVES }, (_, i) => {
            const move = detail.moves[i];
            if (!move) {
              return (
                <Link key={i} href={pick("move", detail.moves.length)} asChild>
                  <Pressable
                    role="button"
                    aria-label="Add a move"
                    className="h-14 w-[48.8%] flex-row items-center justify-center gap-1.5 rounded-tile border border-dashed border-ink-subtle/50 active:opacity-60"
                  >
                    <SymbolView
                      name={{ ios: "plus", android: "add", web: "add" }}
                      tintColor={colors["ink-muted"]}
                      size={18}
                    />
                    <Text className="text-callout font-semibold text-ink-muted">
                      Add move
                    </Text>
                  </Pressable>
                </Link>
              );
            }
            return (
              <View
                key={i}
                className="h-14 w-[48.8%] flex-row items-center overflow-hidden rounded-tile"
                style={{
                  backgroundColor: mix(
                    hexToRgb(typeColor(move.type)),
                    surface,
                    0.2,
                  ),
                }}
              >
                <Link href={pick("move", i)} asChild>
                  <Pressable className="h-14 flex-1 flex-row items-center gap-2 pl-3 active:opacity-60">
                    <TypeDot type={move.type} size={24} />
                    <Text
                      className="flex-1 text-callout font-semibold text-ink"
                      numberOfLines={2}
                    >
                      {move.name}
                    </Text>
                  </Pressable>
                </Link>
                <Pressable
                  onPress={() => change((m) => withoutMove(m, i))}
                  aria-label={`Remove ${move.name}`}
                  role="button"
                  className="h-14 w-9 items-center justify-center active:opacity-60"
                >
                  <SymbolView
                    name={{ ios: "xmark", android: "close", web: "close" }}
                    tintColor={colors["ink-muted"]}
                    size={16}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <SectionTitle
          action={
            <Text className="text-callout text-ink-subtle" style={TABULAR}>
              Lv {member.level}
            </Text>
          }
        >
          Stats
        </SectionTitle>
        <Card className="gap-3 p-4">
          {/* How much of the 510 EVs is spent. */}
          <View className="gap-1.5">
            <View className="flex-row justify-between">
              <Label>EVs used</Label>
              <Text
                className="text-caption font-semibold text-ink"
                style={TABULAR}
              >
                {used} / {MAX_EV_TOTAL}
              </Text>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-sunken">
              <View
                className="h-full rounded-full bg-accent"
                style={{ width: `${(used / MAX_EV_TOTAL) * 100}%` }}
              />
            </View>
          </View>
          <Divider />
          <View className="flex-row items-center gap-2">
            <View className="flex-1" />
            <Label className="w-9 text-right">Stat</Label>
            <Label className="w-14 text-center">EVs</Label>
            <Label className="w-11 text-center">IV</Label>
          </View>
          {DISPLAY_STATS.map((stat) => {
            const tone = natureTone(stat, detail.nature);
            return (
              <View key={stat} className="flex-row items-center gap-2">
                <View className="flex-1 gap-1.5">
                  <Text className="text-callout text-ink">
                    {STAT_NAME[stat]}
                  </Text>
                  <View className="h-1.5 overflow-hidden rounded-full bg-sunken">
                    <View
                      className={`h-full rounded-full ${
                        tone === "raised"
                          ? "bg-red-500"
                          : tone === "lowered"
                            ? "bg-blue-500"
                            : "bg-ink-subtle"
                      }`}
                      style={{
                        width: `${Math.min(1, detail.stats[stat] / barScale) * 100}%`,
                      }}
                    />
                  </View>
                </View>
                <Text
                  className={`w-9 text-right text-body font-bold ${
                    tone === "raised"
                      ? "text-red-500"
                      : tone === "lowered"
                        ? "text-blue-500"
                        : "text-ink"
                  }`}
                  style={TABULAR}
                >
                  {detail.stats[stat]}
                </Text>
                <NumberInput
                  className="w-14"
                  label={`${STAT_NAME[stat]} EVs`}
                  value={member.evs[stat]}
                  onChange={(v) =>
                    change((m) => ({ ...m, evs: withEv(m.evs, stat, v) }))
                  }
                />
                <NumberInput
                  className="w-11"
                  label={`${STAT_NAME[stat]} IV`}
                  value={member.ivs[stat]}
                  onChange={(v) =>
                    change((m) => ({ ...m, ivs: withIv(m.ivs, stat, v) }))
                  }
                />
              </View>
            );
          })}
        </Card>
        <Text className="px-1 text-caption text-ink-subtle">
          Up to 255 EVs per stat. IVs go from 0 to 31. Red is raised by the
          nature, blue lowered.
        </Text>
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
      className={`h-9 rounded-lg bg-sunken text-center text-callout font-semibold text-ink outline-none ${className}`}
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
