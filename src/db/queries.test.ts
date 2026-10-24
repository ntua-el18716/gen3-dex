import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { listPokemon } from "./queries";
import * as schema from "./schema";

const DB_PATH = path.resolve("assets/db/gen3.db");

describe.skipIf(!existsSync(DB_PATH))("queries", () => {
  const sqlite = new Database(DB_PATH, { readonly: true });
  const db = drizzle(sqlite, { schema });
  afterAll(() => sqlite.close());

  describe("listPokemon", () => {
    it("returns all 386 in National Dex order", () => {
      const list = listPokemon(db);
      expect(list).toHaveLength(386);
      expect(list.map((p) => p.id)).toEqual(
        Array.from({ length: 386 }, (_, i) => i + 1),
      );
    });

    it("has Gen 3 types (no Fairy)", () => {
      const list = listPokemon(db);
      expect(list[0]).toEqual({
        id: 1,
        name: "Bulbasaur",
        type1: "grass",
        type2: "poison",
      });
      // Clefairy is pure Normal and Marill pure Water before Gen 6.
      expect(list[34]).toMatchObject({ type1: "normal", type2: null });
      expect(list[182]).toMatchObject({ type1: "water", type2: null });
    });
  });
});
