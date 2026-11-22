import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/theme/theme";

/**
 * The app's building blocks. Screens are made of these, so spacing, corners
 * and text styles stay the same everywhere:
 * - Card: a surface that groups related content (no outline; it stands out
 *   from the canvas by its colour)
 * - SectionTitle: the heading above a group
 * - Label: the caption of a control or a value
 * - Segmented: pick one of a few options
 * - IconButton: a round button with a symbol
 * - Divider: the hairline between rows inside a card
 * - Pills: pick one of several options that may not fit one row
 * - SearchField: a text field with a magnifier
 * - Field: a control with its caption and an optional note
 * - Stepper: a number with − and + buttons
 */

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={`overflow-hidden rounded-card bg-surface ${className}`}>
      {children}
    </View>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: string;
  /** Shown at the right end, e.g. a filter for the section. */
  action?: ReactNode;
}) {
  return (
    <View className="min-h-8 flex-row items-center justify-between gap-3 px-1">
      <Text className="flex-1 text-headline font-bold text-ink">
        {children}
      </Text>
      {action}
    </View>
  );
}

export function Label({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text className={`text-caption font-medium text-ink-muted ${className}`}>
      {children}
    </Text>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <View className={`h-px bg-line ${className}`} />;
}

/**
 * A row of mutually exclusive options.
 * - tone "plain": the selected option is a raised chip (for filters)
 * - tone "accent": the selected option is filled with the accent colour
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  tone = "plain",
  fill = false,
  small = false,
  selectedColor,
}: {
  options: { value: T; label: string; count?: number; a11yLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  tone?: "plain" | "accent";
  /** Stretch across the row, with equally wide options. */
  fill?: boolean;
  small?: boolean;
  /** Overrides the accent fill (the game picker uses each game's colour). */
  selectedColor?: string;
}) {
  return (
    <View
      role="tablist"
      className={`flex-row rounded-tile bg-sunken p-[3px] ${fill ? "" : "self-start"}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        const filled = on && tone === "accent";
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            role="tab"
            aria-selected={on}
            aria-label={o.a11yLabel}
            hitSlop={4}
            className={`items-center justify-center rounded-[9px] ${
              small ? "h-7 px-2.5" : "h-9 px-3.5"
            } ${fill ? "flex-1" : ""} ${
              on ? (filled ? "bg-accent" : "bg-surface") : "active:opacity-60"
            }`}
            style={
              filled && selectedColor
                ? { backgroundColor: selectedColor }
                : undefined
            }
          >
            <Text
              numberOfLines={1}
              className={`font-semibold ${small ? "text-caption" : "text-callout"} ${
                filled
                  ? selectedColor
                    ? "text-white"
                    : "text-on-accent"
                  : on
                    ? "text-ink"
                    : "text-ink-muted"
              }`}
            >
              {o.label}
              {o.count !== undefined && (
                <Text className="font-medium text-ink-subtle">
                  {"  "}
                  {o.count}
                </Text>
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  active = false,
  translucent = false,
}: {
  name: SymbolViewProps["name"];
  /** What the button does, for screen readers. */
  label: string;
  onPress: () => void;
  /** Filled with the accent colour (a switched-on toggle). */
  active?: boolean;
  /** For buttons that sit on a picture or tint instead of the canvas. */
  translucent?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      aria-label={label}
      role="button"
      hitSlop={8}
      className={`h-10 w-10 items-center justify-center rounded-full active:opacity-60 ${
        active ? "bg-accent" : translucent ? "bg-surface/70" : "bg-sunken"
      }`}
    >
      <SymbolView
        name={name}
        tintColor={active ? colors["on-accent"] : colors.ink}
        size={20}
      />
    </Pressable>
  );
}

/** A small rounded label, e.g. "Gift" or "Contact". */
export function Tag({ children }: { children: string }) {
  return (
    <View className="rounded-md bg-sunken px-2 py-0.5">
      <Text className="text-micro font-semibold text-ink-muted">
        {children}
      </Text>
    </View>
  );
}

/** Monospaced text, for pasted or copied team text. */
export const MONO = {
  fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
};

/** Numbers that line up in columns. */
export const TABULAR = { fontVariant: ["tabular-nums" as const] };

/**
 * One scrolling row of pills, for options that don't fit a Segmented.
 * It runs to the screen's edges, so it belongs in a page with the usual
 * 16px side padding.
 */
export function Pills<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: {
    value: T;
    label: string;
    a11yLabel?: string;
    /** Shown before the label, e.g. an icon tile. */
    left?: ReactNode;
  }[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerClassName="gap-2 px-4"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            role="radio"
            aria-checked={on}
            aria-label={o.a11yLabel}
            className={`h-11 flex-row items-center gap-2 rounded-full pr-4 active:opacity-60 ${
              o.left ? "pl-1.5" : "pl-4"
            } ${on ? "bg-ink" : "bg-surface"}`}
          >
            {o.left}
            <Text
              className={`text-callout font-semibold ${
                on ? "text-canvas" : "text-ink"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  clearable = false,
  className = "",
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  /** Show a button that empties the field. */
  clearable?: boolean;
  className?: string;
}) {
  const colors = useColors();
  return (
    <View
      className={`h-11 flex-row items-center gap-2 rounded-tile bg-sunken px-3 ${className}`}
    >
      <SymbolView
        name={{ ios: "magnifyingglass", android: "search", web: "search" }}
        tintColor={colors["ink-subtle"]}
        size={20}
      />
      <TextInput
        className="h-11 flex-1 text-body text-ink outline-none"
        placeholder={placeholder}
        placeholderTextColor={colors["ink-subtle"]}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {clearable && value !== "" && (
        <Pressable
          onPress={() => onChange("")}
          aria-label="Clear search"
          role="button"
          hitSlop={8}
        >
          <SymbolView
            name={{
              ios: "xmark.circle.fill",
              android: "cancel",
              web: "cancel",
            }}
            tintColor={colors["ink-subtle"]}
            size={20}
          />
        </Pressable>
      )}
    </View>
  );
}

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
