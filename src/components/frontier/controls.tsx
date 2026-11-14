import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Label, Segmented, TABULAR } from "@/components/ui";

export { Segmented };

/** A control with its caption above and an optional explanation below. */
export function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Label>{label}</Label>
      {children}
      {note ? (
        <Text className="text-caption text-ink-subtle">{note}</Text>
      ) : null}
    </View>
  );
}

/** A number with − and + buttons (and ±7 for whole challenges). */
export function Stepper({
  label,
  value,
  min,
  max = 9999,
  onChange,
  big = 7,
  note,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
  /** Size of the big steps; 0 hides them. */
  big?: number;
  note?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <Field label={label} note={note}>
      <View className="flex-row items-center gap-1 rounded-tile bg-sunken p-[3px]">
        {big > 0 && (
          <StepButton
            label={`−${big}`}
            disabled={value <= min}
            onPress={() => set(value - big)}
          />
        )}
        <StepButton
          label="−"
          disabled={value <= min}
          onPress={() => set(value - 1)}
        />
        <Text
          className="flex-1 text-center text-title font-bold text-ink"
          style={TABULAR}
        >
          {value}
        </Text>
        <StepButton
          label="+"
          disabled={value >= max}
          onPress={() => set(value + 1)}
        />
        {big > 0 && (
          <StepButton
            label={`+${big}`}
            disabled={value >= max}
            onPress={() => set(value + big)}
          />
        )}
      </View>
    </Field>
  );
}

function StepButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
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
      className={`h-10 w-12 items-center justify-center rounded-[9px] bg-surface active:opacity-60 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <Text className="text-body font-semibold text-ink" style={TABULAR}>
        {label}
      </Text>
    </Pressable>
  );
}
