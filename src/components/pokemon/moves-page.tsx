import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { TypeDot } from "@/components/type-badge";
import { Card, Label, Segmented, TABULAR, Tag } from "@/components/ui";
import type { LearnsetMove, LearnsetSection } from "@/db/queries";
import type { Game, LearnMethod } from "@/db/schema";
import { damageClass, type DamageClass } from "@/lib/damage-class";
import { GAME_INFO } from "@/lib/games";

const METHOD_LABELS: Record<LearnMethod, string> = {
  level: "Level up",
  machine: "TM/HM",
  tutor: "Tutor",
  egg: "Egg",
};

/** The Moves tab: one learn method at a time, one line per move. */
export function MovesPage({
  sections,
  game,
}: {
  sections: LearnsetSection[];
  game: Game;
}) {
  const [method, setMethod] = useState<LearnMethod>("level");
  // A method the game has no moves for (e.g. after switching games) falls
  // back to the first one it has.
  const section =
    sections.find((s) => s.method === method) ?? sections[0] ?? null;

  if (!section) {
    return (
      <Text className="p-8 text-center text-body text-ink-muted">
        No moves recorded for {GAME_INFO[game].name}.
      </Text>
    );
  }
  const label =
    section.method === "level"
      ? "Lv"
      : section.method === "machine"
        ? "TM"
        : "";

  return (
    <View className="gap-4 px-4 pb-12 pt-5">
      <Segmented
        options={sections.map((s) => ({
          value: s.method,
          label: METHOD_LABELS[s.method],
          count: s.data.length,
        }))}
        value={section.method}
        onChange={setMethod}
      />

      <View className="gap-1.5">
        <View className="flex-row items-center gap-2 px-4">
          {label !== "" && <Label className="w-9">{label}</Label>}
          <Label className="flex-1">Move</Label>
          <Label className="w-10 text-right">Power</Label>
          <Label className="w-11 text-right">Acc.</Label>
        </View>
        <Card>
          {section.data.map((move, i) => (
            <MoveRow
              key={`${move.moveId}-${move.level}`}
              move={move}
              showLabel={label !== ""}
              first={i === 0}
            />
          ))}
        </Card>
      </View>
    </View>
  );
}

/** One move; tapping it shows its description, PP and whether it makes contact. */
function MoveRow({
  move,
  showLabel,
  first,
}: {
  move: LearnsetMove;
  showLabel: boolean;
  first: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cls = damageClass(move);
  const label =
    move.method === "level"
      ? String(move.level)
      : (move.machine ?? "").replace(/^TM/, "");
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      aria-expanded={open}
      className={`px-4 py-3 active:bg-sunken ${first ? "" : "border-t border-line"}`}
    >
      <View className="flex-row items-center gap-2">
        {showLabel && (
          <Text
            className="w-9 text-callout font-medium text-ink-subtle"
            style={TABULAR}
          >
            {label}
          </Text>
        )}
        <View className="flex-1">
          <Text className="text-body font-semibold text-ink">{move.name}</Text>
          {/* An earlier stage's egg move, which this Pokémon keeps. */}
          {move.from && (
            <Text className="text-caption text-ink-subtle">
              From {move.from}
            </Text>
          )}
        </View>
        <TypeDot type={move.type} size={22} />
        <CategoryIcon cls={cls} />
        <Text
          className="w-10 text-right text-callout font-medium text-ink-muted"
          style={TABULAR}
        >
          {/* 0 = status move, 1 = power is calculated (e.g. Low Kick). */}
          {move.power === 0 ? "—" : move.power === 1 ? "var" : move.power}
        </Text>
        <Text
          className="w-11 text-right text-callout font-medium text-ink-muted"
          style={TABULAR}
        >
          {/* 0 = never misses. */}
          {move.accuracy === 0 ? "—" : `${move.accuracy}%`}
        </Text>
      </View>
      {open && (
        <View
          className="gap-2 pb-0.5 pt-2"
          style={showLabel ? { paddingLeft: 44 } : null}
        >
          <Text className="text-callout text-ink-muted">
            {move.description}
          </Text>
          <View className="flex-row gap-1.5">
            <Tag>{`PP ${move.pp}`}</Tag>
            <Tag>{cls[0]!.toUpperCase() + cls.slice(1)}</Tag>
            {move.makesContact && <Tag>Contact</Tag>}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Physical (burst), special (rings) or status (half circle), like the mockup. */
function CategoryIcon({ cls }: { cls: DamageClass }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" aria-label={cls}>
      {cls === "physical" ? (
        <Path
          fill="#E8553E"
          d="M12 1l2.6 6.2L21 5l-2.2 6.4L23 14l-6.4.9L17 22l-5-4.3L7 22l.4-7.1L1 14l4.2-2.6L3 5l6.4 2.2z"
        />
      ) : cls === "special" ? (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9.5}
            fill="none"
            stroke="#4F7CF0"
            strokeWidth={2.6}
          />
          <Circle
            cx={12}
            cy={12}
            r={4.5}
            fill="none"
            stroke="#4F7CF0"
            strokeWidth={2.6}
          />
        </>
      ) : (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9.5}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth={2.6}
          />
          <Path d="M12 2.5a9.5 9.5 0 0 1 0 19z" fill="#9CA3AF" />
        </>
      )}
    </Svg>
  );
}
