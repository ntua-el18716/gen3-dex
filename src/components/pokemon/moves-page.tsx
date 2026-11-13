import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { TypeDot } from "@/components/type-badge";
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
      <Text className="p-8 text-center text-ink-muted">
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
    <View className="gap-3 p-3 pb-12">
      <View className="flex-row self-start rounded-full bg-sunken p-1">
        {sections.map((s) => {
          const on = s.method === section.method;
          return (
            <Pressable
              key={s.method}
              onPress={() => setMethod(s.method)}
              role="tab"
              aria-selected={on}
              className={`rounded-full px-3 py-1.5 ${on ? "bg-surface" : ""}`}
            >
              <Text
                className={`text-xs font-bold ${on ? "text-ink" : "text-ink-muted"}`}
              >
                {METHOD_LABELS[s.method]}{" "}
                <Text className="text-ink-subtle">{s.data.length}</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <View className="flex-row items-center gap-2 px-3 pb-1.5">
          {label !== "" && <ColumnLabel className="w-10">{label}</ColumnLabel>}
          <ColumnLabel className="flex-1">Move</ColumnLabel>
          <ColumnLabel className="w-10 text-right">Pow</ColumnLabel>
          <ColumnLabel className="w-11 text-right">Acc</ColumnLabel>
        </View>
        <View className="overflow-hidden rounded-2xl border border-line bg-surface">
          {section.data.map((move, i) => (
            <MoveRow
              key={`${move.moveId}-${move.level}`}
              move={move}
              showLabel={label !== ""}
              first={i === 0}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function ColumnLabel({
  className,
  children,
}: {
  className: string;
  children: string;
}) {
  return (
    <Text
      className={`text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle ${className}`}
    >
      {children}
    </Text>
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
      className={`px-3 py-2.5 active:bg-sunken ${first ? "" : "border-t border-line"}`}
    >
      <View className="flex-row items-center gap-2">
        {showLabel && (
          <Text className="w-10 text-[13px] font-bold text-ink-subtle">
            {label}
          </Text>
        )}
        <Text className="flex-1 text-sm font-bold text-ink">{move.name}</Text>
        <TypeDot type={move.type} size={24} />
        <CategoryIcon cls={cls} />
        <Text className="w-10 text-right text-[13px] font-semibold text-ink-muted">
          {/* 0 = status move, 1 = power is calculated (e.g. Low Kick). */}
          {move.power === 0 ? "—" : move.power === 1 ? "var" : move.power}
        </Text>
        <Text className="w-11 text-right text-[13px] font-semibold text-ink-muted">
          {/* 0 = never misses. */}
          {move.accuracy === 0 ? "—" : `${move.accuracy}%`}
        </Text>
      </View>
      {open && (
        <View
          className="gap-2 pb-0.5 pt-2"
          style={showLabel ? { paddingLeft: 48 } : null}
        >
          <Text className="text-[13px] leading-5 text-ink-muted">
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

function Tag({ children }: { children: string }) {
  return (
    <Text className="overflow-hidden rounded-full bg-sunken px-2.5 py-0.5 text-[11px] font-bold text-ink-muted">
      {children}
    </Text>
  );
}

/** Physical (burst), special (rings) or status (half circle), like the mockup. */
function CategoryIcon({ cls }: { cls: DamageClass }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" aria-label={cls}>
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
