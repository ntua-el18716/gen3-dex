import { Pressable, Text, View } from "react-native";

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
    <View className="gap-1.5">
      <Text className="text-[10px] font-extrabold uppercase tracking-widest text-ink-subtle">
        {label}
      </Text>
      <View className="flex-row items-center gap-1.5">
        {big > 0 && (
          <StepButton label={`−${big}`} onPress={() => set(value - big)} />
        )}
        <StepButton label="−" onPress={() => set(value - 1)} />
        <Text className="min-w-16 text-center text-3xl font-black text-ink">
          {value}
        </Text>
        <StepButton label="+" onPress={() => set(value + 1)} />
        {big > 0 && (
          <StepButton label={`+${big}`} onPress={() => set(value + big)} />
        )}
      </View>
      {note ? <Text className="text-xs text-ink-muted">{note}</Text> : null}
    </View>
  );
}

function StepButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={label}
      hitSlop={4}
      className="h-10 min-w-10 items-center justify-center rounded-full bg-sunken px-2.5 active:opacity-70"
    >
      <Text className="text-base font-black text-ink-muted">{label}</Text>
    </Pressable>
  );
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row self-start rounded-full bg-sunken p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            role="tab"
            aria-selected={on}
            className={`rounded-full px-3.5 py-1.5 ${on ? "bg-surface" : ""}`}
          >
            <Text
              className={`text-xs font-bold ${on ? "text-ink" : "text-ink-muted"}`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
