import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { loadContent, runContentSeed } from "../src/db/seed/content";
import { loadSeed } from "../src/db/seed/files";
import { runSeed } from "../src/db/seed/run";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { prepare: false, max: 1 });
const db = drizzle(client);
await runSeed(db, loadSeed());
if (process.argv.includes("--content")) await runContentSeed(db, loadContent());
await client.end();
console.log(process.argv.includes("--content") ? "Seed and book content loaded." : "Seed loaded.");
