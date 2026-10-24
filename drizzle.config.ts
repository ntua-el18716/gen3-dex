import { defineConfig } from "drizzle-kit";

/**
 * Generates SQL migrations from src/db/schema.ts into drizzle/.
 * The importer applies them to a fresh database before inserting data;
 * the app never migrates (it ships the finished, read-only database).
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
