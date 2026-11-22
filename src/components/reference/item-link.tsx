import { Link } from "expo-router";
import { Text } from "react-native";

/** An item's name inside a line of text, opening the item's page. */
export function ItemLink({ id, name }: { id: number | null; name: string }) {
  if (id === null)
    return <Text className="font-semibold text-ink">{name}</Text>;
  return (
    <Link
      href={{ pathname: "/item/[id]", params: { id } }}
      className="font-semibold text-ink underline decoration-ink-subtle"
    >
      {name}
    </Link>
  );
}
