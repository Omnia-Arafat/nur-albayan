/**
 * Creates (or updates) a local database for working without Supabase:
 * applies the migrations, then loads the seed, the book content and sample people (scripts/dev-fixtures.ts).
 * Use it with DATABASE_URL=pglite:.data/pglite in .env.local.
 */
import { mkdirSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../src/db/schema";
import { loadContent, runContentSeed } from "../src/db/seed/content";
import { loadSeed } from "../src/db/seed/files";
import { runSeed } from "../src/db/seed/run";

import { runDevFixtures } from "./dev-fixtures";

config({ path: [".env.local", ".env"] });
const url = process.env.DATABASE_URL ?? "pglite:.data/pglite";
if (!url.startsWith("pglite:")) throw new Error("db:local only works with a pglite: DATABASE_URL");

async function main() {
  const dir = url.slice("pglite:".length);
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  await runSeed(db, loadSeed());
  await runContentSeed(db, loadContent());
  if (await runDevFixtures(db)) console.log("Added the sample admin, teacher, classrooms and students.");
  await client.close();
  console.log(`Local database ready in ${dir}.`);
}

main();
