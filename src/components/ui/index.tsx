import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

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

/** Numbers that line up in columns. */
export const TABULAR = { fontVariant: ["tabular-nums" as const] };
