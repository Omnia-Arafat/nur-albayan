import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { loadSeed } from "../src/db/seed/files";
import { runSeed } from "../src/db/seed/run";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { prepare: false, max: 1 });
await runSeed(drizzle(client), loadSeed());
await client.end();
console.log("Seed loaded.");
