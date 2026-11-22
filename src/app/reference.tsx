import { Link, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { TypeDot } from "@/components/type-badge";
import { Chevron, SearchField, Segmented, TABULAR } from "@/components/ui";
import { useDb } from "@/db";
import { listReference } from "@/db/reference-queries";
import { POCKET_LABELS } from "@/lib/reference-labels";

type Kind = "moves" | "abilities" | "items";

/** Every move, ability and item, searchable; each opens its page. */
export default function ReferenceScreen() {
  const db = useDb();
  const all = useMemo(() => listReference(db), [db]);
  const [kind, setKind] = useState<Kind>("moves");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const rows: {
    key: string;
    href: Href;
    name: string;
    left?: React.ReactNode;
    right?: string;
  }[] =
    kind === "moves"
      ? all.moves.map((m) => ({
          key: `m${m.id}`,
          href: { pathname: "/move/[id]", params: { id: m.id } },
          name: m.name,
          left: <TypeDot type={m.type} size={20} />,
          right: m.power > 1 ? String(m.power) : undefined,
        }))
      : kind === "abilities"
        ? all.abilities.map((a) => ({
            key: `a${a.id}`,
            href: { pathname: "/ability/[id]", params: { id: a.id } },
            name: a.name,
          }))
        : all.items.map((i) => ({
            key: `i${i.id}`,
            href: { pathname: "/item/[id]", params: { id: i.id } },
            name: i.name,
            right: i.pocket ? POCKET_LABELS[i.pocket] : undefined,
          }));
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;

  return (
    <FlatList
      data={shown}
      keyExtractor={(r) => r.key}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
      ListHeaderComponent={
        <View className="gap-3 pb-3 pt-2">
          <Stack.Screen options={{ title: "Moves, abilities & items" }} />
          <Segmented
            options={[
              { value: "moves", label: "Moves", count: all.moves.length },
              {
                value: "abilities",
                label: "Abilities",
                count: all.abilities.length,
              },
              { value: "items", label: "Items", count: all.items.length },
            ]}
            value={kind}
            onChange={(k) => setKind(k)}
          />
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={`Search ${kind}`}
            clearable
          />
        </View>
      }
      ListEmptyComponent={
        <Text className="p-8 text-center text-body text-ink-muted">
          Nothing matches “{query}”.
        </Text>
      }
      renderItem={({ item: r, index }) => (
        <Link href={r.href} asChild>
          <Pressable
            className={`flex-row items-center gap-3 bg-surface px-4 py-3 active:bg-sunken ${
              index === 0 ? "rounded-t-card" : ""
            } ${index === shown.length - 1 ? "rounded-b-card" : "border-b border-line"}`}
          >
            {r.left}
            <Text
              className="flex-1 text-body font-semibold text-ink"
              numberOfLines={1}
            >
              {r.name}
            </Text>
            {r.right && (
              <Text className="text-callout text-ink-muted" style={TABULAR}>
                {r.right}
              </Text>
            )}
            <Chevron />
          </Pressable>
        </Link>
      )}
    />
  );
}

type Href = React.ComponentProps<typeof Link>["href"];
