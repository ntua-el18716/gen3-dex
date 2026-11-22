import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { getAbility, getItem, getMove } from "./reference-queries";
import * as schema from "./schema";

const DB_PATH = path.resolve("assets/db/gen3.db");

describe.skipIf(!existsSync(DB_PATH))("reference queries", () => {
  const sqlite = new Database(DB_PATH, { readonly: true });
  const db = drizzle(sqlite, { schema });
  afterAll(() => sqlite.close());
  const idOf = (
    table: typeof schema.move | typeof schema.ability | typeof schema.item,
    name: string,
  ) =>
    db.select({ id: table.id }).from(table).where(eq(table.name, name)).get()!
      .id;

  it("gives a move's TM and its learners per method", () => {
    const flamethrower = getMove(
      db,
      idOf(schema.move, "Flamethrower"),
      "emerald",
    )!;
    expect(flamethrower.machine).toBe("TM35");
    const tm = flamethrower.sections.find((s) => s.method === "machine")!;
    expect(tm.learners.map((l) => l.name)).toContain("Charizard");
    const level = flamethrower.sections.find((s) => s.method === "level")!;
    // Level-up learners in level order.
    const levels = level.learners.map((l) => l.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("lists egg moves under later stages too", () => {
    const dd = getMove(db, idOf(schema.move, "Dragon Dance"), "emerald")!;
    const egg = dd.sections.find((s) => s.method === "egg")!.learners;
    expect(egg).toContainEqual(
      expect.objectContaining({ name: "Charmander", from: null }),
    );
    expect(egg).toContainEqual(
      expect.objectContaining({ name: "Charizard", from: "Charmander" }),
    );
    // Each Pokémon once.
    expect(new Set(egg.map((l) => l.pokemonId)).size).toBe(egg.length);
  });

  it("lists an ability's Pokémon with their other ability", () => {
    const levitate = getAbility(db, idOf(schema.ability, "Levitate"))!;
    expect(levitate.pokemon).toContainEqual(
      expect.objectContaining({ name: "Gengar", other: null }),
    );
    const shedSkin = getAbility(db, idOf(schema.ability, "Shed Skin"))!;
    expect(shedSkin.pokemon).toContainEqual(
      expect.objectContaining({ name: "Ekans", other: "Intimidate" }),
    );
    const intimidate = getAbility(db, idOf(schema.ability, "Intimidate"))!;
    expect(intimidate.pokemon.map((p) => p.name)).toContain("Gyarados");
  });

  it("gives a TM's move and an item's wild holders by version", () => {
    expect(
      getItem(db, idOf(schema.item, "TM26"), "emerald")!.teaches?.name,
    ).toBe("Earthquake");
    const lightBall = idOf(schema.item, "Light Ball");
    expect(
      getItem(db, lightBall, "emerald")!.heldBy.map((p) => p.name),
    ).toEqual(["Pikachu"]);
    expect(getItem(db, lightBall, "firered")!.heldBy).toEqual([]);
  });

  it("returns null for unknown ids", () => {
    expect(getMove(db, 99999, "emerald")).toBeNull();
    expect(getAbility(db, 99999)).toBeNull();
    expect(getItem(db, 99999, "emerald")).toBeNull();
  });
});
