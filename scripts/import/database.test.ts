/**
 * Runs the validation checks against the committed database, so CI catches
 * a database that is out of date or was edited by hand.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { validate } from "./validate";

const DB_PATH = path.resolve("assets/db/gen3.db");

describe.skipIf(!existsSync(DB_PATH))("gen3.db", () => {
  it("passes every validation check", () => {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      expect(validate(db)).toEqual([]);
    } finally {
      db.close();
    }
  });
});
