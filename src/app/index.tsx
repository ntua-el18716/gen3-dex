import { asc, count } from "drizzle-orm";
import { Text, View, StyleSheet } from "react-native";

import { useDb } from "@/db";
import { pokemon } from "@/db/schema";

export default function Index() {
  const db = useDb();
  const total = db.select({ n: count() }).from(pokemon).get();
  const first = db
    .select({ name: pokemon.name })
    .from(pokemon)
    .orderBy(asc(pokemon.id))
    .get();

  return (
    <View style={styles.container}>
      <Text>{total?.n} Pokémon in gen3.db</Text>
      <Text>#1 is {first?.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
