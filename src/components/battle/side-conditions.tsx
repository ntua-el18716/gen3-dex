import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Divider, Field, Pills, Stepper, TABULAR } from "@/components/ui";
import {
  MAX_STAGE,
  MIN_STAGE,
  STAGE_STATS,
  STATUSES,
  type SideConditions,
} from "@/lib/damage";
import { describeSide, stageLabel, STATUS_LABELS } from "@/lib/damage-labels";
import { STAT_NAME } from "@/lib/stat-labels";
import { useColors } from "@/theme/theme";

const SCREENS = [
  { value: "none", label: "None" },
  { value: "reflect", label: "Reflect" },
  { value: "light", label: "Light Screen" },
  { value: "both", label: "Both" },
] as const;
type Screens = (typeof SCREENS)[number]["value"];

function screensOf(side: SideConditions): Screens {
  if (side.reflect && side.lightScreen) return "both";
  if (side.reflect) return "reflect";
  if (side.lightScreen) return "light";
  return "none";
}

/**
 * One side's HP, status, stat stages and screens, folded into a summary
 * line until opened.
 */
export function SideConditionsPanel({
  title,
  side,
  onChange,
}: {
  title: string;
  side: SideConditions;
  onChange: (side: SideConditions) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const change = (patch: Partial<SideConditions>) =>
    onChange({ ...side, ...patch });

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-14 flex-row items-center gap-3 px-4 py-2.5 active:bg-sunken"
      >
        <View className="flex-1 gap-0.5">
          <Text className="text-body font-semibold text-ink">{title}</Text>
          <Text className="text-caption text-ink-muted">
            {describeSide(side)}
          </Text>
        </View>
        <SymbolView
          name={{
            ios: open ? "chevron.up" : "chevron.down",
            android: open ? "expand_less" : "expand_more",
            web: open ? "expand_less" : "expand_more",
          }}
          tintColor={colors["ink-subtle"]}
          size={22}
        />
      </Pressable>
      {open && (
        <View className="gap-5 px-4 pb-4 pt-1">
          <Stepper
            label="HP left (%)"
            value={side.hpPercent}
            min={1}
            max={100}
            big={10}
            onChange={(hpPercent) => change({ hpPercent })}
          />
          <Field label="Status">
            <Pills
              options={STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
              }))}
              value={side.status}
              onChange={(status) => change({ status })}
            />
          </Field>
          <Field label="Stat changes">
            <View className="rounded-tile bg-sunken">
              {STAGE_STATS.map((stat, i) => {
                const stage = side.stages[stat] ?? 0;
                const set = (next: number) =>
                  change({
                    stages: {
                      ...side.stages,
                      [stat]: Math.min(MAX_STAGE, Math.max(MIN_STAGE, next)),
                    },
                  });
                return (
                  <View key={stat}>
                    {i > 0 && <Divider className="ml-3" />}
                    <View className="h-11 flex-row items-center gap-2 pl-3 pr-1">
                      <Text className="flex-1 text-callout text-ink">
                        {STAT_NAME[stat]}
                      </Text>
                      <StageButton
                        label={`Lower ${STAT_NAME[stat]}`}
                        sign="−"
                        disabled={stage <= MIN_STAGE}
                        onPress={() => set(stage - 1)}
                      />
                      <Text
                        className={`w-9 text-center text-body font-bold ${
                          stage > 0
                            ? "text-red-500"
                            : stage < 0
                              ? "text-blue-500"
                              : "text-ink-muted"
                        }`}
                        style={TABULAR}
                      >
                        {stageLabel(stage)}
                      </Text>
                      <StageButton
                        label={`Raise ${STAT_NAME[stat]}`}
                        sign="+"
                        disabled={stage >= MAX_STAGE}
                        onPress={() => set(stage + 1)}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Field>
          <Field label="Screens on this side">
            <Pills
              options={[...SCREENS]}
              value={screensOf(side)}
              onChange={(v) =>
                change({
                  reflect: v === "reflect" || v === "both",
                  lightScreen: v === "light" || v === "both",
                })
              }
            />
          </Field>
        </View>
      )}
    </View>
  );
}

function StageButton({
  label,
  sign,
  disabled,
  onPress,
}: {
  label: string;
  sign: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      className={`h-9 w-10 items-center justify-center rounded-[9px] bg-surface active:opacity-60 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <Text className="text-body font-semibold text-ink">{sign}</Text>
    </Pressable>
  );
}
